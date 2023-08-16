import { SyntaxToken, SyntaxTokenKind } from '../../lexer/tokens';
import {
  BlockExpressionNode,
  ElementDeclarationNode,
  ListExpressionNode,
  LiteralNode,
  PrefixExpressionNode,
  PrimaryExpressionNode,
  SyntaxNode,
  VariableNode,
} from '../../parser/nodes';
import { isAccessExpression, isHexChar } from '../../utils';
import { destructureComplexVariable, isBinaryRelationship } from '../utils';
import CustomValidator from './elementValidators/custom';
import EnumValidator from './elementValidators/enum';
import IndexesValidator from './elementValidators/indexes';
import NoteValidator from './elementValidators/note';
import ProjectValidator from './elementValidators/project';
import RefValidator from './elementValidators/ref';
import TableValidator from './elementValidators/table';
import TableGroupValidator from './elementValidators/tableGroup';
import { createSchemaSymbolId } from '../symbol/symbolIndex';
import { SchemaSymbol } from '../symbol/symbols';
import SymbolTable from '../symbol/symbolTable';

// Pick a validator suitable for `element`
export function pickValidator(element: ElementDeclarationNode) {
  switch (element.type.value.toLowerCase()) {
    case 'enum':
      return EnumValidator;
    case 'table':
      return TableValidator;
    case 'tablegroup':
      return TableGroupValidator;
    case 'project':
      return ProjectValidator;
    case 'ref':
      return RefValidator;
    case 'note':
      return NoteValidator;
    case 'indexes':
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
// `initialSchema` is the schema in which the first variable of `variables` is nested within
export function registerSchemaStack(variables: string[], initialSchema: SymbolTable): SymbolTable {
  let prevSchema = initialSchema;
  // eslint-disable-next-line no-restricted-syntax
  for (const curName of variables) {
    let curSchema: SymbolTable | undefined;
    const curId = createSchemaSymbolId(curName);

    if (!prevSchema.has(curId)) {
      curSchema = new SymbolTable();
      const curSymbol = new SchemaSymbol(curSchema);
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

export function isRelationshipOp(op: string): boolean {
  return op === '-' || op === '<>' || op === '>' || op === '<';
}

export function isValidColor(value?: SyntaxNode): boolean {
  if (
    !(value instanceof PrimaryExpressionNode) ||
    !(value.expression instanceof LiteralNode) ||
    !(value.expression.literal.kind === SyntaxTokenKind.COLOR_LITERAL)
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
  return (
    value === undefined ||
    (!Array.isArray(value) && value.end === -1 && value.start === -1) ||
    (Array.isArray(value) && value.length === 0)
  );
}

// Is the `value` a valid value for a column's `default` setting
// It's a valid only if it's a literal or a complex variable (potentially an enum member)
export function isValidDefaultValue(value?: SyntaxNode): boolean {
  if (value instanceof PrimaryExpressionNode && value.expression instanceof LiteralNode) {
    return true;
  }

  if (!value || Array.isArray(value) || !isAccessExpression(value)) {
    return false;
  }

  const variables = destructureComplexVariable(value).unwrap_or(undefined);

  return variables !== undefined && variables.length > 0;
}

export function isUnaryRelationship(value?: SyntaxNode): boolean {
  if (!(value instanceof PrefixExpressionNode)) {
    return false;
  }

  if (!isRelationshipOp(value.op.value)) {
    return false;
  }

  const variables = destructureComplexVariable(value.expression).unwrap_or(undefined);

  return variables !== undefined && variables.length > 0;
}

export { isBinaryRelationship };
