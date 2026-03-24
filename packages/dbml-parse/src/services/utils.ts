import type { TextModel, Position } from '@/services/types';
import { Filepath } from '@/compiler/projectLayout';
import { DEFAULT_ENTRY } from '@/compiler/constants';

export function getOffsetFromMonacoPosition (model: TextModel, position: Position): number {
  return model.getOffsetAt(position);
}

export function getFilepathFromModel (model: TextModel): Filepath {
  try {
    return Filepath.from(model.uri.path);
  } catch {
    return DEFAULT_ENTRY;
  }
}
