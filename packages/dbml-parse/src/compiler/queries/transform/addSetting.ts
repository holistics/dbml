import { FunctionApplicationNode, ListExpressionNode } from '@/core/types/nodes';
import type { SyntaxNode } from '@/core/types/nodes';
import type { Filepath } from '@/core/types/filepath';
import type Compiler from '../../index';
import { type TextEdit, applyTextEdits } from './applyTextEdits';

/**
 * Produces a TextEdit that adds a setting to a field/element declaration.
 * If the declaration already has a settings block [...], inserts before the closing ].
 * Otherwise, appends a new [setting] block.
 */
export function addSettingEdit (declaration: SyntaxNode, setting: string): TextEdit | undefined {
  if (declaration instanceof FunctionApplicationNode) {
    const settingsList = declaration.args.find((a) => a instanceof ListExpressionNode);
    if (settingsList) {
      const insertOffset = settingsList.end - 1;
      return { start: insertOffset, end: insertOffset, newText: `, ${setting}` };
    }
  }

  return { start: declaration.end, end: declaration.end, newText: ` [${setting}]` };
}

/**
 * Adds a setting to a field/element declaration and returns the updated source.
 */
export function addSetting (
  this: Compiler,
  filepath: Filepath,
  declaration: SyntaxNode,
  setting: string,
): string | undefined {
  const source = this.getSource(filepath);
  if (!source) return undefined;

  const edit = addSettingEdit(declaration, setting);
  if (!edit) return undefined;

  return applyTextEdits(source, [
    edit,
  ]);
}
