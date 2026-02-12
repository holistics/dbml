import { DEFAULT_SCHEMA_NAME } from '@/constants';
import { SyntaxToken, SyntaxTokenKind } from '@/core/lexer/tokens';
import {
  AttributeNode,
  BlockExpressionNode,
  ElementDeclarationNode,
  FunctionExpressionNode,
  ListExpressionNode,
  LiteralNode,
  PrefixExpressionNode,
  PrimaryExpressionNode,
  SyntaxNode,
  TupleExpressionNode,
  VariableNode,
  CallExpressionNode,
  ArrayNode,
} from '@/core/parser/nodes';
import { isHexChar } from '@/core/utils';
import { destructureComplexVariable, destructureMemberAccessExpression } from '@/core/analyzer/utils';
import CustomValidator from './elementValidators/custom';
import EnumValidator from './elementValidators/enum';
import IndexesValidator from './elementValidators/indexes';
import NoteValidator from './elementValidators/note';
import ProjectValidator from './elementValidators/project';
import RefValidator from './elementValidators/ref';
import TableValidator from './elementValidators/table';
import TableGroupValidator from './elementValidators/tableGroup';
import { createSchemaSymbolIndex } from '@/core/analyzer/symbol/symbolIndex';
import { SchemaSymbol } from '@/core/analyzer/symbol/symbols';
import SymbolTable from '@/core/analyzer/symbol/symbolTable';
import SymbolFactory from '@/core/analyzer/symbol/factory';
import {
  extractStringFromIdentifierStream, isAccessExpression, isDotDelimitedIdentifier, isExpressionAQuotedString, isExpressionAVariableNode, isExpressionAnIdentifierNode,
} from '@/core/parser/utils';
import { NUMERIC_LITERAL_PREFIX } from '@/constants';
import Report from '@/core/report';
import { CompileError, CompileErrorCode } from '@/core/errors';
import { ElementKind } from '@/core/analyzer/types';
import TablePartialValidator from './elementValidators/tablePartial';
import ChecksValidator from './elementValidators/checks';
import RecordsValidator from './elementValidators/records';
import PolicyValidator from './elementValidators/policy';

export function pickValidator (element: ElementDeclarationNode & { type: SyntaxToken }) {
  switch (element.type.value.toLowerCase() as ElementKind) {
    case ElementKind.Enum:
      return EnumValidator;
    case ElementKind.Table:
      return TableValidator;
    case ElementKind.TableGroup:
      return TableGroupValidator;
    case ElementKind.Project:
      return ProjectValidator;
    case ElementKind.Ref:
      return RefValidator;
    case ElementKind.Note:
      return NoteValidator;
    case ElementKind.Indexes:
      return IndexesValidator;
    case ElementKind.TablePartial:
      return TablePartialValidator;
    case ElementKind.Check:
      return ChecksValidator;
    case ElementKind.Records:
      return RecordsValidator;
    case ElementKind.Policy:
      return PolicyValidator;
    default:
      return CustomValidator;
  }
}

// Is the name valid (either simple or complex)
export function isValidName (nameNode: SyntaxNode): boolean {
  return !!destructureComplexVariable(nameNode).unwrap_or(false);
}

// Is the alias valid (only simple name is allowed)
export function isValidAlias (
  aliasNode: SyntaxNode,
): aliasNode is PrimaryExpressionNode & { expression: VariableNode } {
  return isSimpleName(aliasNode);
}

// Is the name valid and simple
export function isSimpleName (
  nameNode: SyntaxNode,
): nameNode is PrimaryExpressionNode & { expression: VariableNode } {
  return nameNode instanceof PrimaryExpressionNode && nameNode.expression instanceof VariableNode;
}

// Is the argument a ListExpression
export function isValidSettingList (
  settingListNode: SyntaxNode,
): settingListNode is ListExpressionNode {
  return settingListNode instanceof ListExpressionNode;
}

// Does the element has complex body
export function hasComplexBody (
  node: ElementDeclarationNode,
): node is ElementDeclarationNode & { body: BlockExpressionNode; bodyColon: undefined } {
  return node.body instanceof BlockExpressionNode && !node.bodyColon;
}

// Does the element has simple body
export function hasSimpleBody (
  node: ElementDeclarationNode,
): node is ElementDeclarationNode & { bodyColon: SyntaxToken } {
  return !!node.bodyColon;
}

export function isValidPartialInjection (
  node?: SyntaxNode,
): node is PrefixExpressionNode & { op: { value: '~' } } {
  return node instanceof PrefixExpressionNode && node.op?.value === '~' && isExpressionAVariableNode(node.expression);
}
// Register the `variables` array as a stack of schema, the following nested within the former
export function registerSchemaStack (
  variables: string[],
  globalSchema: SymbolTable,
  symbolFactory: SymbolFactory,
): SymbolTable {
  // public schema is already global schema
  if (variables[0] === DEFAULT_SCHEMA_NAME) {
    variables = variables.slice(1);
  }

  let prevSchema = globalSchema;

  for (const curName of variables) {
    let curSchema: SymbolTable | undefined;
    const curId = createSchemaSymbolIndex(curName);

    if (!prevSchema.has(curId)) {
      curSchema = new SymbolTable();
      const curSymbol = symbolFactory.create(SchemaSymbol, { symbolTable: curSchema });
      prevSchema.set(curId, curSymbol);
    } else {
      curSchema = prevSchema.get(curId)?.symbolTable;
      if (!curSchema) {
        throw new Error('Expect a symbol table in a schema symbol');
      }
    }
    prevSchema = curSchema;
  }

  return prevSchema;
}

