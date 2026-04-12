import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ProgramNode } from '@/core/types/nodes';
import { scanTestNames, toSnapshot, collectNodesWithReferee } from '@tests/utils';
import Compiler from '@/compiler';
import { DEFAULT_ENTRY, UNHANDLED } from '@/constants';
import { SymbolKind } from '@/core/types/symbol';
import type { NodeSymbol } from '@/core/types/symbol';

function serializeBinderResult (compiler: Compiler, ast: ProgramNode): string {
  const errors = compiler.parse.errors();
  const warnings = compiler.parse.warnings();
  const nodeReferees = collectNodesWithReferee(compiler, ast);

  // Simulate module-system-3 structure:
  // - Named schemas live at "program" level
  // - Public schema only contains non-schema members
  const programSymbol = compiler.nodeSymbol(ast).getFiltered(UNHANDLED);
  const schemas: NodeSymbol[] = [];
  const publicSchemaMembers: NodeSymbol[] = [];
  if (programSymbol) {
    const symbolTable = compiler.symbolMembers(programSymbol).getFiltered(UNHANDLED);
    if (symbolTable) {
      for (const [, sym] of symbolTable.entries()) {
        if (sym.isKind(SymbolKind.Schema)) {
          schemas.push(sym);
        } else {
          publicSchemaMembers.push(sym);
        }
      }
    }
  }

  return JSON.stringify(toSnapshot(compiler, {
    program: {
      schemas,
      publicSchema: publicSchemaMembers,
    },
    nodeReferees,
    errors,
    warnings,
  }), null, 2);
}

describe('[snapshot] binder', () => {
  const testNames = scanTestNames(path.resolve(__dirname, './input/'));

  testNames.forEach((testName) => {
    const program = readFileSync(path.resolve(__dirname, `./input/${testName}.in.dbml`), 'utf-8');

    const compiler = new Compiler();
    compiler.setSource(DEFAULT_ENTRY, program);

    const ast = compiler.parseFile(DEFAULT_ENTRY).getValue().ast;
    const output = serializeBinderResult(compiler, ast);

    it(testName, () => expect(output).toMatchFileSnapshot(path.resolve(__dirname, `./output/${testName}.out.json`)));
  });
});
