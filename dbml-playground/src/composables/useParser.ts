/**
 * DBML Parser Composable
 * 
 * A simple Vue composable that provides reactive DBML parsing capabilities.
 * This composable now delegates complex logic to dedicated services, following
 * the principle of building deep modules with simple interfaces.
 * 
 * Design Principles Applied:
 * - Shallow Module: Simple interface that delegates to deep modules
 * - Single Responsibility: Only handles Vue composable concerns
 * - Information Hiding: Complex parsing logic is hidden in services
 */
import { computed } from 'vue'
import { ReactiveParser } from '@/core/reactive-parser'
import { DEFAULT_SAMPLE_CONTENT } from '@/core/sample-content'
import type { ParserError, PipelineStage } from '@/types'

/**
 * DBML Parser Composable
 * 
 * Provides reactive DBML parsing with a simple, Vue-friendly interface.
 * All complex logic is delegated to specialized services.
 */
export function useParser() {
  // Create reactive parser with default configuration
  const reactiveParser = new ReactiveParser({
    debounceMs: 300,
    initialContent: DEFAULT_SAMPLE_CONTENT
  })

  /**
   * Get formatted output for a specific pipeline stage
   */
  const getStageOutput = (stage: PipelineStage): unknown => {
    return reactiveParser.getStageOutput(stage)
  }

  /**
   * Get formatted output as JSON string for display
   */
  const getStageOutputString = (stage: PipelineStage): string => {
    const output = getStageOutput(stage)
    return output ? JSON.stringify(output, null, 2) : 'Select a stage to view output'
  }

  /**
   * Format errors for display with proper location information
   */
  const formatErrors = (errors: readonly ParserError[]): Array<{
    code: number
    message: string
    location: { line: number; column: number }
  }> => {
    return errors.map(error => ({
      code: error.code,
      message: error.message,
      location: error.location
    }))
  }

  return {
    // Reactive inputs
    dbmlInput: reactiveParser.input,
    
    // Reactive state
    isLoading: reactiveParser.isLoading,
    
    // Computed outputs
    success: reactiveParser.success,
    errors: reactiveParser.errors,
    hasErrors: reactiveParser.hasErrors,
    
    // Stage outputs
    tokens: reactiveParser.lexerOutput,
    ast: reactiveParser.parserOutput,
    analyzedAst: reactiveParser.analyzerOutput,
    json: reactiveParser.interpreterOutput,
    
    // Convenience methods
    getStageOutput,
    getStageOutputString,
    formatErrors,
    
    // Direct methods
    parseNow: () => reactiveParser.parseNow()
  }
} 