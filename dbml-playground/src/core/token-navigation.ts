/**
 * Token Navigation Event System
 *
 * Handles smart navigation events between lexer tokens and DBML editor positions.
 * Only responds to intentional user actions (Cmd+Click, button clicks) to avoid
 * interference with normal editing workflows.
 *
 * Design Principles Applied:
 * - Single Responsibility: Only handles navigation events
 * - Information Hiding: Event coordination logic is encapsulated
 * - Pull Complexity Downwards: Complex event filtering handled internally
 */
import * as monaco from 'monaco-editor'
import { TokenMappingService, type Token } from './token-mapping'

export interface TokenNavigationEvents {
  'navigate:token-to-dbml': { tokenIndex: number; modifier: 'cmd' | 'ctrl' | 'button' }
  'navigate:dbml-to-token': { line: number; column: number; modifier: 'cmd' | 'ctrl' }
  'navigate:range-to-tokens': { startLine: number; startCol: number; endLine: number; endCol: number }
}

export type TokenNavigationEventType = keyof TokenNavigationEvents

export class TokenNavigationEventBus extends EventTarget {
  emit<K extends TokenNavigationEventType>(
    event: K,
    data: TokenNavigationEvents[K]
  ): void {
    this.dispatchEvent(new CustomEvent(event, { detail: data }))
  }

  on<K extends TokenNavigationEventType>(
    event: K,
    handler: (data: TokenNavigationEvents[K]) => void
  ): void {
    this.addEventListener(event, (e) => handler((e as CustomEvent).detail))
  }

  off<K extends TokenNavigationEventType>(
    event: K,
    handler: (data: TokenNavigationEvents[K]) => void
  ): void {
    this.removeEventListener(event, handler as unknown as EventListener)
  }
}

export class TokenNavigationCoordinator {
  private eventBus: TokenNavigationEventBus
  private tokenMapping: TokenMappingService
  private dbmlEditor: monaco.editor.IStandaloneCodeEditor | null = null
  private lexerViewer: any = null // Will be set by the JsonViewer component
  private isNavigating = false // Prevent circular navigation

  // Injected functions to check application state
  private getCurrentStage: (() => string) | null = null
  private getLexerViewMode: (() => string) | null = null
  private setLexerViewMode: ((mode: string) => void) | null = null

  constructor(tokenMapping: TokenMappingService) {
    this.eventBus = new TokenNavigationEventBus()
    this.tokenMapping = tokenMapping
    this.setupEventHandlers()
  }

  /**
   * Set the DBML editor instance
   */
  public setDbmlEditor(editor: monaco.editor.IStandaloneCodeEditor): void {
    this.dbmlEditor = editor
    this.setupDbmlEditorEvents()
  }

  /**
   * Set the lexer viewer instance
   */
  public setLexerViewer(viewer: any): void {
    this.lexerViewer = viewer
  }

  /**
   * Set application state accessors for view mode checking
   */
  public setAppStateAccessors(
    getCurrentStage: () => string,
    getLexerViewMode: () => string,
    setLexerViewMode: (mode: string) => void
  ): void {
    this.getCurrentStage = getCurrentStage
    this.getLexerViewMode = getLexerViewMode
    this.setLexerViewMode = setLexerViewMode
  }

  /**
   * Update token mapping with new tokens
   */
  public updateTokenMapping(tokens: Token[]): void {
    this.tokenMapping.buildMaps(tokens)
  }

  /**
   * Get the event bus for external use
   */
  public getEventBus(): TokenNavigationEventBus {
    return this.eventBus
  }

  /**
   * Navigate from token to DBML (triggered by button click or Cmd+Click in JSON)
   */
  public navigateToDbmlFromToken(tokenIndex: number, modifier: 'cmd' | 'ctrl' | 'button' = 'button'): void {
    this.eventBus.emit('navigate:token-to-dbml', { tokenIndex, modifier })
  }

  /**
   * Navigate from DBML position to token (triggered by Cmd+Click in DBML)
   */
  public navigateToTokenFromDbml(line: number, column: number, modifier: 'cmd' | 'ctrl' = 'cmd'): void {
    // Only allow navigation if we're in the lexer stage
    if (!this.isInLexerStage()) {
      return
    }

    // If in JSON mode, switch to Cards mode first and wait for the transition
    if (this.isInLexerJsonMode()) {
      this.switchToCardsMode()
      // Wait for view mode transition to complete before navigating
      setTimeout(() => {
        this.eventBus.emit('navigate:dbml-to-token', { line, column, modifier })
      }, 50) // Small delay to ensure view mode switch completes
      return
    }

    this.eventBus.emit('navigate:dbml-to-token', { line, column, modifier })
  }

