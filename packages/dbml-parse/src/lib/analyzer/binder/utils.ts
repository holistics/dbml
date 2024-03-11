import { CompileError, CompileErrorCode } from '../../errors';
import { getElementName, isExpressionAVariableNode } from '../../parser/utils';
import { SyntaxToken } from '../../lexer/tokens';
import {
  ElementDeclarationNode,
  InfixExpressionNode,
  PostfixExpressionNode,
  PrefixExpressionNode,
  PrimaryExpressionNode,
  ProgramNode,
  SyntaxNode,
  TupleExpressionNode,
  VariableNode,
} from '../../parser/nodes';
import { ElementKind } from '../types';
import CustomBinder from './elementBinder/custom';
import EnumBinder from './elementBinder/enum';
import IndexesBinder from './elementBinder/indexes';
import NoteBinder from './elementBinder/note';
import ProjectBinder from './elementBinder/project';
import RefBinder from './elementBinder/ref';
import TableBinder from './elementBinder/table';
import TableGroupBinder from './elementBinder/tableGroup';
import { destructureComplexVariableTuple, extractVarNameFromPrimaryVariable } from '../utils';
import { SymbolKind, createNodeSymbolIndex, createSchemaSymbolIndex } from '../symbol/symbolIndex';
import { getSymbolKind } from '../symbol/utils';

export function pickBinder(element: ElementDeclarationNode & { type: SyntaxToken }) {
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
    default:
      return CustomBinder;
  }
}

// Scan for variable node and member access expression in the node except ListExpressionNode
export function scanNonListNodeForBinding(node: SyntaxNode | undefined): { variables: (PrimaryExpressionNode & { expression: VariableNode })[], tupleElements: (PrimaryExpressionNode & { expression: VariableNode })[] }[] {
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
    return destructureComplexVariableTuple(node).map((res) => [res]).unwrap_or([]);
  }

  // The other cases are not supported as practically they shouldn't arise
  return [];
}

export function lookupAndBindInScope(initialScope: ElementDeclarationNode | ProgramNode, symbolInfos: { node: PrimaryExpressionNode & { expression: VariableNode }, kind: SymbolKind }[]): CompileError[] {
  if (!initialScope.symbol?.symbolTable) {
    throw new Error('lookupAndBindInScope should only be called with initial scope having a symbol table');
  }

  let curSymbolTable = initialScope.symbol.symbolTable;
  let curKind = getSymbolKind(initialScope.symbol);
  let curName = initialScope instanceof ElementDeclarationNode ? getElementName(initialScope).unwrap_or('<invalid name>') : 'public';

  if (initialScope instanceof ProgramNode && symbolInfos.length) {
    const { node, kind } = symbolInfos[0];
    const name = extractVarNameFromPrimaryVariable(node).unwrap_or('<unnamed>');
    if (name === 'public' && kind === SymbolKind.Schema) {
      symbolInfos.shift();
    }
  }

  // eslint-disable-next-line no-restricted-syntax
  for (const curSymbolInfo of symbolInfos) {
    const { node, kind } = curSymbolInfo;
    const name = extractVarNameFromPrimaryVariable(node).unwrap_or('<unnamed>');
    const index = createNodeSymbolIndex(name, kind);
    const symbol = curSymbolTable.get(index);

    if (!symbol) {
      return [new CompileError(CompileErrorCode.BINDING_ERROR, `${kind} '${name}' does not exists in ${curName === undefined ? 'global scope' : `${curKind} '${curName}'`}`, node)];
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
