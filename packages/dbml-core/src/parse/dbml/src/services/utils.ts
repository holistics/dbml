import { Position } from 'monaco-editor-core';
import { TextModel } from './types';

export function getOffsetFromMonacoPosition(model: TextModel, position: Position): number {
  return model.getOffsetAt(position);
}
