import { DEFAULT_SCHEMA_NAME } from '@/constants';
import { getMetadataTargetKind } from '@/core/local_modules/metadata/utils';
import { mapNamePartToSymbolKind, NameWithSymbolKind } from '@/core/global_modules/metadata/utils';
import { getDefaultSchemaSymbol, getProgramSymbol } from '@/core/global_modules/utils';
import { MetadataTargetKind, SymbolKind, type NodeSymbol } from '@/core/types/symbol';
import type { MetadataElementMetadata } from '@/core/types/symbol/metadata';
import { destructureComplexVariable } from '@/core/utils/expression';
import type Compiler from '../../index';

function lookupSymbol (compiler: Compiler, startSymbol: NodeSymbol, namePartAndSymbolKind: NameWithSymbolKind[]): NodeSymbol | undefined {
  if (!namePartAndSymbolKind.length) return undefined;

  const { name, symbolKind } = namePartAndSymbolKind[0];
  const symbol = compiler.lookupMembers(startSymbol, symbolKind, name);

  if (namePartAndSymbolKind.length > 1 && symbol) return lookupSymbol(compiler, symbol, namePartAndSymbolKind.slice(1));

  return symbol;
}

/**
  * Resolve the candidates a Metadata block targets, from its `<target-kind> <name>` header.
  */
export function metadataTargets (this: Compiler, block: MetadataElementMetadata): NodeSymbol[] {
  const metadataNode = block.declaration;

  const programSymbol = getProgramSymbol(this, metadataNode.filepath);
  if (!programSymbol) return [];

  const targetKind = getMetadataTargetKind(metadataNode);
  const nameParts = destructureComplexVariable(metadataNode.name);
  if (!nameParts?.length || !targetKind) return [];

  if (targetKind === MetadataTargetKind.Ref) {
    if (nameParts.length !== 1) return [];

    return this.visibleSymbols(programSymbol, SymbolKind.Ref).filter((ref) => ref.name === nameParts[0]);
  }

  const namePartAndSymbolKind = mapNamePartToSymbolKind(nameParts, targetKind);
  const { name: startName, symbolKind: startSymbolKind } = namePartAndSymbolKind[0];

  if (startName === DEFAULT_SCHEMA_NAME && startSymbolKind === SymbolKind.Schema) {
    const defaultSchema = getDefaultSchemaSymbol(this, programSymbol);
    if (defaultSchema) {
      const target = lookupSymbol(this, defaultSchema, namePartAndSymbolKind.slice(1));
      return target ? [target] : [];
    }
  }
  const target = lookupSymbol(this, programSymbol, namePartAndSymbolKind);

  return target ? [target] : [];
}
