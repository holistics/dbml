import { Filepath } from '@/core/types/filepath';
import type Compiler from '../../index';
import type { TextEdit } from './applyTextEdits';
import type { EndpointRef } from './types';
import { formatEndpoint } from './utils';

/**
 * Adds `Ref: left op right` at the end of the file. `op` is a relationship operator such as `>`, `<`, `-` or `<>`.
 */
export function createRefEdit (
  this: Compiler,
  filepath: Filepath,
  left: EndpointRef,
  op: string,
  right: EndpointRef,
): TextEdit[] {
  const source = this.getSource(filepath) ?? '';
  return [
    {
      start: source.length,
      end: source.length,
      newText: `\n\nRef: ${formatEndpoint(left)} ${op} ${formatEndpoint(right)}\n`,
    },
  ];
}
