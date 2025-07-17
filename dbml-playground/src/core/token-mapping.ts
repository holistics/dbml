/**
 * Token Mapping Service
 *
 * Provides bidirectional mapping between lexer tokens and DBML editor positions.
 * This service enables navigation between the JSON lexer view and the DBML editor.
 *
 * Design Principles Applied:
 * - Deep Module: Complex mapping logic with simple interface
 * - Information Hiding: Internal mapping structures are hidden
 * - Single Responsibility: Only handles token-position mapping
 */
import * as monaco from 'monaco-editor'

export interface Token {
  kind: string
  value: string
  position: {
    line: number
    column: number
  }
}

export interface TokenMetadata {
  tokenIndex: number
  kind: string
  value: string
  startPosition: { line: number; column: number }
  endPosition: { line: number; column: number }
  monacoRange: monaco.Range
}

export interface LexerToDbmlMap {
  // Maps token index to Monaco editor range
  tokenToRange: Map<number, monaco.Range>
  // Maps token index to additional metadata
  tokenMetadata: Map<number, TokenMetadata>
}

export interface DbmlToLexerMap {
  // Maps position key to token index
  // Key format: "line:column" (e.g., "1:5" for line 1, column 5)
  positionToToken: Map<string, number>
  // Efficient range lookup for cursor position
  positionLookup: Array<{
    line: number
    ranges: Array<{
      startColumn: number
      endColumn: number
      tokenIndex: number
    }>
  }>
}

export class TokenMappingService {
  private tokens: Token[] = []
  private lexerToDbml: LexerToDbmlMap = {
    tokenToRange: new Map(),
    tokenMetadata: new Map()
  }
  private dbmlToLexer: DbmlToLexerMap = {
    positionToToken: new Map(),
    positionLookup: []
  }

  /**
   * Build mapping tables from lexer tokens
   */
  public buildMaps(tokens: Token[]): void {
    this.tokens = tokens
    this.clearMaps()
    this.buildLexerToDbmlMap()
    this.buildDbmlToLexerMap()
  }

  /**
   * Get Monaco range for a specific token index
   */
  public getRangeForToken(tokenIndex: number): monaco.Range | null {
    return this.lexerToDbml.tokenToRange.get(tokenIndex) || null
  }

  /**
   * Get token metadata for a specific token index
   */
  public getTokenMetadata(tokenIndex: number): TokenMetadata | null {
    return this.lexerToDbml.tokenMetadata.get(tokenIndex) || null
  }

  /**
   * Find token index at a specific DBML position
   */
  public getTokenAtPosition(line: number, column: number): number | null {
    // Try exact position lookup first
    const positionKey = this.createPositionKey(line, column)
    const exactMatch = this.dbmlToLexer.positionToToken.get(positionKey)
    if (exactMatch !== undefined) {
      return exactMatch
    }

    // Search for token containing this position
    const lineData = this.dbmlToLexer.positionLookup.find(l => l.line === line)
    if (!lineData) return null

    // Find the range that contains this column
    for (const range of lineData.ranges) {
      if (column >= range.startColumn && column < range.endColumn) {
        return range.tokenIndex
      }
    }

    return null
  }

  /**
   * Get all tokens within a range
   */
  public getTokensInRange(
    startLine: number,
    startColumn: number,
    endLine: number,
    endColumn: number
  ): number[] {
    const tokensInRange: number[] = []

    this.tokens.forEach((token, index) => {
      const tokenStart = token.position
      const tokenLength = this.calculateTokenLength(token)
      const tokenEnd = {
        line: token.position.line,
        column: token.position.column + tokenLength
      }

      // Check if token overlaps with the selected range
      if (this.rangesOverlap(
        { startLine, startColumn, endLine, endColumn },
        {
          startLine: tokenStart.line,
          startColumn: tokenStart.column,
          endLine: tokenEnd.line,
          endColumn: tokenEnd.column
        }
      )) {
        tokensInRange.push(index)
      }
    })

    return tokensInRange
  }

  /**
   * Get total number of tokens
   */
  public getTokenCount(): number {
    return this.tokens.length
  }

