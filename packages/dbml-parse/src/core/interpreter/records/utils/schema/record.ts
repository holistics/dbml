import {
  BlockExpressionNode,
  ElementDeclarationNode,
  FunctionApplicationNode,
} from '@/core/parser/nodes';

// Collect data rows from a records element
export function collectRows (element: ElementDeclarationNode): FunctionApplicationNode[] {
  const rows: FunctionApplicationNode[] = [];
  if (element.body instanceof BlockExpressionNode) {
    for (const row of element.body.body) {
      if (row instanceof FunctionApplicationNode) {
        rows.push(row);
      }
    }
  } else if (element.body instanceof FunctionApplicationNode) {
    rows.push(element.body);
  }
  return rows;
}