  /**
   * Navigate from DBML range to tokens (triggered by Cmd+Selection in DBML)
   */
  public navigateToTokensFromRange(startLine: number, startCol: number, endLine: number, endCol: number): void {
    // Only allow navigation if we're in the lexer stage
    if (!this.isInLexerStage()) {
      return
    }

    // If in JSON mode, switch to Cards mode first and wait for the transition
    if (this.isInLexerJsonMode()) {
      this.switchToCardsMode()
      // Wait for view mode transition to complete before navigating
      setTimeout(() => {
        this.eventBus.emit('navigate:range-to-tokens', { startLine, startCol, endLine, endCol })
      }, 50) // Small delay to ensure view mode switch completes
      return
    }

    this.eventBus.emit('navigate:range-to-tokens', { startLine, startCol, endLine, endCol })
  }

  /**
   * Check if currently in lexer stage
   */
  private isInLexerStage(): boolean {
    return this.getCurrentStage?.() === 'lexer'
  }

  /**
   * Check if currently in lexer JSON mode
   */
  private isInLexerJsonMode(): boolean {
    return this.getLexerViewMode?.() === 'json'
  }

  /**
   * Switch lexer to Cards mode
   */
  private switchToCardsMode(): void {
    this.setLexerViewMode?.('cards')
  }

  /**
   * Setup event handlers for navigation coordination
   */
  private setupEventHandlers(): void {
    // Token → DBML navigation
    this.eventBus.on('navigate:token-to-dbml', ({ tokenIndex, modifier }) => {
      if (this.isNavigating) return
      this.highlightTokenInDbml(tokenIndex)
    })

    // DBML → Token navigation
    this.eventBus.on('navigate:dbml-to-token', ({ line, column, modifier }) => {
      if (this.isNavigating) return
      this.highlightTokenInLexer(line, column)
    })

    // DBML Range → Tokens navigation
    this.eventBus.on('navigate:range-to-tokens', ({ startLine, startCol, endLine, endCol }) => {
      if (this.isNavigating) return
      this.highlightTokensInLexer(startLine, startCol, endLine, endCol)
    })
  }

  /**
   * Setup DBML editor event listeners for smart navigation
   */
  private setupDbmlEditorEvents(): void {
    if (!this.dbmlEditor) return

    // Cmd/Ctrl + Click navigation
    this.dbmlEditor.onMouseDown((e) => {
      if (this.isIntentionalNavigation(e.event)) {
        const position = e.target.position
        if (position) {
          this.navigateToTokenFromDbml(
            position.lineNumber,
            position.column,
            this.getPlatformModifierKey()
          )
        }
      }
    })

    // Cmd/Ctrl + Selection navigation
    this.dbmlEditor.onMouseUp((e) => {
      if (this.isIntentionalNavigation(e.event)) {
        const selection = this.dbmlEditor?.getSelection()
        if (selection && !selection.isEmpty()) {
          this.navigateToTokensFromRange(
            selection.startLineNumber,
            selection.startColumn,
            selection.endLineNumber,
            selection.endColumn
          )
        }
      }
    })

    // Optional: Keyboard shortcut (Cmd/Ctrl+J to jump to token)
    this.dbmlEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyJ, () => {
      const position = this.dbmlEditor?.getPosition()
      if (position) {
        this.navigateToTokenFromDbml(position.lineNumber, position.column)
      }
    })