  /**
   * Get all tokens
   */
  public getTokens(): readonly Token[] {
    return this.tokens
  }

  /**
   * Clear all mapping data
   */
  private clearMaps(): void {
    this.lexerToDbml.tokenToRange.clear()
    this.lexerToDbml.tokenMetadata.clear()
    this.dbmlToLexer.positionToToken.clear()
    this.dbmlToLexer.positionLookup = []
  }

  /**
   * Build lexer to DBML mapping
   */
  private buildLexerToDbmlMap(): void {
    this.tokens.forEach((token, index) => {
      const range = this.calculateTokenRange(token)
      const tokenLength = this.calculateTokenLength(token)
      const metadata: TokenMetadata = {
        tokenIndex: index,
        kind: token.kind,
        value: token.value,
        startPosition: token.position,
        endPosition: {
          line: token.position.line,
          column: token.position.column + tokenLength
        },
        monacoRange: range
      }

      this.lexerToDbml.tokenToRange.set(index, range)
      this.lexerToDbml.tokenMetadata.set(index, metadata)
    })
  }

  /**
   * Build DBML to lexer mapping
   */
  private buildDbmlToLexerMap(): void {
    // Group tokens by line for efficient lookup
    const tokensByLine = new Map<number, Array<{
      startColumn: number
      endColumn: number
      tokenIndex: number
    }>>()

    this.tokens.forEach((token, index) => {
      const line = token.position.line
      const startColumn = token.position.column
      const tokenLength = this.calculateTokenLength(token)
      const endColumn = token.position.column + tokenLength

      if (!tokensByLine.has(line)) {
        tokensByLine.set(line, [])
      }

      tokensByLine.get(line)!.push({
        startColumn,
        endColumn,
        tokenIndex: index
      })

      // Create position mappings for each character in the token
      for (let col = startColumn; col < endColumn; col++) {
        const positionKey = this.createPositionKey(line, col)
        this.dbmlToLexer.positionToToken.set(positionKey, index)
      }
    })

    // Create sorted position lookup table
    this.dbmlToLexer.positionLookup = Array.from(tokensByLine.entries())
      .map(([line, ranges]) => ({
        line,
        ranges: ranges.sort((a, b) => a.startColumn - b.startColumn)
      }))
      .sort((a, b) => a.line - b.line)
  }

  /**
   * Calculate Monaco Range for a token
   */
  private calculateTokenRange(token: Token): monaco.Range {
    const tokenLength = this.calculateTokenLength(token)
    return new monaco.Range(
      token.position.line,
      token.position.column,
      token.position.line,
      token.position.column + tokenLength
    )
  }

  /**
   * Calculate the actual length of a token in the DBML source
   * Accounts for quotes around certain token types
   */
  private calculateTokenLength(token: Token): number {
    // These token types are always wrapped in quotes in the DBML source:
    // - <variable>: double-quoted values like "schema name"
    // - <string>: single-quoted values like 'string value' or '''multiline'''
    // - Any value containing spaces gets quoted regardless of type
    if (
      token.kind === '<variable>' ||
      token.kind === '<string>' ||
      token.value.includes(' ')
    ) {
      return token.value.length + 2
    }
    return token.value.length
  }

  /**
   * Create position key for mapping
   */
  private createPositionKey(line: number, column: number): string {
    return `${line}:${column}`
  }

  /**
   * Check if two ranges overlap
   */
  private rangesOverlap(
    range1: { startLine: number; startColumn: number; endLine: number; endColumn: number },
    range2: { startLine: number; startColumn: number; endLine: number; endColumn: number }
  ): boolean {
    // Handle single line case
    if (range1.startLine === range1.endLine && range2.startLine === range2.endLine) {
      if (range1.startLine !== range2.startLine) return false
      return range1.startColumn < range2.endColumn && range2.startColumn < range1.endColumn
    }

    // Multi-line overlap logic
    if (range1.endLine < range2.startLine || range2.endLine < range1.startLine) {
      return false
    }

    return true
  }
}