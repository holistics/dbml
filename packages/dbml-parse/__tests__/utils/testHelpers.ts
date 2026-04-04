import { NodeSymbol, SchemaSymbol } from '@/core/types/symbols';
import Report from '@/core/report';
import { ProgramNode, SyntaxNode, ElementDeclarationNode } from '@/core/parser/nodes';
import { SyntaxToken } from '@/core/lexer/tokens';
import type Compiler from '@/compiler/index';
import { DEFAULT_SCHEMA_NAME, UNHANDLED } from '@/constants';
import fs from 'fs';

export function scanTestNames (_path: any) {
  const files = fs.readdirSync(_path);

  return files.filter((fn) => fn.match(/\.in\./)).map((fn) => fn.split('.in.')[0]);
}

/**
 * Build a reverse mapping: symbol ID -> list of referencing node IDs.
 */
function buildReferencesMap (ast: ProgramNode, compiler: Compiler): Map<number, number[]> {
  const refs = new Map<number, number[]>();

  function walk (node: SyntaxNode | SyntaxToken | undefined) {
    if (!node) return;
    if (node instanceof SyntaxToken) return;

    const result = compiler.nodeReferee(node);
    if (!result.hasValue(UNHANDLED)) {
      const sym = result.getValue();
      if (sym instanceof NodeSymbol) {
        if (!refs.has(sym.id)) refs.set(sym.id, []);
        refs.get(sym.id)!.push(node.id);
      }
    }

    for (const key of Object.keys(node)) {
      if (key === 'parentNode') continue;
      const val = (node as any)[key];
      if (val instanceof SyntaxNode) {
        walk(val);
      } else if (Array.isArray(val)) {
        for (const item of val) {
          if (item instanceof SyntaxNode) walk(item);
        }
      }
    }
  }

  walk(ast);
  return refs;
}

/**
 * Serializes a compiler report to JSON, matching the old format:
 * - 'symbol': For non-root nodes, outputs only the symbol ID. For root nodes,
 *   outputs the full symbol table with references as IDs.
 * - 'referee': Outputs only the referenced symbol's ID
 * - 'parent': Outputs only the parent node's ID
 * - 'declaration': Outputs only the declaration node's ID
 */
export function serialize (
  report: Readonly<Report<ProgramNode>>,
  compiler: Compiler,
  pretty: boolean = false,
): string {
  const ast = report.getValue();
  const referencesMap = buildReferencesMap(ast, compiler);

  // Transform the report into a plain object tree with symbol/referee/parent injected
  const transformed = transformReport(report, compiler, referencesMap);
  return JSON.stringify(transformed, null, pretty ? 2 : 0);
}

function transformReport (report: Readonly<Report<any>>, compiler: Compiler, referencesMap: Map<number, number[]>): any {
  return {
    value: transformNode(report.getValue(), compiler, referencesMap, true),
    errors: report.getErrors().map((e) => transformValue(e, compiler, referencesMap)),
  };
}

function transformNode (node: any, compiler: Compiler, referencesMap: Map<number, number[]>, isRoot: boolean): any {
  if (node === null || node === undefined) return node;
  if (node instanceof SyntaxToken) return transformToken(node);
  if (!(node instanceof SyntaxNode)) return node;

  const result: any = {};

  // Emit all enumerable properties, transforming child nodes
  for (const key of Object.keys(node)) {
    if (key === 'parentNode') continue;
    if (key === 'source' && node instanceof ProgramNode) continue;

    const val = (node as any)[key];
    if (val instanceof SyntaxNode) {
      result[key] = transformNode(val, compiler, referencesMap, false);
    } else if (val instanceof SyntaxToken) {
      result[key] = transformToken(val);
    } else if (Array.isArray(val)) {
      result[key] = val.map((item) => {
        if (item instanceof SyntaxNode) return transformNode(item, compiler, referencesMap, false);
        if (item instanceof SyntaxToken) return transformToken(item);
        return item;
      });
    } else {
      result[key] = val;
    }
  }

  // Inject 'parent' only on ElementDeclarationNode (matching pre-query-system format)
  if (node instanceof ElementDeclarationNode) {
    const parent = node.parent;
    if (parent instanceof SyntaxNode) {
      result.parent = parent.id;
    }
  }

  // Inject 'symbol'
  const symResult = compiler.nodeSymbol(node);
  if (!symResult.hasValue(UNHANDLED)) {
    const sym = symResult.getValue();
    if (sym instanceof NodeSymbol) {
      if (isRoot) {
        result.symbol = transformRootSymbol(sym, compiler, referencesMap);
      } else {
        result.symbol = sym.id;
      }
    }
  }

  // Inject 'referee' (as symbol ID)
  const refResult = compiler.nodeReferee(node);
  if (!refResult.hasValue(UNHANDLED)) {
    const refSym = refResult.getValue();
    if (refSym instanceof NodeSymbol) {
      result.referee = refSym.id;
    }
  }

  return result;
}

