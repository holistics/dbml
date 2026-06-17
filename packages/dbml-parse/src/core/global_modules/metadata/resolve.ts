import { DEFAULT_SCHEMA_NAME } from '@/constants';
import type Compiler from '@/compiler/index';
import { ElementDeclarationNode } from '@/core/types/nodes';
import { NodeSymbol, SymbolKind, MetadataTargetKind } from '@/core/types/symbol';
import { destructureComplexVariable } from '@/core/utils/expression';
import { getDefaultSchemaSymbol, getGlobalSymbol } from '../utils';
import { getElementSubKind } from '@/core/utils/validate';
import { Filepath } from '@/core/types';

type NameWithSymbolKind = {
  name: string;
  symbolKind: SymbolKind;
};

function lookupSymbol (compiler: Compiler, startSymbol: NodeSymbol, namePartAndSymbolKind: NameWithSymbolKind[]): NodeSymbol | undefined {
  if (!namePartAndSymbolKind.length) return undefined;

  const { name, symbolKind } = namePartAndSymbolKind[0];
  const symbol = compiler.lookupMembers(startSymbol, symbolKind, name);

  if (namePartAndSymbolKind.length > 1 && symbol) return lookupSymbol(compiler, symbol, namePartAndSymbolKind.slice(1));

  return symbol;
}

const METADATA_TARGET_KIND_PARENT_AND_SYMBOL_KIND_MAP: Record<MetadataTargetKind, { parentKind: MetadataTargetKind; symbolKind: SymbolKind }> = {
  [MetadataTargetKind.Column]: { parentKind: MetadataTargetKind.Table, symbolKind: SymbolKind.Column },
  [MetadataTargetKind.Table]: { parentKind: MetadataTargetKind.Schema, symbolKind: SymbolKind.Table },
  [MetadataTargetKind.Schema]: { parentKind: MetadataTargetKind.Schema, symbolKind: SymbolKind.Schema },
  [MetadataTargetKind.Note]: { parentKind: MetadataTargetKind.Schema, symbolKind: SymbolKind.StickyNote },
  [MetadataTargetKind.TableGroup]: { parentKind: MetadataTargetKind.Schema, symbolKind: SymbolKind.TableGroup },
};

function mapNamePartToSymbolKind (nameParts: string[], targetKind: MetadataTargetKind): NameWithSymbolKind[] {
  if (nameParts.length === 0) return [];

  if (nameParts.length === 1 && targetKind === MetadataTargetKind.Schema && nameParts[0] === DEFAULT_SCHEMA_NAME) return [];

  const { parentKind, symbolKind } = METADATA_TARGET_KIND_PARENT_AND_SYMBOL_KIND_MAP[targetKind];

  return [
    ...mapNamePartToSymbolKind(nameParts.slice(0, -1), parentKind),
    { name: nameParts.at(-1)!, symbolKind },
  ];
}

// Resolve the target element a Metadata declaration annotates, from its
// `<subKind> <qualified-name>` header. Returns undefined if it does not exist.
export function resolveMetadataTarget (compiler: Compiler, metadataNode: ElementDeclarationNode): NodeSymbol | undefined {
  const globalSymbol = getGlobalSymbol(compiler, metadataNode.filepath);
  if (!globalSymbol) return undefined;

  const subKind = getElementSubKind(metadataNode.getElementKind(), metadataNode.subKind);
  const nameParts = destructureComplexVariable(metadataNode.name);
  if (!nameParts?.length || !subKind) return undefined;

  const namePartAndSymbolKind = mapNamePartToSymbolKind(nameParts, subKind);

  const { name: startName, symbolKind: startSymbolKind } = namePartAndSymbolKind[0];

  if (startName === DEFAULT_SCHEMA_NAME && startSymbolKind === SymbolKind.Schema) {
    const defaultSchema = getDefaultSchemaSymbol(compiler, globalSymbol);
    if (defaultSchema) return lookupSymbol(compiler, defaultSchema, namePartAndSymbolKind.slice(1));
  }

  return lookupSymbol(compiler, globalSymbol, namePartAndSymbolKind);
}
