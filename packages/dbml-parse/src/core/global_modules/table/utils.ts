import {
  ArrayNode,
  CallExpressionNode, ListExpressionNode,
  PrefixExpressionNode,
} from '@/core/types/nodes';
import type { SyntaxNode } from '@/core/types/nodes';
import type { ColumnType, InlineRef } from '@/core/types/schemaJson';
import {
  destructureComplexVariable, destructureComplexVariableTuple,
  extractQuotedStringToken, extractVariableFromExpression,
} from '@/core/utils/expression';
import { getTokenPosition } from '@/core/utils/interpret';
import {
  isExpressionASignedNumberExpression,
  isRelationshipOp,
  isBinaryRelationship,
  isExpressionAQuotedString,
  isExpressionAVariableNode,
} from '@/core/utils/validate';
import { getNumberTextFromExpression } from '@/core/utils/numbers';

export function interpretColumnType (typeNode?: SyntaxNode): ColumnType {
  // Skip ListExpressionNode (settings bracket [pk, ...]) - it's not a type
  let rawTypeNode: SyntaxNode | undefined = typeNode instanceof ListExpressionNode ? undefined : typeNode;
  let columnType: ColumnType = {
    schemaName: null,
    type_name: '',
    args: null,
  };

  if (rawTypeNode) {
    let typeSuffix = '';
    let typeArguments: string | null = null;

    // First pass: extract top-level call args (e.g. varchar(255))
    if (rawTypeNode instanceof CallExpressionNode && rawTypeNode.argumentList) {
      typeArguments = rawTypeNode.argumentList.elementList.map((element) => {
        if (isExpressionASignedNumberExpression(element)) return getNumberTextFromExpression(element);
        if (isExpressionAQuotedString(element)) return extractQuotedStringToken(element) ?? '';
        if (isExpressionAVariableNode(element)) return element.expression.variable.value;
        return '';
      }).join(',');
      typeSuffix = `(${typeArguments})`;
      rawTypeNode = rawTypeNode.callee;
    }

    // Remaining passes: handle nested calls and array brackets
    while (rawTypeNode instanceof CallExpressionNode || rawTypeNode instanceof ArrayNode) {
      if (rawTypeNode instanceof CallExpressionNode) {
        const args = rawTypeNode.argumentList?.elementList.map((element) => {
          if (isExpressionASignedNumberExpression(element)) return getNumberTextFromExpression(element);
          if (isExpressionAQuotedString(element)) return extractQuotedStringToken(element) ?? '';
          if (isExpressionAVariableNode(element)) return element.expression.variable.value;
          return '';
        }).join(',') ?? '';
        typeSuffix = `(${args})${typeSuffix}`;
        rawTypeNode = rawTypeNode.callee;
      } else {
        const indexer = `[${rawTypeNode.indexer?.elementList.map((element) => (element?.name as any)?.expression?.literal?.value ?? '').join(',') ?? ''}]`;
        typeSuffix = `${indexer}${typeSuffix}`;
        rawTypeNode = rawTypeNode.array;
      }
    }

    const typeFragments = rawTypeNode ? destructureComplexVariable(rawTypeNode) : undefined;
    if (typeFragments && typeFragments.length > 0) {
      const typeName = typeFragments.at(-1) ?? '';
      const typeSchema = typeFragments.length > 1 ? typeFragments.slice(0, -1).join('.') : null;
      columnType = {
        schemaName: typeSchema,
        type_name: `${typeName}${typeSuffix}`,
        args: typeArguments,
      };
    } else if (rawTypeNode) {
      // Fallback: use the raw text of the type node when it can't be destructured as a variable
      const rawText = extractQuotedStringToken(rawTypeNode) ?? extractVariableFromExpression(rawTypeNode) ?? 'unknown';
      columnType = {
        schemaName: null,
        type_name: `${rawText}${typeSuffix}`,
        args: typeArguments,
      };
    }
  }

  return columnType;
}

export function interpretInlineRefs (refs: any[]): InlineRef[] {
  const inlineRefs: InlineRef[] = [];

  for (const ref of refs) {
    if (!ref.value) continue;

    if (isBinaryRelationship(ref.value)) {
      const op = ref.value.op?.value;
      const rightTuple = destructureComplexVariableTuple(ref.value.rightExpression);
      if (rightTuple && op && isRelationshipOp(op)) {
        const variables = rightTuple.variables;
        const tableName = variables.map((variable) => variable.expression.variable?.value ?? '').at(-1) ?? '';
        const schemaName = variables.length > 1 ? variables.slice(0, -1).map((variable) => variable.expression.variable?.value ?? '').join('.') : null;
        const fieldNames = rightTuple.tupleElements.length > 0
          ? rightTuple.tupleElements.map((element) => element.expression.variable?.value ?? '')
          : [];
        inlineRefs.push({
          schemaName,
          tableName,
          fieldNames,
          relation: op,
          token: getTokenPosition(ref),
        });
      }
    } else if (ref.value instanceof PrefixExpressionNode && isRelationshipOp(ref.value.op?.value)) {
      // Handle prefix form: `ref: > users.id`
      const op = ref.value.op.value as '>' | '<' | '-' | '<>';
      const targetTuple = destructureComplexVariableTuple(ref.value.expression);
      if (targetTuple) {
        const variables = targetTuple.variables.map((variable) => variable.expression.variable?.value ?? '');
        let tableName: string;
        let schemaName: string | null;
        let fieldNames: string[];

        if (targetTuple.tupleElements.length > 0) {
          tableName = variables.at(-1) ?? '';
          schemaName = variables.length > 1 ? variables.slice(0, -1).join('.') : null;
          fieldNames = targetTuple.tupleElements.map((element) => element.expression.variable?.value ?? '');
        } else {
          // table.column or schema.table.column
          fieldNames = variables.length > 0
            ? [
                variables.at(-1)!,
              ]
            : [];
          tableName = variables.length > 1 ? variables.at(-2)! : '';
          schemaName = variables.length > 2 ? variables.slice(0, -2).join('.') : null;
        }
        inlineRefs.push({
          schemaName,
          tableName,
          fieldNames,
          relation: op,
          token: getTokenPosition(ref),
        });
      }
    }
  }

  return inlineRefs;
}
