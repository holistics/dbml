// Shared machinery for the Layer 1 conformance tests.
//
// The reference parser (`@dbml/parse` lexer + parser from src/) runs over the
// same source text as each spec parser:
// - `peggy`: generated at test time from spec/dbml-syntax.peggy
// - `antlr`: generated at test time from spec/antlr/*.g4 (see antlr.ts)
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
  // Short notation name used in test titles: 'peggy' or 'antlr'.
  name: string;
  parse (input: string): SpecNode;
}

export function tok (kind: string, value: string): SpecToken {
  return { token: kind, value };
}

type Child = SpecNode | SpecToken | Child[] | null | undefined;

function flattenChildren (children: Child[]): (SpecNode | SpecToken)[] {
  return children.flatMap((c) => {
    if (c === null || c === undefined) return [];
    if (Array.isArray(c)) return flattenChildren(c);
    return [c];
  });
}

export function node (kind: string, ...children: Child[]): SpecNode {
  return {
    kind,
    children: flattenChildren(children),
  };
}

function isIdentifierPrimary (n: SpecNode | SpecToken): n is SpecNode {
  if ('token' in n || n.kind !== '<primary-expression>') return false;
  const variable = n.children[0];
  if ('token' in variable || variable.kind !== '<variable>') return false;
  const token = variable.children[0];
  return 'token' in token && token.token === '<identifier>';
}

function identifierToken (n: SpecNode): SpecToken {
  return (n.children[0] as SpecNode).children[0] as SpecToken;
}

// parser/utils.ts: convertFuncAppToElem()
// A function application of the form <identifier> [<name> [as <alias>]] [<list>] <block>
// is reinterpreted as a nested element declaration. The peggy grammar carries
// its own copy of this rewrite in its actions; the ANTLR converter uses this one.
export function convertFuncAppToElem (callee: SpecNode, args: SpecNode[]): SpecNode | null {
  let type = callee;
  let rest = args;
  if (type.kind === '<call-expression>') {
    rest = [type.children[1] as SpecNode, ...rest];
    type = type.children[0] as SpecNode;
  }
  if (!isIdentifierPrimary(type) || rest.length === 0) return null;
  const typeToken = identifierToken(type);
  rest = [...rest];
  const body = rest.pop()!;
  if (body.kind !== '<block-expression>') return null;
  const attributeList = rest.length > 0 && rest[rest.length - 1].kind === '<list-expression>' ? rest.pop() : null;
  if (rest.length === 3) {
    if (!isIdentifierPrimary(rest[1]) || identifierToken(rest[1]).value.toLowerCase() !== 'as') return null;
    return node('<element-declaration>', typeToken, rest[0], identifierToken(rest[1]), rest[2], attributeList, body);
  }
  if (rest.length === 1) return node('<element-declaration>', typeToken, rest[0], attributeList, body);
  if (rest.length === 0) return node('<element-declaration>', typeToken, attributeList, body);
  return null;
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

export function loadPeggyParser (): SpecParser {
  const grammar = readFileSync(GRAMMAR_PATH, 'utf-8');
  const generated = peggy.generate(grammar, {
    output: 'parser',
    grammarSource: GRAMMAR_PATH,
  }) as unknown as { parse (input: string): SpecNode };
  return {
    name: 'peggy',
    parse: (input) => generated.parse(input),
  };
}

// Both notations of the spec. Kept in a separate module so that the ANTLR
// toolchain is only loaded when needed.
export async function loadSpecParsers (): Promise<SpecParser[]> {
  const { loadAntlrParser } = await import('./antlr');
  return [loadPeggyParser(), await loadAntlrParser()];
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
