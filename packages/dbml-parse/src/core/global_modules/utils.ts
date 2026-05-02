import {
  zip,
} from 'lodash-es';
import type Compiler from '@/compiler';
import {
  DEFAULT_SCHEMA_NAME,
} from '@/constants';
import {
  getMemberChain,
} from '@/core/parser/utils';
import type {
  RelationCardinality,
} from '@/core/types';
import {
  UNHANDLED,
} from '@/core/types/module';
import {
  InfixExpressionNode, PostfixExpressionNode, PrefixExpressionNode, PrimaryExpressionNode, SyntaxNode, TupleExpressionNode, VariableNode,
} from '@/core/types/nodes';
import Report from '@/core/types/report';
import {
  NodeSymbol, SymbolKind,
} from '@/core/types/symbol';
import {
  destructureComplexVariableTuple, destructureMemberAccessExpression, extractVarNameFromPrimaryVariable, isAccessExpression, isExpressionAVariableNode,
} from '@/core/utils/expression';

export function extractNamesFromRefOperand (operand: SyntaxNode, ownerSchema?: string | null, ownerTable?: string): {
  schemaName: string | null;
  tableName: string;
  fieldNames: string[];
} {
  // Sanitize ownerSchema  -- default schema should be null in output
  if (ownerSchema === DEFAULT_SCHEMA_NAME) ownerSchema = null;
  const {
    variables, tupleElements,
  } = destructureComplexVariableTuple(operand)!;

  const tupleNames = tupleElements?.map((e) => extractVarNameFromPrimaryVariable(e)!);
  const variableNames = variables?.map((e) => extractVarNameFromPrimaryVariable(e)!);

  if (tupleElements?.length) {
    if (variables?.length === 0) {
      return {
        schemaName: ownerSchema ?? null,
        tableName: ownerTable ?? '',
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
      tableName: ownerTable ?? '',
      fieldNames: [
        variableNames[0],
      ],
    };
  }

  return {
    fieldNames: [
      variableNames.pop()!,
    ],
    tableName: variableNames.pop()!,
    schemaName: variableNames.pop() || null,
  };
}

export function getColumnSymbolsOfRefOperand (compiler: Compiler, ref: SyntaxNode): NodeSymbol[] {
  const colNode = destructureMemberAccessExpression(ref)!.pop()!;
  if (colNode instanceof TupleExpressionNode) {
    return colNode.elementList.map((e) => compiler.nodeReferee(e).getFiltered(UNHANDLED)!);
  }
  return [
    compiler.nodeReferee(colNode).getFiltered(UNHANDLED)!,
  ];
}

export function isSameEndpoint (sym1?: NodeSymbol, sym2?: NodeSymbol): boolean;
export function isSameEndpoint (sym1?: NodeSymbol[], sym2?: NodeSymbol[]): boolean;
export function isSameEndpoint (sym1?: NodeSymbol | NodeSymbol[], sym2?: NodeSymbol | NodeSymbol[]): boolean {
  if (sym1 === undefined || sym2 === undefined) return false;
  if (Array.isArray(sym1)) {
    const firstIds = sym1.map(({
      id,
    }) => id).sort();
    const secondIds = (sym2 as NodeSymbol[]).map(({
      id,
    }) => id).sort();
    return zip(firstIds, secondIds).every(([
      first,
      second,
    ]) => first === second);
  }

  const firstId = sym1.id;
  const secondId = (sym2 as NodeSymbol).id;
  return firstId === secondId;
}

export function shouldInterpretNode (compiler: Compiler, node: SyntaxNode): boolean {
  const hasParseError = [
    ...compiler.parseProject().values(),
  ].some((r) => r.getErrors().length > 0);
  const hasValidateError = compiler.validateNode(node).getErrors().length > 0;
  const hasBindError = compiler.bindNode(node).getErrors().length > 0;
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
export function scanNonListNodeForBinding (node?: SyntaxNode): { variables: (PrimaryExpressionNode & { expression: VariableNode })[];
  tupleElements: (PrimaryExpressionNode & { expression: VariableNode })[]; }[] {
  if (!node) return [];

  if (isExpressionAVariableNode(node)) {
    return [
      {
        variables: [
          node,
        ],
        tupleElements: [],
      },
    ];
  }

  if (node instanceof InfixExpressionNode) {
    const fragments = destructureComplexVariableTuple(node);
    if (!fragments) {
      return [
        ...scanNonListNodeForBinding(node.leftExpression),
        ...scanNonListNodeForBinding(node.rightExpression),
      ];
    }
    return [
      fragments,
    ];
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
    return [
      fragments,
    ];
  }

  return [];
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
    const publicSchema = members.find((m: NodeSymbol) => m.isPublicSchema());
    if (publicSchema) {
      const result = compiler.lookupMembers(publicSchema, options.kinds ?? [], name, true);
      if (result.getValue()) return result;
    }
  }
  return compiler.lookupMembers(globalSymbol, options.kinds ?? [], name, options.ignoreNotFound, options.errorNode);
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
  return compiler.nodeReferee(leftExpr).getFiltered(UNHANDLED) ?? undefined;
}

export function getMultiplicities (
  op: string,
): [RelationCardinality, RelationCardinality] | undefined {
  switch (op) {
    case '<':
      return [
        '1',
        '*',
      ];
    case '<>':
      return [
        '*',
        '*',
      ];
    case '>':
      return [
        '*',
        '1',
      ];
    case '-':
      return [
        '1',
        '1',
      ];
    default:
      return undefined;
  }
}

export function getSymbolSchemaAndName (compiler: Compiler, symbol: NodeSymbol): {
  schemaName: string | null;
  name: string;
} {
  // Resolve through aliases so both name and schema come from the real declaration.
  const resolved = symbol.originalSymbol;
  const fullname = resolved.declaration ? compiler.nodeFullname(resolved.declaration).getFiltered(UNHANDLED) : undefined;
  const rawSchema = (fullname && fullname.length > 1) ? fullname[0] : null;
  const schemaName = rawSchema === DEFAULT_SCHEMA_NAME ? null : rawSchema;
  const name = fullname?.at(-1) ?? resolved.name ?? '';

  return {
    schemaName,
    name,
  };
}
