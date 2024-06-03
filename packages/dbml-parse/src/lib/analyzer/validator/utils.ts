import { SyntaxToken, SyntaxTokenKind } from '../../lexer/tokens';
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
} from '../../parser/nodes';
import { isHexChar } from '../../utils';
import { destructureComplexVariable } from '../utils';
import CustomValidator from './elementValidators/custom';
import EnumValidator from './elementValidators/enum';
import IndexesValidator from './elementValidators/indexes';
import NoteValidator from './elementValidators/note';
import ProjectValidator from './elementValidators/project';
import RefValidator from './elementValidators/ref';
import TableValidator from './elementValidators/table';
import TableGroupValidator from './elementValidators/tableGroup';
import { createSchemaSymbolIndex } from '../symbol/symbolIndex';
import { SchemaSymbol } from '../symbol/symbols';
import SymbolTable from '../symbol/symbolTable';
import SymbolFactory from '../symbol/factory';
import { extractStringFromIdentifierStream, isExpressionAQuotedString, isExpressionAVariableNode, isExpressionAnIdentifierNode } from '../../parser/utils';
import { NUMERIC_LITERAL_PREFIX } from '../../../constants';
import Report from '../../report';
import { CompileError, CompileErrorCode } from '../../errors';
import { ElementKind } from '../types';

export function pickValidator(element: ElementDeclarationNode & { type: SyntaxToken }) {
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
    default:
      return CustomValidator;
  }
}

// Is the name valid (either simple or complex)
export function isValidName(nameNode: SyntaxNode): boolean {
  return !!destructureComplexVariable(nameNode).unwrap_or(false);
}

// Is the alias valid (only simple name is allowed)
export function isValidAlias(
  aliasNode: SyntaxNode,
): aliasNode is PrimaryExpressionNode & { expression: VariableNode } {
  return isSimpleName(aliasNode);
}

// Is the name valid and simple
export function isSimpleName(
  nameNode: SyntaxNode,
): nameNode is PrimaryExpressionNode & { expression: VariableNode } {
  return nameNode instanceof PrimaryExpressionNode && nameNode.expression instanceof VariableNode;
}

// Is the argument a ListExpression
export function isValidSettingList(
  settingListNode: SyntaxNode,
): settingListNode is ListExpressionNode {
  return settingListNode instanceof ListExpressionNode;
}

// Does the element has complex body
export function hasComplexBody(
  node: ElementDeclarationNode,
): node is ElementDeclarationNode & { body: BlockExpressionNode; bodyColon: undefined } {
  return node.body instanceof BlockExpressionNode && !node.bodyColon;
}

// Does the element has simple body
export function hasSimpleBody(
  node: ElementDeclarationNode,
): node is ElementDeclarationNode & { bodyColon: SyntaxToken } {
  return !!node.bodyColon;
}

// Register the `variables` array as a stack of schema, the following nested within the former
export function registerSchemaStack(
  variables: string[],
  globalSchema: SymbolTable,
  symbolFactory: SymbolFactory,
): SymbolTable {
  // public schema is already global schema 
  if (variables[0] === 'public') {
    variables = variables.slice(1);
  }

  let prevSchema = globalSchema;
  // eslint-disable-next-line no-restricted-syntax
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

export function isRelationshipOp(op?: string): boolean {
  return op === '-' || op === '<>' || op === '>' || op === '<';
}

export function isValidColor(value?: SyntaxNode): boolean {
  if (
    !(value instanceof PrimaryExpressionNode) ||
    !(value.expression instanceof LiteralNode) ||
    !(value.expression.literal?.kind === SyntaxTokenKind.COLOR_LITERAL)
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
export function isVoid(value?: SyntaxNode): boolean {
  return value === undefined;
}

// Is the `value` a valid value for a column's `default` setting
// It's a valid only if it's a literal or a complex variable (potentially an enum member)
export function isValidDefaultValue(value?: SyntaxNode): boolean {
  if (isExpressionAQuotedString(value)) {
    return true;
  }

  if (isExpressionANumber(value)) {
    return true;
  }

  if (isExpressionAnIdentifierNode(value) && ['true', 'false', 'null'].includes(value.expression.variable.value.toLowerCase())) {
    return true;
  }

  if (
    value instanceof PrefixExpressionNode &&
    NUMERIC_LITERAL_PREFIX.includes(value.op?.value as any) &&
    isExpressionANumber(value.expression)
  ) {
    return true;
  }

  if (value instanceof FunctionExpressionNode) {
    return true;
  }

  return false;
}

export function isExpressionANumber(value?: SyntaxNode): value is PrimaryExpressionNode & {
  expression: LiteralNode & { literal: { kind: SyntaxTokenKind.NUMERIC_LITERAL } };
} {
  return (
    value instanceof PrimaryExpressionNode &&
    value.expression instanceof LiteralNode &&
    value.expression.literal?.kind === SyntaxTokenKind.NUMERIC_LITERAL
  );
}

export function isUnaryRelationship(value?: SyntaxNode): value is PrefixExpressionNode {
  if (!(value instanceof PrefixExpressionNode)) {
    return false;
  }

  if (!isRelationshipOp(value.op?.value)) {
    return false;
  }

  const variables = destructureComplexVariable(value.expression).unwrap_or(undefined);

  return variables !== undefined && variables.length > 0;
}

export function isTupleOfVariables(value?: SyntaxNode): value is TupleExpressionNode & {
  elementList: (PrimaryExpressionNode & { expression: VariableNode })[];
} {
  return value instanceof TupleExpressionNode && value.elementList.every(isExpressionAVariableNode);
}

export function aggregateSettingList(settingList?: ListExpressionNode): Report<{ [index: string]: AttributeNode[] }, CompileError> {
  const map: { [index: string]: AttributeNode[]; } = {};
  const errors: CompileError[] = [];
  if (!settingList) {
    return new Report({});
  }
  for (const attribute of settingList.elementList) {
    if (!attribute.name) {
      continue;
    }

    if (attribute.name instanceof PrimaryExpressionNode) {
      errors.push(new CompileError(CompileErrorCode.INVALID_SETTINGS, 'A setting name must be a stream of identifiers', attribute.name));
      continue;
    }

    const name = extractStringFromIdentifierStream(attribute.name).unwrap_or(undefined)?.toLowerCase();
    if (!name) {
      continue;
    }

    if (map[name] === undefined) {
      map[name] = [attribute]
    } else {
      map[name].push(attribute);
    }
  }

  return new Report(map, errors);
}
