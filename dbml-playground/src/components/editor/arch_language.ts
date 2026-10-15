import consoleLogger from '@/utils/logger';
import {
  archLanguageConfiguration, archMonarchTokensProvider, archThemeRules,
} from '@dbml/arch';
import * as monaco from 'monaco-editor';

/**
 * A SECOND LANGUAGE, BECAUSE THE FIRST ONE CANNOT DO THIS ONE.
 *
 * Pointing DBML's tokenizer at an architecture file highlights almost nothing — it knows
 * `table`, `ref`, `pk` and a hundred SQL type names, and this dialect has none of them. Worse,
 * it knows some of them loosely: `text`, `set` and `image` are DBML data types and perfectly
 * ordinary words here, so the few things that did light up lit up wrongly.
 *
 * The grammar and the colours both live in `@dbml/arch`, beside the vocabulary they describe.
 * This file is only the registration, which is Monaco's business and not the language's.
 */
export class ArchLanguageService {
  private static readonly LANGUAGE_ID = 'dbml-arch';
  private static readonly THEME_NAME = 'dbml-arch-theme';
  private static isRegistered = false;

  // safe to call more than once
  public static registerLanguage (): void {
    if (this.isRegistered) return;

    try {
      monaco.languages.register({ id: this.LANGUAGE_ID });

      monaco.languages.setMonarchTokensProvider(
        this.LANGUAGE_ID,
        archMonarchTokensProvider as unknown as monaco.languages.IMonarchLanguage,
      );
      monaco.languages.setLanguageConfiguration(
        this.LANGUAGE_ID,
        archLanguageConfiguration as unknown as monaco.languages.LanguageConfiguration,
      );

      monaco.editor.defineTheme(this.THEME_NAME, {
        base: 'vs',
        inherit: true,
        rules: archThemeRules as monaco.editor.ITokenThemeRule[],
        colors: {},
      });

      this.isRegistered = true;
    } catch (error) {
      consoleLogger.warn('Failed to register the architecture language:', error);
    }
  }

  public static getLanguageId (): string {
    return this.LANGUAGE_ID;
  }

  public static getThemeName (): string {
    return this.THEME_NAME;
  }
}