export function isRelationshipOp (op?: string): boolean {
  return op === '-' || op === '<>' || op === '>' || op === '<';
}

export function isValidColor (value?: SyntaxNode): boolean {
  if (
    !(value instanceof PrimaryExpressionNode)
    || !(value.expression instanceof LiteralNode)
    || !(value.expression.literal?.kind === SyntaxTokenKind.COLOR_LITERAL)
  ) {
    return false;
  }

  const color = value.expression.literal.value;

  // e.g. #fff or #0abcde
  if (color.length !== 4 && color.length !== 7) {
    return false;
  }

  if (color[0] !== '#') {
    return false;
  }

  for (let i = 1; i < color.length; i += 1) {
    if (!isHexChar(color[i])) {
      return false;
    }
  }

  return true;
}

// Is the value non-existent
export function isVoid (value?: SyntaxNode): boolean {
  return value === undefined;
}

// Is the `value` a valid value for a column's `default` setting
// It's a valid only if it's a literal or a complex variable (potentially an enum member)
export function isValidDefaultValue (value?: SyntaxNode): boolean {
  if (isExpressionAQuotedString(value)) {
    return true;
  }

  if (isExpressionASignedNumberExpression(value)) {
    return true;
  }

  if (isExpressionAnIdentifierNode(value) && ['true', 'false', 'null'].includes(value.expression.variable.value.toLowerCase())) {
    return true;
  }

  if (
    value instanceof PrefixExpressionNode
    && NUMERIC_LITERAL_PREFIX.includes(value.op?.value as any)
    && isExpressionASignedNumberExpression(value.expression)
  ) {
    return true;
  }

  if (value instanceof FunctionExpressionNode) {
    return true;
  }

  if (!value) return false;
  if (!isDotDelimitedIdentifier(value)) return false;
  const fragments = destructureMemberAccessExpression(value).unwrap();
  return fragments.length === 2 || fragments.length === 3;
}

export type SignedNumberExpression =
  (PrimaryExpressionNode & { expression: LiteralNode & { literal: { kind: SyntaxTokenKind.NUMERIC_LITERAL } } })
  | (PrefixExpressionNode & { op: '-' | '+'; expression: SignedNumberExpression });
export function isExpressionASignedNumberExpression (value?: SyntaxNode): value is SignedNumberExpression {
  if (value instanceof PrefixExpressionNode) {
    if (!NUMERIC_LITERAL_PREFIX.includes(value.op!.value)) return false;
    return isExpressionASignedNumberExpression(value.expression);
  }
  return (
    value instanceof PrimaryExpressionNode
    && value.expression instanceof LiteralNode
    && value.expression.literal?.kind === SyntaxTokenKind.NUMERIC_LITERAL
  );
}

export function isUnaryRelationship (value?: SyntaxNode): value is PrefixExpressionNode {
  if (!(value instanceof PrefixExpressionNode)) {
    return false;
  }

  if (!isRelationshipOp(value.op?.value)) {
    return false;
  }

  const variables = destructureComplexVariable(value.expression).unwrap_or(undefined);

  return variables !== undefined && variables.length > 0;
}

export function isTupleOfVariables (value?: SyntaxNode): value is TupleExpressionNode & {
  elementList: (PrimaryExpressionNode & { expression: VariableNode })[];
} {
  return value instanceof TupleExpressionNode && value.elementList.every(isExpressionAVariableNode);
}

export function isValidColumnType (type: SyntaxNode): boolean {
  if (
    !(
      type instanceof CallExpressionNode
      || isAccessExpression(type)
      || type instanceof PrimaryExpressionNode
      || type instanceof ArrayNode
    )
  ) {
    return false;
  }

  while (type instanceof CallExpressionNode || type instanceof ArrayNode) {
    if (type instanceof CallExpressionNode) {
      if (type.callee === undefined || type.argumentList === undefined) {
        return false;
      }

      if (!type.argumentList.elementList.every((e) => isExpressionASignedNumberExpression(e) || isExpressionAQuotedString(e) || isExpressionAnIdentifierNode(e))) {
        return false;
      }

      type = type.callee;
    } else if (type instanceof ArrayNode) {
      if (type.array === undefined || type.indexer === undefined) {
        return false;
      }

      if (!type.indexer.elementList.every((attribute) => !attribute.colon && !attribute.value && isExpressionASignedNumberExpression(attribute.name))) {
        return false;
      }

      type = type.array;
    }
  }

  const variables = destructureComplexVariable(type).unwrap_or(undefined);

  return variables !== undefined && variables.length > 0;
}

export function aggregateSettingList (settingList?: ListExpressionNode): Report<{ [index: string]: AttributeNode[] }> {
  const map: { [index: string]: AttributeNode[] } = {};
  const errors: CompileError[] = [];
  if (!settingList) {
    return new Report({});
  }
  settingList.elementList.forEach((attribute) => {
    if (!attribute.name) return;

    if (attribute.name instanceof PrimaryExpressionNode) {
      errors.push(new CompileError(CompileErrorCode.INVALID_SETTINGS, 'A setting name must be a stream of identifiers', attribute.name));
      return;
    }

    const name = extractStringFromIdentifierStream(attribute.name).unwrap_or(undefined)?.toLowerCase();
    if (!name) return;

    if (map[name] === undefined) {
      map[name] = [attribute];
    } else {
      map[name].push(attribute);
    }
  });

  return new Report(map, errors);
}
