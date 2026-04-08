import type Compiler from '@/compiler/index';
import {
  ElementDeclarationNode,
  InfixExpressionNode,
  PostfixExpressionNode,
  PrefixExpressionNode,
  LiteralNode,
  PrimaryExpressionNode,
  ProgramNode,
  TupleExpressionNode,
  VariableNode,
  SyntaxNode,
} from '@/core/parser/nodes';
import { type NodeSymbol, SchemaSymbol, SymbolKind } from '@/core/types/symbols';
import Report from '@/core/report';
import { DEFAULT_SCHEMA_NAME, UNHANDLED } from '@/constants';
import { destructureComplexVariable, getBody, isAccessExpression, isExpressionAVariableNode } from '@/core/utils/expression';
import { destructureComplexVariableTuple } from '@/core/utils/expression';
import type { TokenPosition, RelationCardinality } from '@/core/types/schemaJson';
import { CompileError, CompileErrorCode } from '@/core/errors';
import { SyntaxToken, SyntaxTokenKind } from '@/core/lexer/tokens';
import { getMemberChain } from '@/core/parser/utils';

export function normalizeNoteContent (content: string): string {
  const lines = content.split('\n');

  // Top empty lines are trimmed
  const trimmedTopEmptyLines = lines.slice(lines.findIndex((line) => line.trimStart() !== ''));

  // Calculate min-indentation, empty lines are ignored
  const nonEmptyLines = trimmedTopEmptyLines.filter((line) => line.trimStart());
  const minIndent = Math.min(...nonEmptyLines.map((line) => line.length - line.trimStart().length));

  return trimmedTopEmptyLines.map((line) => line.slice(minIndent)).join('\n');
}

export function shouldInterpretNode (compiler: Compiler, node: SyntaxNode): boolean {
  const hasParseError = compiler.parse().getErrors().length > 0;
  const hasValidateError = compiler.validate(node).getErrors().length > 0;
  const hasBindError = compiler.bind(node).getErrors().length > 0;
  return !hasParseError && !hasValidateError && !hasBindError;
}

export function getTokenPosition (node: SyntaxNode): TokenPosition {
  return {
    start: {
      offset: node.startPos.offset,
      line: node.startPos.line + 1,
      column: node.startPos.column + 1,
    },
    end: {
      offset: node.endPos.offset,
      line: node.endPos.line + 1,
      column: node.endPos.column + 1,
    },
  };
}

// Get all symbols syntactically defined inside `node`
export function getNodeMemberSymbols (compiler: Compiler, node: SyntaxNode): Report<NodeSymbol[]> {
  const children = getMemberChain(node).filter((node) => node instanceof SyntaxNode);
  if (!children) {
    return new Report([]);
  }

  return children.reduce(
    (report, child) => {
      const symbol = compiler.nodeSymbol(child);
      const nestedSymbols = getNodeMemberSymbols(compiler, child);
      return new Report(
        [
          ...report.getValue(),
          ...(nestedSymbols.hasValue(UNHANDLED) ? [] : nestedSymbols.getValue()),
        ],
        [
          ...report.getErrors(),
          ...(symbol.hasValue(UNHANDLED) ? [] : symbol.getErrors()),
          ...(nestedSymbols.hasValue(UNHANDLED) ? [] : nestedSymbols.getErrors()),
        ],
        [
          ...report.getWarnings(),
          ...(symbol.hasValue(UNHANDLED) ? [] : symbol.getWarnings()),
          ...(nestedSymbols.hasValue(UNHANDLED) ? [] : nestedSymbols.getWarnings()),

        ],
      );
    },
    new Report<NodeSymbol[]>([]),
  );
}

// Scan an AST node (excluding ListExpressions) for variable references.
// Returns structured binding fragments with dotted-path variables and tuple elements.
export function scanNonListNodeForBinding (node?: SyntaxNode): { variables: (PrimaryExpressionNode & { expression: VariableNode })[]; tupleElements: (PrimaryExpressionNode & { expression: VariableNode })[] }[] {
  if (!node) return [];

  if (isExpressionAVariableNode(node)) {
    return [{ variables: [node], tupleElements: [] }];
  }

  if (node instanceof InfixExpressionNode) {
    const fragments = destructureComplexVariableTuple(node);
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
    const fragments = destructureComplexVariableTuple(node);
    if (!fragments) {
      return node.elementList.flatMap(scanNonListNodeForBinding);
    }
    return [fragments];
  }

  return [];
}

