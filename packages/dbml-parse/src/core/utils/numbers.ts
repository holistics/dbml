import {
  LiteralNode, PrefixExpressionNode, PrimaryExpressionNode,
} from '@/core/types/nodes';

export function getNumberTextFromExpression (node: PrimaryExpressionNode | PrefixExpressionNode): string {
  if (node instanceof PrefixExpressionNode) {
    return `${node.op?.value}${getNumberTextFromExpression(node.expression!)}`;
  }
  return (node.expression as LiteralNode).literal!.value;
}

export function parseNumber (node: PrefixExpressionNode | PrimaryExpressionNode): number {
  if (node instanceof PrefixExpressionNode) {
    const op = node.op?.value;
    if (op === '-') return -parseNumber(node.expression!);
    return parseNumber(node.expression!);
  }
  return Number.parseFloat((node.expression as LiteralNode).literal!.value);
}
