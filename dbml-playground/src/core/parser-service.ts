/**
 * DBML Parser Service
 *
 * A deep module that encapsulates all DBML parsing complexity behind a simple interface.
 * This service handles parsing, error management, and output formatting while hiding
 * implementation details from consumers.
 *
 * Design Principles Applied:
 * - Deep Module: Simple interface, powerful functionality
 * - Information Hiding: Internal parser details are completely hidden
 * - Pull Complexity Downwards: Complex logic handled internally
 */
import { Compiler } from '@dbml/parse'
import type { ParserError, ParserResult } from '@/types'
import consoleLogger from '@/utils/logger'

/**
 * DBML Parser Service
 *
 * Provides a simple interface for parsing DBML and accessing pipeline outputs.
 * All complexity is encapsulated within this module.
 */
export class ParserService {
  private readonly compiler: Compiler

  constructor() {
    this.compiler = new Compiler()
  }

  /**
   * Parse DBML input and return structured results
   *
   * @param input DBML source code
   * @returns Complete parsing results with all pipeline stages
   */
  public parse(input: string): ParserResult {
    try {
      this.compiler.setSource(input)

      const tokens = this.compiler.parse.tokens() || []
      const ast = this.compiler.parse.ast()
      const errors = this.compiler.parse.errors() || []

      // Only attempt JSON generation if no errors exist
      let json = null
      if (errors.length === 0) {
        try {
          // Use type assertion to access rawDb method that exists at runtime
          json = (this.compiler.parse as any).rawDb()
        } catch (err) {
          // Silent failure for JSON generation - errors will be captured separately
          consoleLogger.warn('JSON generation failed:', err)
        }
      }

      return {
        success: errors.length === 0,
        outputs: {
          lexer: this.formatTokensForDisplay(tokens),
          parser: this.formatASTForDisplay(ast),
          analyzer: this.formatASTForDisplay(ast), // Same as parser in current implementation
          interpreter: this.formatJSONForDisplay(json)
        },
        errors: this.formatErrorsForDisplay(errors)
      }
    } catch (error) {
      return this.createErrorResult(error)
    }
  }

  /**
   * Format tokens for display while hiding internal structure
   */
  private formatTokensForDisplay(tokens: any[]): unknown {
    return tokens
      .filter(token => token.kind !== 'EOF')
      .map(token => ({
        kind: token.kind,
        value: token.value,
        position: {
          line: (token.startPos?.line ?? 0) + 1,
          column: (token.startPos?.column ?? 0) + 1
        }
      }))
  }

  /**
   * Format AST for display while removing circular references and noise
   */
  private formatASTForDisplay(ast: any): unknown {
    if (!ast) return null

    return JSON.parse(JSON.stringify(ast, (key, value) => {
      // Hide internal implementation details
      if (['parent', 'symbol', 'referee', 'id'].includes(key)) {
        return undefined
      }
      return value
    }))
  }

  /**
   * Format JSON output for display with NO FILTERING
   * Playground should show the raw interpreter output exactly as it is
   */
  private formatJSONForDisplay(json: any): unknown {
    if (!json) return null

    // Return the raw JSON exactly as the interpreter provides it
    // NO FILTERING - playground needs to show everything for debugging
    return json
  }

  /**
   * Format errors for display with consistent structure
   */
  private formatErrorsForDisplay(errors: any[]): readonly ParserError[] {
    return errors.map(error => ({
      code: error.code,
      message: error.message,
      location: {
        line: (error.nodeOrToken?.startPos?.line ?? 0) + 1,
        column: (error.nodeOrToken?.startPos?.column ?? 0) + 1
      }
    }))
  }

  /**
   * Create a structured error result for unexpected failures
   */
  private createErrorResult(error: unknown): ParserResult {
    const message = error instanceof Error ? error.message : 'Unknown parsing error'

    return {
      success: false,
      outputs: {
        lexer: null,
        parser: null,
        analyzer: null,
        interpreter: null
      },
      errors: [{
        code: -1,
        message,
        location: { line: 1, column: 1 }
      }]
    }
  }
}