// Look up a member by name within a parent symbol's members.
// Returns Report with the found symbol (or undefined) and any errors.
export function lookupMember (
  compiler: Compiler,
  parentSymbol: NodeSymbol,
  name: string,
  {
    kinds,
    ignoreNotFound = false,
    errorNode,
  }: {
    kinds?: SymbolKind[];
    ignoreNotFound?: boolean;
    errorNode?: SyntaxNode;
  } = {},
): Report<NodeSymbol | undefined> {
  const members = compiler.symbolMembers(parentSymbol).getFiltered(UNHANDLED);
  if (!members) return new Report(undefined);

  const match = members.find((m: NodeSymbol) => {
    if (kinds && !m.isKind(...kinds)) return false;
    if (compiler.symbolName(m) === name) return true;
    if (!m.declaration) return false;
    const alias = compiler.alias(m.declaration).getFiltered(UNHANDLED);
    return alias === name;
  });

  // Report symbol not found
  if (!match && !ignoreNotFound) {
    const kindLabel = kinds?.length ? kinds[0] : 'member';
    const parentName = parentSymbol.declaration ? compiler.fullname(parentSymbol.declaration).getFiltered(UNHANDLED)?.join('.') : undefined;
    const scopeLabel = parentSymbol instanceof SchemaSymbol
      ? `Schema '${parentSymbol.name}'`
      : parentName
        ? `${parentSymbol.kind} '${parentName}'`
        : (parentSymbol.isKind(SymbolKind.Program)
            ? `Schema '${DEFAULT_SCHEMA_NAME}'`
            : 'global scope');

    return new Report(undefined, [
      new CompileError(
        CompileErrorCode.BINDING_ERROR,
        `${kindLabel} '${name}' does not exist in ${scopeLabel}`,
        errorNode ?? parentSymbol.declaration ?? compiler.parse().getValue().ast,
      ),
    ]);
  }

  return new Report(match);
}

// Look up a member in the default (public) schema, falling back to direct program search
export function lookupInDefaultSchema (
  compiler: Compiler,
  globalSymbol: NodeSymbol,
  name: string,
  options: {
    kinds?: SymbolKind[];
    ignoreNotFound?: boolean;
    errorNode?: SyntaxNode;
  }): Report<NodeSymbol | undefined> {
  const members = compiler.symbolMembers(globalSymbol).getFiltered(UNHANDLED);

  if (members) {
    const publicSchema = members.find((m: NodeSymbol) => m instanceof SchemaSymbol && m.name === DEFAULT_SCHEMA_NAME);
    if (publicSchema) {
      const result = lookupMember(compiler, publicSchema, name, { ...options, ignoreNotFound: true });
      if (result.getValue()) return result;
    }
  }
  return lookupMember(compiler, globalSymbol, name, options);
}

// For a node that is the right side of an access expression (a.b),
// resolve the left side via compiler.nodeReferee and return its symbol.
export function nodeRefereeOfLeftExpression (compiler: Compiler, node: SyntaxNode): NodeSymbol | undefined {
  const parent = node.parentNode;
  if (!parent || !isAccessExpression(parent) || parent.rightExpression !== node) return undefined;
  let leftExpr = parent.leftExpression;
  // If the left is also an access expression (a.b.c), resolve the rightmost leaf
  while (isAccessExpression(leftExpr)) {
    leftExpr = leftExpr.rightExpression;
  }
  const result = compiler.nodeReferee(leftExpr);
  if (result.hasValue(UNHANDLED)) return undefined;
  return result.getValue() ?? undefined;
}

export function extractColor (node: unknown): string | undefined {
  if (node instanceof PrimaryExpressionNode && node.expression instanceof LiteralNode && node.expression.literal?.kind === SyntaxTokenKind.COLOR_LITERAL) {
    return node.expression.literal.value;
  }
  return undefined;
}

export function getMultiplicities (
  op: string,
): [RelationCardinality, RelationCardinality] | undefined {
  switch (op) {
    case '<':
      return ['1', '*'];
    case '<>':
      return ['*', '*'];
    case '>':
      return ['*', '1'];
    case '-':
      return ['1', '1'];
    default:
      return undefined;
  }
}

export function extractNamesFromRefOperand (node: SyntaxNode, container?: { schemaName: string | null; tableName: string }): { schemaName: string | null; tableName: string; fieldNames: string[] } {
  const tuple = destructureComplexVariableTuple(node);
  if (!tuple) return { schemaName: null, tableName: '', fieldNames: [] };

  const vars = tuple.variables.map((v: any) => v.expression.variable?.value ?? '');
  const fieldNames = tuple.tupleElements.length > 0
    ? tuple.tupleElements.map((e: any) => e.expression.variable?.value ?? '')
    : [];

  if (fieldNames.length > 0) {
    // Composite ref: table.(col1, col2) or (col1, col2)
    if (vars.length === 0 && container) {
      return { schemaName: container.schemaName, tableName: container.tableName, fieldNames };
    }
    const tableName = vars.at(-1) ?? '';
    const schemaName = vars.length > 1 ? vars.slice(0, -1).join('.') : (container?.schemaName ?? null);
    return { schemaName, tableName, fieldNames };
  }

  // Single-column ref: just `column` or `table.column` or `schema.table.column`
  if (vars.length === 1 && container) {
    return { schemaName: container.schemaName, tableName: container.tableName, fieldNames: [vars[0]] };
  }

  if (vars.length >= 2) {
    const colName = vars.at(-1) ?? '';
    const tableName = vars.at(-2) ?? '';
    const schemaName = vars.length > 2 ? vars.slice(0, -2).join('.') : (container?.schemaName ?? null);
    return { schemaName, tableName, fieldNames: [colName] };
  }

  const tableName = vars.at(-1) ?? '';
  const schemaName = vars.length > 1 ? vars.slice(0, -1).join('.') : null;
  return { schemaName, tableName, fieldNames };
}

export function extractElementName (nameNode: SyntaxNode): { schemaName: string[]; name: string } {
  const fragments = destructureComplexVariable(nameNode)!;
  const name = fragments.pop()!;

  return {
    name,
    schemaName: fragments,
  };
}
