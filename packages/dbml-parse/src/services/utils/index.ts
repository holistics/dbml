import type {
  SyntaxNode,
} from '@/core/types/nodes';
import {
  SyntaxToken,
} from '@/core/types/tokens';
import type {
  Position, Range, TextModel,
} from '@/services/types';

export {
  extractReferee,
} from '@/core/global_modules/utils';

export function getOffsetFromMonacoPosition (model: TextModel, position: Position): number {
  return model.getOffsetAt(position);
}

export function getEditorRange (model: TextModel, nodeOrToken: SyntaxNode | SyntaxToken): Range {
  const {
    startPos,
    endPos,
  } = nodeOrToken;

  return {
    startLineNumber: startPos.line + 1,
    startColumn: startPos.column + 1,
    endLineNumber: endPos.line + 1,
    endColumn: endPos.column + 1,
  };
}
