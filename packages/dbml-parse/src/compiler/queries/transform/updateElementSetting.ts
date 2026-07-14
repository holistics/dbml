import { DEFAULT_SCHEMA_NAME } from '@/constants';
import { Filepath } from '@/core/types/filepath';
import { SymbolKind } from '@/core/types/symbol';
import type Compiler from '../../index';
import { applyTextEdits } from './applyTextEdits';
import { updateSettingEdit } from '@/core/utils/setting';
import type { ElementIdentifier } from './types';
import { lookupElementSymbol } from './utils';

// Updates, creates, or removes a setting on the element identified by `target`.
// value: string - create or update the setting with this value
// value: undefined - name-only setting (e.g. `[pk]`)
// value: null - remove the setting
// Returns the new source, or the original if nothing changed.
export function updateElementSetting (
  this: Compiler,
  filepath: Filepath,
  target: ElementIdentifier,
  settingName: string,
  value: string | null | undefined,
): string {
  const source = this.getSource(filepath) ?? '';

  const kind = target.kind as SymbolKind;
  const schema = ('schema' in target ? target.schema : undefined) ?? DEFAULT_SCHEMA_NAME;
  const name = 'table' in target ? target.table : ('name' in target ? target.name : '');

  const symbol = lookupElementSymbol(this, filepath, schema, name, kind);
  if (!symbol?.declaration) return source;

  const edit = updateSettingEdit(symbol.declaration, settingName, value, source);
  if (!edit) return source;

  return applyTextEdits(source, [
    edit,
  ]);
}
