import type { Database, ElementRef } from '@/core/types/schemaJson';
import { type NodeSymbol, SymbolKind } from '@/core/types/symbol';

export function pushExternal (db: Database, member: NodeSymbol, ref: ElementRef): void {
  if (member.isKind(SymbolKind.Table)) db.externals.tables.push(ref);
  else if (member.isKind(SymbolKind.Enum)) db.externals.enums.push(ref);
  else if (member.isKind(SymbolKind.TableGroup)) db.externals.tableGroups.push(ref);
  else if (member.isKind(SymbolKind.TablePartial)) db.externals.tablePartials.push(ref);
  else if (member.isKind(SymbolKind.StickyNote)) db.externals.notes.push(ref);
}
