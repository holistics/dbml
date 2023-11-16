import type { TextModel, Position } from './types';

export function getOffsetFromMonacoPosition(model: TextModel, position: Position): number {
  return model.getOffsetAt(position);
}
