// Re-export all test utilities from a single entry point

// Mocks for testing services
export {
  createPosition,
  MockTextModel,
  createMockTextModel,
  extractTextFromRange,
} from './mocks';

// Test helpers for snapshot testing
export {
  scanTestNames,
  serialize,
} from './testHelpers';

// Compiler utilities for property testing
export {
  lex,
  parse,
  analyze,
  interpret,
  flattenTokens,
  print,
} from './compiler';
