import Compiler from '@/compiler';
import { DEFAULT_SCHEMA_NAME, UNHANDLED } from '@/constants';
import { CompileError, CompileErrorCode } from '@/core/types/errors';
import { SyntaxTokenKind } from '@/core/lexer/tokens';
import { ArrayNode, CallExpressionNode, FunctionExpressionNode, InfixExpressionNode, LiteralNode, PostfixExpressionNode, PrefixExpressionNode, PrimaryExpressionNode, SyntaxNode, TupleExpressionNode, VariableNode } from '@/core/parser/nodes';
import { getMemberChain } from '@/core/parser/utils';
import Report from '@/core/types/report';
import { ColumnType, NodeSymbol, RelationCardinality, SchemaSymbol, SymbolKind, Table, TokenPosition } from '@/core/types';
import { destructureComplexVariable, destructureComplexVariableTuple, destructureMemberAccessExpression, extractQuotedStringToken, extractVariableFromExpression, extractVarNameFromPrimaryVariable, getNumberTextFromExpression, isAccessExpression, isDotDelimitedIdentifier, isExpressionAnIdentifierNode, isExpressionAQuotedString, isExpressionASignedNumberExpression, isExpressionAVariableNode, parseNumber } from '@/core/utils/expression';
import { zip } from 'lodash-es';

export function extractNamesFromRefOperand (operand: SyntaxNode, ownerSchema?: string | null, ownerName?: string): { schemaName: string | null; tableName: string; fieldNames: string[] } {
  const { variables, tupleElements } = destructureComplexVariableTuple(operand)!;

  const tupleNames = tupleElements?.map((e) => extractVarNameFromPrimaryVariable(e)!);
  const variableNames = variables?.map((e) => extractVarNameFromPrimaryVariable(e)!);

  if (tupleElements?.length) {
    if (variables?.length === 0) {
      return {
        schemaName: ownerSchema ?? null,
        tableName: ownerName ?? '',
        fieldNames: tupleNames,
      };
    }

    return {
      tableName: variableNames.pop()!,
      schemaName: variableNames.pop() ?? null,
      fieldNames: tupleNames,
    };
  }

  if (variables.length === 1) {
    return {
      schemaName: ownerSchema ?? null,
      tableName: ownerName ?? '',
      fieldNames: [variableNames[0]],
    };
  }

  return {
    fieldNames: [variableNames.pop()!],
    tableName: variableNames.pop()!,
    schemaName: variableNames.pop() || null,
  };
}

export function getMultiplicities (
  op: string,
): [RelationCardinality, RelationCardinality] {
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
      throw new Error('Invalid relation op');
  }
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

export function getColumnSymbolsOfRefOperand (compiler: Compiler, ref: SyntaxNode): NodeSymbol[] {
  const colNode = destructureMemberAccessExpression(ref)!.pop()!;
  if (colNode instanceof TupleExpressionNode) {
    return colNode.elementList.map((e) => compiler.nodeReferee(e).getFiltered(UNHANDLED)!);
  }
  return [compiler.nodeReferee(colNode).getFiltered(UNHANDLED)!];
}

export function extractElementName (nameNode: SyntaxNode): { schemaName: string[]; name: string } {
  const fragments = destructureComplexVariable(nameNode)!;
  const name = fragments.pop()!;

  return {
    name,
    schemaName: fragments,
  };
}

export function extractColor (node: unknown): string | undefined {
  if (node instanceof PrimaryExpressionNode && node.expression instanceof LiteralNode && node.expression.literal?.kind === SyntaxTokenKind.COLOR_LITERAL) {
    return node.expression.literal.value;
  }
  return undefined;
}

export function isSameEndpoint (sym1?: NodeSymbol, sym2?: NodeSymbol): boolean;
export function isSameEndpoint (sym1?: NodeSymbol[], sym2?: NodeSymbol[]): boolean;
export function isSameEndpoint (sym1?: NodeSymbol | NodeSymbol[], sym2?: NodeSymbol | NodeSymbol[]): boolean {
  if (sym1 === undefined || sym2 === undefined) return false;
  if (Array.isArray(sym1)) {
    const firstIds = sym1.map(({ id }) => id).sort();
    const secondIds = (sym2 as NodeSymbol[]).map(({ id }) => id).sort();
    return zip(firstIds, secondIds).every(([first, second]) => first === second);
  }

  const firstId = sym1.id;
  const secondId = (sym2 as NodeSymbol).id;
  return firstId === secondId;
}

export function normalizeNoteContent (content: string): string {
  const lines = content.split('\n');

  // Top empty lines are trimmed
  const trimmedTopEmptyLines = lines.slice(lines.findIndex((line) => line.trimStart() !== ''));

  // Calculate min-indentation, empty lines are ignored
  const nonEmptyLines = trimmedTopEmptyLines.filter((line) => line.trimStart());
  const minIndent = Math.min(...nonEmptyLines.map((line) => line.length - line.trimStart().length));

  return trimmedTopEmptyLines.map((line) => line.slice(minIndent)).join('\n');
}

