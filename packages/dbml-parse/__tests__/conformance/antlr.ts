// ANTLR notation of the Layer 1 spec (spec/antlr/*.g4).
//
// The grammars are compiled with antlr-ng (a Node port of the ANTLR tool, no
// Java needed) for the JavaScript target, which runs on the same `antlr4`
// runtime @dbml/core uses. Generation happens in the vitest global setup
// (antlr.setup.ts) into ./generated/antlr, which is not committed.
//
// ANTLR produces a parse tree shaped like the grammar rules, so this file also
// converts that tree into the same { kind, children } spec nodes the peggy
// grammar builds directly. The element reinterpretation of a function
// application (parser/utils.ts: convertFuncAppToElem) is applied here.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import antlr4 from 'antlr4';
import {
  type SpecNode,
  type SpecParser,
  type SpecToken,
  SPEC_DIR,
  convertFuncAppToElem,
  node,
  tok,
} from './harness';

export const ANTLR_GRAMMAR_DIR = path.join(SPEC_DIR, 'antlr');
export const ANTLR_OUTPUT_DIR = path.resolve(__dirname, 'generated/antlr');

const GRAMMARS = ['DbmlLexer.g4', 'DbmlParser.g4'];

function isStale (): boolean {
  const outputs = ['DbmlLexer.js', 'DbmlParser.js'].map((f) => path.join(ANTLR_OUTPUT_DIR, f));
  if (!outputs.every(existsSync)) return true;
  const newestGrammar = Math.max(...GRAMMARS.map((g) => statSync(path.join(ANTLR_GRAMMAR_DIR, g)).mtimeMs));
  const oldestOutput = Math.min(...outputs.map((o) => statSync(o).mtimeMs));
  return newestGrammar > oldestOutput;
}

// antlr-ng only exposes an ESM entry point, so `require.resolve` cannot find
// it; locate its CLI by walking up the node_modules chain instead.
function findAntlrNgRunner (): string {
  for (let dir = __dirname; ; dir = path.dirname(dir)) {
    const candidate = path.join(dir, 'node_modules/antlr-ng/dist/cli/runner.js');
    if (existsSync(candidate)) return candidate;
    if (path.dirname(dir) === dir) throw new Error('antlr-ng is not installed');
  }
}

// Compile spec/antlr/*.g4 to JavaScript with antlr-ng. Idempotent: skipped
// when the generated files are newer than the grammars.
export function generateAntlrParser (): void {
  if (!isStale()) return;
  mkdirSync(ANTLR_OUTPUT_DIR, { recursive: true });
  const runner = findAntlrNgRunner();
  const run = (grammar: string) => execFileSync(process.execPath, [
    runner,
    '-Dlanguage=JavaScript',
    '-o',
    ANTLR_OUTPUT_DIR,
    '--lib',
    ANTLR_OUTPUT_DIR,
    '--generate-listener',
    'false',
    path.join(ANTLR_GRAMMAR_DIR, grammar),
  ], { stdio: 'pipe' });
  // The parser needs the lexer's .tokens file, so generate in order.
  GRAMMARS.forEach(run);
}

// The bundled runtime keeps the error strategies under `antlr4.error`, which
// its type definitions do not declare.
const runtime = antlr4 as unknown as typeof antlr4 & { error: { BailErrorStrategy: new () => unknown } };

// Minimal view of the antlr4 JavaScript runtime's tree types.
interface Terminal {
  symbol: { type: number; text: string };
}
interface RuleNode {
  ruleIndex: number;
  children?: (RuleNode | Terminal)[] | null;
  getText (): string;
}
type Tree = RuleNode | Terminal;

function isTerminal (t: Tree): t is Terminal {
  return 'symbol' in t;
}

// Map ANTLR token types onto the reference SyntaxTokenKind names.
const TOKEN_KINDS: Record<string, string> = {
  IDENTIFIER: '<identifier>',
  USE: '<identifier>',
  REUSE: '<identifier>',
  FROM: '<identifier>',
  AS: '<identifier>',
  METADATA: '<identifier>',
  QUOTED_VARIABLE: '<variable>',
  STRING: '<string>',
  NUMBER: '<number>',
  COLOR: '<color>',
  FUNCTION_EXPRESSION: '<function-expression>',
  WILDCARD: '<wildcard>',
  LPAREN: '<lparen>',
  RPAREN: '<rparen>',
  LBRACKET: '<lbracket>',
  RBRACKET: '<rbracket>',
  LBRACE: '<lbrace>',
  RBRACE: '<rbrace>',
  COMMA: '<comma>',
  COLON: '<colon>',
  EOF: '<eof>',
};

