import {
  DEFAULT_ENTRY,
} from '@/constants';
import {
  readFileSync,
} from 'node:fs';
import path from 'node:path';
import {
  describe, expect, it,
} from 'vitest';
import Lexer from '@/core/lexer/lexer';
import Parser from '@/core/parser/parser';
import type {
  ProgramNode,
} from '@/core/types/nodes';
import Analyzer from '@/core/analyzer/analyzer';
import {
  scanTestNames, toSnapshot, collectNodesWithReferee,
} from '@tests/utils';
import type Report from '@/core/types/report';
import Compiler from '@/compiler';
import {
  SymbolKind,
} from '@/core/types/symbol';
import type {
  NodeSymbol,
} from '@/core/types/symbol';

function serializeBinderResult (compiler: Compiler, report: Report<ProgramNode>): string {
  const value = report.getValue();
  const errors = report.getErrors();
  const warnings = report.getWarnings();
  const nodeReferees = collectNodesWithReferee(value);

  // FIXME: this snapshot manually splits the program's symbol table into
  // (named schemas at the top, public-schema members below) so the output
  // matches what we want long-term: named schemas owned by the program node and
  // the public schema only carrying non-schema members. The current analyzer
  // can't express that directly. The query-based-compiler rework will surface
  // this shape natively, at which point this loop can be replaced by a single
  // `compiler.symbolMembers(programSymbol)` walk.
  const programSymbol = value.symbol;
  const schemas: NodeSymbol[] = [];
  const publicSchemaMembers: NodeSymbol[] = [];
  if (programSymbol?.symbolTable) {
    for (const [, sym] of programSymbol.symbolTable.entries()) {
      if (sym.isKind(SymbolKind.Schema)) {
        schemas.push(sym);
      } else {
        publicSchemaMembers.push(sym);
      }
    }
  }

  return JSON.stringify(toSnapshot(compiler, {
    program: {
      schemas,
      publicSchema: publicSchemaMembers,
    } as any,
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
    compiler.setSource(program);

    const {
      // @ts-expect-error "Current workaround to use compiler but only trigger analyzer"
      nodeIdGenerator, symbolIdGenerator,
    } = compiler;

    const report = new Lexer(program, DEFAULT_ENTRY)
      .lex()
      .chain((tokens) => {
        return new Parser(program, tokens, nodeIdGenerator, DEFAULT_ENTRY).parse();
      })
      .chain(({
        ast,
      }) => {
        return new Analyzer(ast, symbolIdGenerator).analyze();
      });
    const output = serializeBinderResult(compiler, report);

    it(testName, () => expect(output).toMatchFileSnapshot(path.resolve(__dirname, `./output/${testName}.out.json`)));
  });
});
