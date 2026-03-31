import type Compiler from '@/compiler';
import { Filepath } from '@/compiler/projectLayout';
import { NodeToSymbolMap } from '@/core/analyzer/analyzer';
import { InternedMap } from '@/core/internable';
import Validator from '@/core/analyzer/validator/validator';
import SymbolFactory from '@/core/analyzer/symbol/factory';
import { NodeSymbol, SchemaSymbol } from '@/core/analyzer/symbol/symbols';
import Report from '@/core/report';
import type { SymbolKind } from '@/core/analyzer/symbol/symbolIndex';
import type { SyntaxNode } from '@/core/parser/nodes';

export type SelectiveUseInfo = {
  readonly kind: SymbolKind;
  readonly name: string; // original name in source file
  readonly localName: string; // alias or same as name
  readonly filepath: Filepath; // resolved external filepath
  readonly reexport: boolean;
  readonly declaration: SyntaxNode;
  readonly schemaPath: string[]; // for schema-qualified imports like public.users
};

export type WildcardUseInfo = {
  readonly filepath: Filepath;
  readonly reexport: boolean;
  readonly declaration: SyntaxNode;
};

export type FileValidateIndex = {
  readonly publicSchemaSymbol: SchemaSymbol;
  readonly nodeToSymbol: InternedMap<SyntaxNode, NodeSymbol>;
  readonly selectiveUses: SelectiveUseInfo[];
  readonly wildcardUses: WildcardUseInfo[];
};

export function validateFile (compiler: Compiler, filepath: Filepath): Report<FileValidateIndex> {
  const nodeToSymbol: NodeToSymbolMap = new InternedMap();
  return compiler.parseFile(filepath).chain(({ ast }) => {
    const symbolFactory = new SymbolFactory(compiler.symbolIdGenerator, filepath);
    return new Validator({ ast }, { nodeToSymbol }, symbolFactory).validate().map((result) => {
      const publicSchemaSymbol = nodeToSymbol.get(ast) as SchemaSymbol;
      return {
        publicSchemaSymbol,
        nodeToSymbol,
        selectiveUses: result.selectiveUses,
        wildcardUses: result.wildcardUses,
      };
    });
  });
}