class TreeConverter {
  constructor (private ruleNames: string[], private symbolicNames: (string | null)[]) {}

  token (t: Terminal): SpecToken {
    const name = t.symbol.type === antlr4.Token.EOF ? 'EOF' : this.symbolicNames[t.symbol.type] ?? '';
    return tok(TOKEN_KINDS[name] ?? '<op>', t.symbol.text);
  }

  kids (ctx: RuleNode): Tree[] {
    return ctx.children ?? [];
  }

  // Convert a child that is either a token or a rule wrapping a single token.
  leafToken (t: Tree): SpecToken {
    if (isTerminal(t)) return this.token(t);
    return this.leafToken(this.kids(t)[0]);
  }

  // Fold `head (op operand)*` into left-associative infix nodes.
  foldInfix (ctx: RuleNode): SpecNode {
    const kids = this.kids(ctx);
    let left = this.convert(kids[0]) as SpecNode;
    for (let i = 1; i < kids.length; i += 2) {
      left = node('<infix-expression>', left, this.leafToken(kids[i]), this.convert(kids[i + 1]));
    }
    return left;
  }

  // Fold postfix steps (callStep, chainStep, indexStep, memberStep) onto a head.
  foldSteps (head: SpecNode, steps: Tree[]): SpecNode {
    return steps.reduce<SpecNode>((left, step) => {
      const rule = this.ruleNames[(step as RuleNode).ruleIndex];
      const inner = this.kids(step as RuleNode);
      switch (rule) {
        case 'chainStep': return this.foldSteps(left, inner);
        case 'callStep': return node('<call-expression>', left, this.convert(inner[0]));
        case 'indexStep': return node('<array>', left, this.convert(inner[0]));
        case 'memberStep': return node('<infix-expression>', left, this.leafToken(inner[0]), this.convert(inner[1]));
        default: throw new Error(`unexpected postfix step ${rule}`);
      }
    }, head);
  }

  convertAll (trees: Tree[]): (SpecNode | SpecToken)[] {
    return trees.map((t) => this.convert(t));
  }

