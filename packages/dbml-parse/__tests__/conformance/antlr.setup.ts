// vitest global setup: compile spec/antlr/*.g4 once before the conformance
// test files are collected.
import { generateAntlrParser } from './antlr';

export default function setup (): void {
  generateAntlrParser();
}