export function processDefaultValue (valueNode?: SyntaxNode):
  {
    type: 'string' | 'number' | 'boolean' | 'expression';
    value: string | number;
  } | undefined {
  if (!valueNode) {
    return undefined;
  }

  if (isExpressionAQuotedString(valueNode)) {
    return {
      value: extractQuotedStringToken(valueNode)!,
      type: 'string',
    };
  }

  if (isExpressionASignedNumberExpression(valueNode)) {
    return {
      type: 'number',
      value: parseNumber(valueNode),
    };
  }

  if (isExpressionAnIdentifierNode(valueNode)) {
    const value = valueNode.expression.variable.value.toLowerCase();
    return {
      value,
      type: 'boolean',
    };
  }

  if (valueNode instanceof FunctionExpressionNode && valueNode.value) {
    return {
      value: valueNode.value.value,
      type: 'expression',
    };
  }

  if (isDotDelimitedIdentifier(valueNode)) {
    return {
      value: extractVariableFromExpression(destructureMemberAccessExpression(valueNode)!.at(-1))!,
      type: 'string',
    };
  }

  throw new Error('Unreachable');
}

export function processColumnType (compiler: Compiler, typeNode: SyntaxNode): Report<ColumnType> {
  let typeSuffix: string = '';
  let typeArgs: string | null = null;
  let numericParams: { precision: number; scale: number } | undefined;
  let lengthParam: { length: number } | undefined;

  if (typeNode instanceof CallExpressionNode) {
    const argElements = typeNode.argumentList!.elementList;
    typeArgs = argElements.map((e) => {
      if (isExpressionASignedNumberExpression(e)) {
        return getNumberTextFromExpression(e);
      }
      if (isExpressionAQuotedString(e)) {
        return extractQuotedStringToken(e);
      }
      // e can only be an identifier here
      return extractVariableFromExpression(e);
    }).join(',');
    typeSuffix = `(${typeArgs})`;

    // Parse numeric type parameters (precision, scale)
    if (argElements.length === 2
      && isExpressionASignedNumberExpression(argElements[0])
      && isExpressionASignedNumberExpression(argElements[1])) {
      const precision = parseNumber(argElements[0]);
      const scale = parseNumber(argElements[1]);
      if (!Number.isNaN(precision) && !Number.isNaN(scale)) {
        numericParams = { precision: Math.trunc(precision), scale: Math.trunc(scale) };
      }
    } else if (argElements.length === 1 && isExpressionASignedNumberExpression(argElements[0])) {
      const length = parseNumber(argElements[0]);
      if (!Number.isNaN(length)) {
        lengthParam = { length: Math.trunc(length) };
      }
    }

    typeNode = typeNode.callee!;
  }
  while (typeNode instanceof CallExpressionNode || typeNode instanceof ArrayNode) {
    if (typeNode instanceof CallExpressionNode) {
      const args = typeNode
        .argumentList!.elementList.map((e) => {
        if (isExpressionASignedNumberExpression(e)) {
          return getNumberTextFromExpression(e);
        }
        if (isExpressionAQuotedString(e)) {
          return extractQuotedStringToken(e);
        }
        // e can only be an identifier here
        return extractVariableFromExpression(e);
      })
        .join(',');
      typeSuffix = `(${args})${typeSuffix}`;
      typeNode = typeNode.callee!;
    } else if (typeNode instanceof ArrayNode) {
      const indexer = `[${
        typeNode
          .indexer!.elementList.map((e) => (e.name as any).expression.literal.value)
          .join(',')
      }]`;
      typeSuffix = `${indexer}${typeSuffix}`;
      typeNode = typeNode.array!;
    }
  }

  const { name: typeName, schemaName: typeSchemaName } = extractElementName(typeNode);

  // Check if this type references an enum
  const isEnum = !!compiler.nodeReferee(typeNode).getFiltered(UNHANDLED);

  if (typeSchemaName.length > 1) {
    return new Report(
      {
        schemaName: typeSchemaName.length === 0 ? null : typeSchemaName[0],
        type_name: `${typeName}${typeSuffix}`,
        args: typeArgs,
        numericParams,
        lengthParam,
        isEnum,
      },
      [new CompileError(CompileErrorCode.UNSUPPORTED, 'Nested schema is not supported', typeNode)],
    );
  }

  return new Report({
    schemaName: typeSchemaName.length === 0 ? null : typeSchemaName[0],
    type_name: `${typeName}${typeSuffix}`,
    args: typeArgs,
    numericParams,
    lengthParam,
    isEnum,
  });
}

export function shouldInterpretNode (compiler: Compiler, node: SyntaxNode): boolean {
  const hasParseError = compiler.parseFile().getErrors().length > 0;
  const hasValidateError = compiler.validate(node).getErrors().length > 0;
  const hasBindError = compiler.bind(node).getErrors().length > 0;
  return !hasParseError && !hasValidateError && !hasBindError;
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
    if (parentSymbol.isKind(SymbolKind.Program) || (parentSymbol instanceof SchemaSymbol && parentSymbol.qualifiedName.join('.') === DEFAULT_SCHEMA_NAME)) {
      if (m.declaration && compiler.alias(m.declaration).getFiltered(UNHANDLED) === name) return true; // Aliases can be found in public
      if (m.declaration && (compiler.fullname(m.declaration).getFiltered(UNHANDLED) || []).length > 1) return false; // This is a qualfied element
    }
    return compiler.symbolName(m) === name;
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
        errorNode ?? parentSymbol.declaration ?? compiler.parseFile().getValue().ast,
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
    const publicSchema = members.find((m: NodeSymbol) => m instanceof SchemaSymbol && m.qualifiedName.join('.') === DEFAULT_SCHEMA_NAME);
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