  convert (tree: Tree): SpecNode | SpecToken {
    if (isTerminal(tree)) return this.token(tree);
    const ctx = tree;
    const kids = this.kids(ctx);
    const rule = this.ruleNames[ctx.ruleIndex];
    switch (rule) {
      case 'program':
        return node('<program>', this.convertAll(kids));
      case 'useDeclaration':
        return node('<use-declaration>', this.convertAll(kids));
      case 'useSpecifierList':
        return node('<use-specifier-list>', this.convertAll(kids));
      case 'useSpecifier':
        return node('<use-specifier>', this.convertAll(kids));
      case 'elementDeclaration': {
        // METADATA identifier elementTail | (IDENTIFIER | FROM | AS) elementTail
        const tail = kids[kids.length - 1] as RuleNode;
        const head = kids.slice(0, -1).map((k) => this.leafToken(k));
        return node('<element-declaration>', head, this.convertAll(this.kids(tail)));
      }
      case 'elementBody':
        // COLON simpleBody | blockExpression: splice into the parent
        return node('<splice>', this.convertAll(kids));
      case 'fieldDeclaration':
        return node('<element-declaration>', this.convertAll(kids));
      case 'blockExpression':
        return node('<block-expression>', this.convertAll(kids));
      case 'expression': {
        const [callee, ...args] = kids.map((k) => this.convert(k) as SpecNode);
        return convertFuncAppToElem(callee, args) ?? node('<function-application>', callee, args);
      }
      case 'commaExpression': {
        // normalExpression (COMMA commaRest)? | COMMA commaRest
        if (kids.length === 1) return this.convert(kids[0]);
        const first = isTerminal(kids[0]) ? node('<dummy>') : this.convert(kids[0]);
        const rest = kids.filter((k) => !isTerminal(k) || k.symbol.type !== antlr4.Token.EOF).slice(isTerminal(kids[0]) ? 0 : 1);
        return node('<comma-expression>', first, this.convertAll(rest));
      }
      case 'commaRest': {
        // empty | COMMA commaRest | normalExpression (COMMA commaRest)?
        if (kids.length === 0) return node('<splice>', node('<dummy>'));
        if (isTerminal(kids[0])) return node('<splice>', node('<dummy>'), this.convertAll(kids));
        return node('<splice>', this.convertAll(kids));
      }
      case 'assignmentExpression':
      case 'equalityExpression':
      case 'comparisonExpression':
      case 'additiveExpression':
      case 'multiplicativeExpression':
        return this.foldInfix(ctx);
      case 'postfixExpression':
      case 'memberChain':
        return this.foldSteps(this.convert(kids[0]) as SpecNode, kids.slice(1));
      case 'unaryExpression':
        if (kids.length === 2) return node('<prefix-expression>', this.leafToken(kids[0]), this.convert(kids[1]));
        return this.convert(kids[0]);
      case 'primaryExpression': {
        const inner = kids[0] as RuleNode;
        const kind = this.ruleNames[inner.ruleIndex] === 'literal' ? '<literal>' : '<variable>';
        return node('<primary-expression>', node(kind, this.leafToken(inner)));
      }
      case 'functionExpression':
        return node('<function-expression>', this.leafToken(kids[0]));
      case 'wildcard':
        return node('<wildcard>', this.leafToken(kids[0]));
      case 'tupleExpression': {
        const converted = this.convertAll(kids);
        const kind = kids.length === 3 ? '<group-expression>' : '<tuple-expression>';
        return node(kind, converted);
      }
      case 'listExpression':
        return node('<list-expression>', this.convertAll(kids));
      case 'attribute':
        return node('<attribute>', this.convertAll(kids));
      case 'attributeName': {
        const inner = kids[0];
        if (!isTerminal(inner) && this.ruleNames[inner.ruleIndex] === 'identifierStream') return this.convert(inner);
        const kind = !isTerminal(inner) && this.ruleNames[inner.ruleIndex] === 'literal' ? '<literal>' : '<variable>';
        return node('<primary-expression>', node(kind, this.leafToken(inner)));
      }
      case 'identifierStream':
        return node('<identifier-stream>', kids.map((k) => this.leafToken(k)));
      case 'identifier':
      case 'prefixOp':
      case 'additiveOp':
      case 'comparisonOp':
        return this.leafToken(kids[0]);
      default:
        // statement, useName, elementTail, simpleBody, bodyItem, normalExpression,
        // operand, attributeValue, literal, variable: transparent wrappers
        if (kids.length !== 1) throw new Error(`unexpected shape for rule ${rule}`);
        return this.convert(kids[0]);
    }
  }
}

// `<splice>` nodes are transparent lists produced by the converter for
// sub-rules whose children belong to the parent node; flatten them.
function flattenSplices (n: SpecNode | SpecToken): (SpecNode | SpecToken)[] {
  if ('token' in n) return [n];
  const children = n.children.flatMap(flattenSplices);
  if (n.kind === '<splice>') return children;
  return [{ kind: n.kind, children }];
}

export async function loadAntlrParser (): Promise<SpecParser> {
  generateAntlrParser();
  const importGenerated = (file: string) => import(/* @vite-ignore */ pathToFileURL(path.join(ANTLR_OUTPUT_DIR, file)).href);
  const DbmlLexer = (await importGenerated('DbmlLexer.js')).default;
  const DbmlParser = (await importGenerated('DbmlParser.js')).default;
  const converter = new TreeConverter(DbmlParser.ruleNames, DbmlParser.symbolicNames);

  return {
    name: 'antlr',
    parse (source: string): SpecNode {
      const errors: string[] = [];
      const listener = {
        syntaxError: (_r: unknown, _s: unknown, line: number, column: number, msg: string) => {
          errors.push(`${line}:${column} ${msg}`);
        },
        reportAmbiguity: () => {},
        reportAttemptingFullContext: () => {},
        reportContextSensitivity: () => {},
      };
      // Decode to code points so that \p{L} sees supplementary-plane letters.
      const lexer = new DbmlLexer(new antlr4.CharStream(source, true));
      lexer.removeErrorListeners();
      lexer.addErrorListener(listener);
      const parser = new DbmlParser(new antlr4.CommonTokenStream(lexer));
      parser.removeErrorListeners();
      parser.addErrorListener(listener);
      parser._errHandler = new runtime.error.BailErrorStrategy();
      const tree = parser.program();
      if (errors.length > 0) throw new Error(errors.join('; '));
      const [program] = flattenSplices(converter.convert(tree));
      return program as SpecNode;
    },
  };
}