function transformRootSymbol (sym: NodeSymbol, compiler: Compiler, referencesMap: Map<number, number[]>): any {
  // Build a flat symbolTable matching pre-query-system format:
  // Walk schemas and collect all element members + schema entries
  const symbolTable: Record<string, any> = {};
  const membersResult = compiler.symbolMembers(sym);

  if (!membersResult.hasValue(UNHANDLED)) {
    for (const schema of membersResult.getValue()) {
      if (!(schema instanceof SchemaSymbol)) continue;

      // Add non-default schemas as entries
      if (schema.name !== DEFAULT_SCHEMA_NAME) {
        symbolTable[`Schema:${schema.name}`] = transformSymbol(schema, compiler, referencesMap);
      }

      // Flatten all elements into the root symbolTable (matching flat format)
      const schemaMembers = compiler.symbolMembers(schema);
      if (!schemaMembers.hasValue(UNHANDLED)) {
        for (const member of schemaMembers.getValue()) {
          const memberKey = `${member.kind}:${getMemberName(compiler, member)}`;
          symbolTable[memberKey] = transformSymbol(member, compiler, referencesMap);
        }
      }
    }
  }

  return {
    symbolTable,
    id: sym.id,
    references: referencesMap.get(sym.id) ?? [],
  };
}

function transformSymbol (sym: NodeSymbol, compiler: Compiler, referencesMap: Map<number, number[]>): any {
  const membersResult = compiler.symbolMembers(sym);
  let symbolTable: Record<string, any> | undefined;

  if (!membersResult.hasValue(UNHANDLED)) {
    const members = membersResult.getValue();
    if (members.length > 0) {
      symbolTable = {};
      for (const member of members) {
        const memberKey = `${member.kind}:${getMemberName(compiler, member)}`;
        symbolTable[memberKey] = transformSymbol(member, compiler, referencesMap);
      }
    } else {
      symbolTable = {};
    }
  }

  return {
    references: referencesMap.get(sym.id) ?? [],
    id: sym.id,
    symbolTable,
    declaration: sym.declaration?.id,
  };
}

function transformToken (token: SyntaxToken): any {
  // Tokens are plain data — just strip parentNode-like fields if any
  const result: any = {};
  for (const key of Object.keys(token)) {
    if (key === 'parentNode') continue;
    const val = (token as any)[key];
    if (val instanceof SyntaxToken) {
      result[key] = transformToken(val);
    } else if (Array.isArray(val)) {
      result[key] = val.map((item) => item instanceof SyntaxToken ? transformToken(item) : item);
    } else {
      result[key] = val;
    }
  }
  return result;
}

function transformValue (value: any, compiler: Compiler, referencesMap: Map<number, number[]>): any {
  if (value === null || value === undefined) return value;
  if (value instanceof SyntaxNode) return transformNode(value, compiler, referencesMap, false);
  if (value instanceof SyntaxToken) return transformToken(value);
  if (Array.isArray(value)) return value.map((v) => transformValue(v, compiler, referencesMap));
  if (typeof value === 'object') {
    const result: any = {};
    for (const key of Object.keys(value)) {
      result[key] = transformValue(value[key], compiler, referencesMap);
    }
    return result;
  }
  return value;
}

function getMemberName (compiler: Compiler, member: NodeSymbol): string {
  return compiler.symbolName(member) ?? String(member.id);
}
