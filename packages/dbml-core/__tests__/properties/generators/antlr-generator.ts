/**
 * ANTLR-based SQL Generator using antlr4-c3
 *
 * This module provides utilities for generating valid SQL statements
 * based on ANTLR grammar rules using the antlr4-c3 code completion library.
 */

import * as antlr4 from 'antlr4';
import { CodeCompletionCore } from 'antlr4-c3';
import * as fc from 'fast-check';

/**
 * Grammar configuration for different SQL dialects
 */
export interface GrammarConfig {
  lexerClass: any;
  parserClass: any;
  startRule: string;
  grammarPath: string;
}

/**
 * Generate candidates for the next token based on current parser state
 */
export function getTokenCandidates (
  parser: any,
  lexer: any,
  caretPosition: number,
): { tokens: Set<number>; rules: Map<number, number[]> } {
  const core = new CodeCompletionCore(parser);

  // Ignore certain tokens that don't contribute to SQL structure
  core.ignoredTokens = new Set([
    antlr4.Token.EOF,
  ]);

  const candidates = core.collectCandidates(caretPosition);

  return {
    tokens: candidates.tokens,
    rules: candidates.rules,
  };
}

/**
 * Generate a random valid SQL statement based on grammar rules
 *
 * This is a simplified implementation that generates basic SQL structures.
 * For more complex generation, we'll rely on fast-check arbitraries.
 */
export function generateFromGrammar (
  config: GrammarConfig,
  maxDepth: number = 5,
): string {
  // This is a placeholder for grammar-based generation
  // In practice, generating valid SQL from ANTLR grammars is complex
  // and requires traversing the grammar rules systematically

  // For now, we'll use this as a validation helper and rely on
  // fast-check arbitraries for actual generation
  throw new Error('Direct grammar generation not yet implemented. Use fast-check arbitraries instead.');
}

/**
 * Validate if a SQL string is parseable by the given grammar
 */
export function validateWithGrammar (
  sql: string,
  lexerClass: any,
  parserClass: any,
  startRule: string,
): { valid: boolean; errors: any[] } {
  try {
    const chars = new antlr4.InputStream(sql);
    const lexer = new lexerClass(chars);
    const tokens = new antlr4.CommonTokenStream(lexer);
    const parser = new parserClass(tokens);

    // Collect errors
    const errors: any[] = [];
    const errorListener = {
      syntaxError: (recognizer: any, offendingSymbol: any, line: number, column: number, msg: string, e: any) => {
        errors.push({ line, column, msg, offendingSymbol });
      },
    };

    parser.removeErrorListeners();
    parser.addErrorListener(errorListener);

    // Parse using the start rule
    parser[startRule]();

    return {
      valid: errors.length === 0,
      errors,
    };
  } catch (error) {
    return {
      valid: false,
      errors: [{ msg: (error as Error).message }],
    };
  }
}

/**
 * Create a fast-check arbitrary that generates SQL validated by the grammar
 */
export function validatedSqlArbitrary (
  sqlGenerator: fc.Arbitrary<string>,
  lexerClass: any,
  parserClass: any,
  startRule: string,
): fc.Arbitrary<string> {
  return sqlGenerator.filter((sql) => {
    const result = validateWithGrammar(sql, lexerClass, parserClass, startRule);
    return result.valid;
  });
}

/**
 * Grammar configurations for supported SQL dialects
 */
export const GRAMMAR_CONFIGS = {
  mysql: {
    grammarPath: '../../../src/parse/ANTLR/parsers/mysql',
    startRule: 'root',
  },
  postgres: {
    grammarPath: '../../../src/parse/ANTLR/parsers/postgresql',
    startRule: 'root',
  },
  mssql: {
    grammarPath: '../../../src/parse/ANTLR/parsers/mssql',
    startRule: 'tsql_file',
  },
  snowflake: {
    grammarPath: '../../../src/parse/ANTLR/parsers/snowflake',
    startRule: 'snowflake_file',
  },
};
