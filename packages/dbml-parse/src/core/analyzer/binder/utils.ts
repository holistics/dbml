import { SyntaxToken } from '@/core/lexer/tokens';
import { ElementDeclarationNode, InfixExpressionNode, PostfixExpressionNode, PrefixExpressionNode, PrimaryExpressionNode, ProgramNode, SyntaxNode, TupleExpressionNode, VariableNode } from '@/core/parser/nodes';
import { ElementKind } from '@/core/analyzer/types';
import ChecksBinder from './elementBinder/checks';
import CustomBinder from './elementBinder/custom';
import EnumBinder from './elementBinder/enum';
import IndexesBinder from './elementBinder/indexes';
import NoteBinder from './elementBinder/note';
import ProjectBinder from './elementBinder/project';
import RefBinder from './elementBinder/ref';
import TableBinder from './elementBinder/table';
import TableGroupBinder from './elementBinder/tableGroup';
import TablePartialBinder from './elementBinder/tablePartial';
import { destructureComplexVariableTuple, extractVarNameFromPrimaryVariable } from '@/core/analyzer/utils';
import { SymbolKind, createNodeSymbolIndex } from '@/core/analyzer/symbol/symbolIndex';
import { getSymbolKind } from '@/core/analyzer/symbol/utils';
import { getElementNameString, isExpressionAVariableNode } from '@/core/parser/utils';
import { CompileError, CompileErrorCode } from '@/core/errors';
import { DEFAULT_SCHEMA_NAME } from '@/constants';
import RecordsBinder from './elementBinder/records';

export function pickBinder (element: ElementDeclarationNode & { type: SyntaxToken }) {
  switch (element.type.value.toLowerCase() as ElementKind) {
    case ElementKind.Enum:
      return EnumBinder;
    case ElementKind.Table:
      return TableBinder;
    case ElementKind.TableGroup:
      return TableGroupBinder;
    case ElementKind.Project:
      return ProjectBinder;
    case ElementKind.Ref:
      return RefBinder;
    case ElementKind.Note:
      return NoteBinder;
    case ElementKind.Indexes:
      return IndexesBinder;
    case ElementKind.TablePartial:
      return TablePartialBinder;
    case ElementKind.Check:
      return ChecksBinder;
    case ElementKind.Records:
      return RecordsBinder;
    default:
      return CustomBinder;
  }
}

// Scan for variable node and member access expression in the node except ListExpressionNode
export function scanNonListNodeForBinding (node?: SyntaxNode):
{ variables: (PrimaryExpressionNode & { expression: VariableNode })[]; tupleElements: (PrimaryExpressionNode & { expression: VariableNode })[] }[] {
  if (!node) {
    return [];
  }

  if (isExpressionAVariableNode(node)) {
    return [{ variables: [node], tupleElements: [] }];
  }

  if (node instanceof InfixExpressionNode) {
    const fragments = destructureComplexVariableTuple(node).unwrap_or(undefined);
    if (!fragments) {
      return [...scanNonListNodeForBinding(node.leftExpression), ...scanNonListNodeForBinding(node.rightExpression)];
    }

    return [fragments];
  }

  if (node instanceof PrefixExpressionNode) {
    return scanNonListNodeForBinding(node.expression);
  }

  if (node instanceof PostfixExpressionNode) {
    return scanNonListNodeForBinding(node.expression);
  }

  if (node instanceof TupleExpressionNode) {
    const fragments = destructureComplexVariableTuple(node).unwrap_or(undefined);
    if (!fragments) {
      // Tuple elements are not simple variables (e.g., member access expressions like table.column)
      // Recurse into each element
      return node.elementList.flatMap(scanNonListNodeForBinding);
    }
    return [fragments];
  }

  // The other cases are not supported as practically they shouldn't arise
  return [];
}

export function lookupAndBindInScope (
  initialScope: ElementDeclarationNode | ProgramNode,
  symbolInfos: { node: PrimaryExpressionNode & { expression: VariableNode }; kind: SymbolKind }[],
): CompileError[] {
  if (!initialScope.symbol?.symbolTable) {
    throw new Error('lookupAndBindInScope should only be called with initial scope having a symbol table');
  }

  let curSymbolTable = initialScope.symbol.symbolTable;
  let curKind = getSymbolKind(initialScope.symbol);
  let curName = initialScope instanceof ElementDeclarationNode ? getElementNameString(initialScope).unwrap_or('<invalid name>') : DEFAULT_SCHEMA_NAME;

  if (initialScope instanceof ProgramNode && symbolInfos.length) {
    const { node, kind } = symbolInfos[0];
    const name = extractVarNameFromPrimaryVariable(node).unwrap_or('<unnamed>');
    if (name === DEFAULT_SCHEMA_NAME && kind === SymbolKind.Schema) {
      symbolInfos.shift();
    }
  }

  for (const curSymbolInfo of symbolInfos) {
    const { node, kind } = curSymbolInfo;
    const name = extractVarNameFromPrimaryVariable(node).unwrap_or('<unnamed>');
    const index = createNodeSymbolIndex(name, kind);
    const symbol = curSymbolTable.get(index);

    if (!symbol) {
      return [new CompileError(CompileErrorCode.BINDING_ERROR, `${kind} '${name}' does not exist in ${curName === undefined ? 'global scope' : `${curKind} '${curName}'`}`, node)];
    }
    node.referee = symbol;
    symbol.references.push(node);

    curName = name;
    curKind = kind;
    if (!symbol.symbolTable) {
      return [];
    }
    curSymbolTable = symbol.symbolTable;
  }

  return [];
}