    // Add visual feedback for navigation mode
    this.setupNavigationModeVisuals()
  }

  /**
   * Highlight token in DBML editor
   */
  private highlightTokenInDbml(tokenIndex: number): void {
    if (!this.dbmlEditor) return

    const range = this.tokenMapping.getRangeForToken(tokenIndex)
    if (!range) return

    this.isNavigating = true

    try {
      // Set selection and reveal range
      this.dbmlEditor.setSelection(range)
      this.dbmlEditor.revealRangeInCenter(range)

      // Add temporary highlight decoration
      const decorations = this.dbmlEditor.createDecorationsCollection([
        {
          range: range,
          options: {
            className: 'token-navigation-highlight',
            inlineClassName: 'token-navigation-highlight-inline'
          }
        }
      ])

      // Clear highlight after 2 seconds
      setTimeout(() => {
        decorations.clear()
      }, 2000)

    } finally {
      // Reset navigation flag after a brief delay
      setTimeout(() => {
        this.isNavigating = false
      }, 100)
    }
  }

  /**
   * Highlight token in lexer viewer
   */
  private highlightTokenInLexer(line: number, column: number): void {
    const tokenIndex = this.tokenMapping.getTokenAtPosition(line, column)
    if (tokenIndex === null || !this.lexerViewer) return

    this.isNavigating = true

    try {
      // Scroll to and highlight the token in JSON viewer
      this.lexerViewer.scrollToToken(tokenIndex)
      this.lexerViewer.highlightToken(tokenIndex)

    } finally {
      // Reset navigation flag after a brief delay
      setTimeout(() => {
        this.isNavigating = false
      }, 100)
    }
  }

  /**
   * Highlight multiple tokens in lexer viewer from a range
   */
  private highlightTokensInLexer(startLine: number, startCol: number, endLine: number, endCol: number): void {
    const tokenIndices = this.tokenMapping.getTokensInRange(startLine, startCol, endLine, endCol)
    if (tokenIndices.length === 0 || !this.lexerViewer) return

    this.isNavigating = true

    try {
      // Highlight multiple tokens in JSON viewer
      this.lexerViewer.highlightTokens(tokenIndices)

    } finally {
      // Reset navigation flag after a brief delay
      setTimeout(() => {
        this.isNavigating = false
      }, 100)
    }
  }

  /**
   * Check if the event is an intentional navigation action
   * Uses Cmd on macOS and Ctrl on Windows/Linux
   */
  private isIntentionalNavigation(event: any): boolean {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
    return isMac ? event.metaKey : event.ctrlKey
  }

  /**
   * Get the appropriate modifier key name for the current platform
   */
  private getPlatformModifierKey(): 'cmd' | 'ctrl' {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
    return isMac ? 'cmd' : 'ctrl'
  }

  /**
   * Setup visual feedback for navigation mode
   */
  private setupNavigationModeVisuals(): void {
    if (!this.dbmlEditor) return

    const editorDomNode = this.dbmlEditor.getDomNode()
    if (!editorDomNode) return

    // Track modifier keys to show navigation mode (platform-specific)
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0

    document.addEventListener('keydown', (e) => {
      const isModifierPressed = isMac ? e.metaKey : e.ctrlKey
      if (isModifierPressed && this.shouldShowNavigationMode()) {
        editorDomNode.classList.add('token-navigation-mode')
      }
    })

    document.addEventListener('keyup', (e) => {
      const isModifierPressed = isMac ? e.metaKey : e.ctrlKey
      if (!isModifierPressed) {
        editorDomNode.classList.remove('token-navigation-mode')
      }
    })

    // Add CSS for navigation mode
    this.addNavigationStyles()
  }

  /**
   * Check if navigation mode visual feedback should be shown
   */
  private shouldShowNavigationMode(): boolean {
    return this.isInLexerStage()
  }

  /**
   * Add CSS styles for navigation feedback
   */
  private addNavigationStyles(): void {
    const existingStyle = document.getElementById('token-navigation-styles')
    if (existingStyle) return

    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
    const modifierKey = isMac ? '⌘' : 'Ctrl'

    const style = document.createElement('style')
    style.id = 'token-navigation-styles'
    style.textContent = `
      /* Navigation mode cursor */
      .monaco-editor.token-navigation-mode {
        cursor: pointer !important;
      }

      .monaco-editor.token-navigation-mode .view-line {
        cursor: pointer !important;
      }

      /* Token highlight in DBML editor */
      .token-navigation-highlight {
        background-color: rgba(0, 122, 204, 0.2) !important;
        border: 1px solid rgba(0, 122, 204, 0.6) !important;
        border-radius: 2px !important;
        animation: tokenNavigationPulse 0.6s ease-in-out;
      }

      .token-navigation-highlight-inline {
        background-color: rgba(0, 122, 204, 0.15) !important;
      }

      @keyframes tokenNavigationPulse {
        0% {
          background-color: rgba(0, 122, 204, 0.1) !important;
        }
        50% {
          background-color: rgba(0, 122, 204, 0.3) !important;
        }
        100% {
          background-color: rgba(0, 122, 204, 0.2) !important;
        }
      }

      /* Hover hint */
      .monaco-editor.token-navigation-mode::after {
        content: "${modifierKey}+Click to navigate to token";
        position: absolute;
        top: 10px;
        right: 10px;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 11px;
        pointer-events: none;
        z-index: 1000;
      }
    `
    document.head.appendChild(style)
  }
}