// Shared machinery for the Layer 1 conformance tests.
//
// Both parsers run over the same source text:
// - the reference parser (`@dbml/parse` lexer + parser from src/)
// - a parser generated at test time from spec/dbml-syntax.peggy
//
// They are compared on two things:
// 1. acceptance: the reference "accepts" when lexer and parser report no error;
//    the spec parser accepts when peggy does not throw.
// 2. tree shape: both trees are flattened to the same S-expression of node
//    kinds and token kinds, in source order, mirroring getMemberChain().
import { readFileSync } from 'node:fs';
import path from 'node:path';
import peggy from 'peggy';
import { getMemberChain } from '@/core/parser/utils';
import { SyntaxNode } from '@/core/types/nodes';
import { SyntaxToken } from '@/core/types/tokens';
import { parse } from '@tests/utils';

export const SPEC_DIR = path.resolve(__dirname, '../../../../spec');
export const GRAMMAR_PATH = path.join(SPEC_DIR, 'dbml-syntax.peggy');

export interface SpecToken {
  token: string;
  value: string;
}

export interface SpecNode {
  kind: string;
  children: (SpecNode | SpecToken)[];
}

export interface SpecParser {
  parse (input: string): SpecNode;
}

export type Verdict = 'accept' | 'reject';

export interface Outcome {
  verdict: Verdict;
  // Normalised tree, only when the verdict is `accept`.
  tree?: string;
  // Human-readable reason for a `reject`.
  detail?: string;
}

export interface Comparison {
  reference: Outcome;
  spec: Outcome;
  agreeOnVerdict: boolean;
  // Undefined when at least one side rejected.
  agreeOnTree?: boolean;
}

export function loadSpecParser (): SpecParser {
  const grammar = readFileSync(GRAMMAR_PATH, 'utf-8');
  return peggy.generate(grammar, {
    output: 'parser',
    grammarSource: GRAMMAR_PATH,
  }) as unknown as SpecParser;
}

function stripAngles (kind: string): string {
  return kind.replace(/^<|>$/g, '');
}

export function normalizeReference (node: SyntaxNode): string {
  const children = getMemberChain(node).map((child) => (
    child instanceof SyntaxToken
      ? `#${stripAngles(child.kind)}`
      : normalizeReference(child as SyntaxNode)
  ));
  return `(${[stripAngles(node.kind), ...children].join(' ')})`;
}

export function normalizeSpec (node: SpecNode): string {
  const children = node.children.map((child) => (
    'token' in child
      ? `#${stripAngles(child.token)}`
      : normalizeSpec(child)
  ));
  return `(${[stripAngles(node.kind), ...children].join(' ')})`;
}

export function runReference (source: string): Outcome {
  const report = parse(source);
  const errors = report.getErrors();
  if (errors.length > 0) {
    return {
      verdict: 'reject',
      detail: errors.map((e) => `${e.code} ${e.diagnostic} @${e.start}`).join('; '),
    };
  }
  return {
    verdict: 'accept',
    tree: normalizeReference(report.getValue().ast),
  };
}

export function runSpec (parser: SpecParser, source: string): Outcome {
  try {
    return {
      verdict: 'accept',
      tree: normalizeSpec(parser.parse(source)),
    };
  } catch (e) {
    return {
      verdict: 'reject',
      detail: e instanceof Error ? e.message.split('\n')[0] : String(e),
    };
  }
}

export function compare (parser: SpecParser, source: string): Comparison {
  const reference = runReference(source);
  const spec = runSpec(parser, source);
  const agreeOnVerdict = reference.verdict === spec.verdict;
  const agreeOnTree = reference.verdict === 'accept' && spec.verdict === 'accept'
    ? reference.tree === spec.tree
    : undefined;
  return {
    reference,
    spec,
    agreeOnVerdict,
    agreeOnTree,
  };
}

// Pretty-print a comparison for assertion messages.
export function describeComparison (source: string, c: Comparison): string {
  const lines = [
    `reference: ${c.reference.verdict}${c.reference.detail ? ` (${c.reference.detail})` : ''}`,
    `spec:      ${c.spec.verdict}${c.spec.detail ? ` (${c.spec.detail})` : ''}`,
  ];
  if (c.agreeOnTree === false) {
    lines.push(`reference tree: ${c.reference.tree}`, `spec tree:      ${c.spec.tree}`);
  }
  lines.push('source:', source);
  return lines.join('\n');
}
