/**
 * DBML Language Support for Monaco Editor
 *
 * A deep module that encapsulates all DBML language definition complexity
 * for Monaco Editor. This module handles syntax highlighting, tokenization,
 * and language configuration while hiding implementation details.
 *
 * Design Principles Applied:
 * - Deep Module: Complex language definition with simple interface
 * - Information Hiding: Monaco-specific details are completely hidden
 * - Single Responsibility: Only handles DBML language support
 * - Pull Complexity Downwards: All Monaco complexity handled internally
 */
import consoleLogger from '@/utils/logger';
import {
  dbmlLanguageConfig,
  dbmlMonarchTokensProvider,
} from '@dbml/parse';
import * as monaco from 'monaco-editor';

// Language config + Monarch token provider live in @dbml/parse so the playground
// and downstream editors stay in lock-step with the language definition.
const DBML_LANGUAGE_CONFIG = dbmlLanguageConfig as monaco.languages.LanguageConfiguration;

const DBML_TOKEN_PROVIDER = dbmlMonarchTokensProvider as monaco.languages.IMonarchLanguage;

/**
 * DBML Theme Definition - Extends the default 'vs' theme
 */
const DBML_THEME: monaco.editor.IStandaloneThemeData = {
  base: 'vs',
  inherit: true,
  rules: [
    // Override default rules to add DBML-specific styling
    {
      token: 'keyword',
      foreground: '0000ff',
      fontStyle: 'bold',
    },
    {
      token: 'type',
      foreground: '008000',
      fontStyle: 'bold',
    },
    {
      token: 'string',
      foreground: 'a31515',
    },
    {
      token: 'string.backtick',
      foreground: 'a31515',
      fontStyle: 'italic',
    },
    {
      token: 'comment',
      foreground: '008000',
      fontStyle: 'italic',
    },
    {
      token: 'number',
      foreground: '098658',
    },
    {
      token: 'number.hex',
      foreground: '3030c0',
    },
    {
      token: 'operator',
      foreground: '000000',
    },
    {
      token: 'delimiter',
      foreground: '000000',
    },
    {
      token: 'annotation',
      foreground: '808080',
    },
    {
      token: 'identifier',
      foreground: '000000',
    },

    // Ensure JSON tokens also use consistent styling
    {
      token: 'string.key.json',
      foreground: '0451a5',
    },
    {
      token: 'string.value.json',
      foreground: 'a31515',
    },
    {
      token: 'number.json',
      foreground: '098658',
    },
    {
      token: 'keyword.json',
      foreground: '0000ff',
    },
  ],
  colors: {},
};

/**
 * DBML Language Service
 *
 * Provides a simple interface for registering DBML language support
 * in Monaco Editor. All complexity is hidden within this module.
 */
export class DBMLLanguageService {
  private static readonly LANGUAGE_ID = 'dbml';
  private static readonly THEME_NAME = 'dbml-theme';
  private static isRegistered = false;

  /**
   * Register DBML language support in Monaco Editor
   *
   * This method is idempotent - multiple calls are safe.
   */
  public static registerLanguage (): void {
    if (this.isRegistered) {
      return;
    }

    try {
      // Register the language
      monaco.languages.register({
        id: this.LANGUAGE_ID,
      });

      // Set token provider for syntax highlighting
      monaco.languages.setMonarchTokensProvider(this.LANGUAGE_ID, DBML_TOKEN_PROVIDER);

      // Set language configuration
      monaco.languages.setLanguageConfiguration(this.LANGUAGE_ID, DBML_LANGUAGE_CONFIG);

      // Define DBML theme
      monaco.editor.defineTheme(this.THEME_NAME, DBML_THEME);

      this.isRegistered = true;
    } catch (error) {
      consoleLogger.warn('Failed to register DBML language:', error);
    }
  }

  /**
   * Get the DBML language identifier
   */
  public static getLanguageId (): string {
    return this.LANGUAGE_ID;
  }

  /**
   * Get the DBML theme name
   */
  public static getThemeName (): string {
    return this.THEME_NAME;
  }

  /**
   * Check if DBML language is registered
   */
  public static isLanguageRegistered (): boolean {
    return this.isRegistered;
  }
}
