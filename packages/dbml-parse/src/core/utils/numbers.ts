import { LiteralNode, PrefixExpressionNode, PrimaryExpressionNode } from '@/core/types/nodes';

export function getNumberTextFromExpression (node: PrimaryExpressionNode | PrefixExpressionNode): string {
  if (node instanceof PrefixExpressionNode) {
    return `${node.op?.value}${getNumberTextFromExpression(node.expression!)}`;
  }
  return (node.expression as LiteralNode).literal!.value;
}

export function extractNumber (node: PrefixExpressionNode | PrimaryExpressionNode): number {
  if (node instanceof PrefixExpressionNode) {
    const op = node.op?.value;
    if (op === '-') return -extractNumber(node.expression!);
    return extractNumber(node.expression!);
  }
  return Number.parseFloat((node.expression as LiteralNode).literal!.value);
}
