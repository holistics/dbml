/**
 * Reactive DBML Parser
 *
 * A reactive wrapper around ParserService that handles state management, debouncing,
 * and Vue reactivity. This separates reactive concerns from core parsing logic.
 *
 * Design Principles Applied:
 * - Single Responsibility: Only handles reactivity and state management
 * - Information Hiding: Hides debouncing and state management complexity
 * - General Purpose: Can be used with any reactive framework
 */
import { ref, computed, watch, type Ref } from 'vue';
import { ParserService } from './parser-service';
import type { ReactiveParserOptions, ParserResult } from '@/types';
import consoleLogger from '@/utils/logger';

/**
 * Reactive DBML Parser
 *
 * Provides reactive access to DBML parsing with automatic debouncing and state management.
 */
export class ReactiveParser {
  private readonly parserService: ParserService;
  private readonly debounceMs: number;
  private debounceTimer: number | null = null;

  // Reactive state
  public readonly input: Ref<string>;
  public readonly isLoading: Ref<boolean>;
  private readonly parseResult: Ref<ParserResult>;

  // Computed reactive outputs
  public readonly success = computed(() => this.parseResult.value.success);
  public readonly errors = computed(() => this.parseResult.value.errors);
  public readonly hasErrors = computed(() => this.parseResult.value.errors.length > 0);

  // Stage outputs
  public readonly lexerOutput = computed(() => this.parseResult.value.outputs.lexer);
  public readonly parserOutput = computed(() => this.parseResult.value.outputs.parser);
  public readonly analyzerOutput = computed(() => this.parseResult.value.outputs.analyzer);
  public readonly interpreterOutput = computed(() => this.parseResult.value.outputs.interpreter);

  constructor (options: ReactiveParserOptions) {
    this.parserService = new ParserService();
    this.debounceMs = options.debounceMs;

    // Initialize reactive state
    this.input = ref(options.initialContent);
    this.isLoading = ref(false);
    this.parseResult = ref(this.createEmptyResult());

    // Set up reactive parsing
    this.setupReactiveParsing();
  }

  /**
   * Get output for a specific pipeline stage
   */
  public getStageOutput (stage: 'lexer' | 'parser' | 'analyzer' | 'interpreter'): unknown {
    return this.parseResult.value.outputs[stage];
  }

  /**
   * Manually trigger parsing (bypasses debouncing)
   */
  public parseNow (): void {
    this.performParse(this.input.value);
  }

  /**
   * Set up reactive parsing with debouncing
   */
  private setupReactiveParsing (): void {
    watch(this.input, (newInput) => {
      this.debouncedParse(newInput);
    }, { immediate: true });
  }

  /**
   * Parse with debouncing to avoid excessive parsing during typing
   */
  private debouncedParse (input: string): void {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = window.setTimeout(() => {
      this.performParse(input);
    }, this.debounceMs);
  }

  /**
   * Perform the actual parsing operation
   */
  private performParse (input: string): void {
    this.isLoading.value = true;

    try {
      // Use microtask to ensure loading state is visible
      Promise.resolve().then(() => {
        const result = this.parserService.parse(input);
        this.parseResult.value = result;
        this.isLoading.value = false;
      });
    } catch (error) {
      consoleLogger.error('Unexpected parsing error:', error);
      this.parseResult.value = this.createErrorResult(error);
      this.isLoading.value = false;
    }
  }

  /**
   * Create an empty result for initialization
   */
  private createEmptyResult (): ParserResult {
    return {
      success: false,
      outputs: {
        lexer: null,
        parser: null,
        analyzer: null,
        interpreter: null,
      },
      errors: [],
    };
  }

  /**
   * Create error result for unexpected failures
   */
  private createErrorResult (error: unknown): ParserResult {
    const message = error instanceof Error ? error.message : 'Unexpected error';

    return {
      success: false,
      outputs: {
        lexer: null,
        parser: null,
        analyzer: null,
        interpreter: null,
      },
      errors: [{
        code: -1,
        message,
        location: { line: 1, column: 1 },
      }],
    };
  }
}
