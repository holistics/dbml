import {
  DEFAULT_SCHEMA_NAME, UNHANDLED,
} from '@/constants';
import type Compiler from '../../index';
import {
  ElementDeclarationNode, SyntaxNode, UseSpecifierNode,
} from '@/core/types/nodes';
import {
  NodeSymbol, SchemaSymbol, SymbolKind, UseSymbol,
} from '@/core/types/symbol';
import {
  applyTextEdits, TextEdit,
} from './applyTextEdits';
import {
  isAlphaOrUnderscore, isDigit,
} from '@/core/utils/chars';
import {
  normalizeTableName, lookupTableSymbol, stripQuotes, type TableNameInput,
} from './utils';
import {
  Filepath,
} from '@/core/types/filepath';
import {
  DbmlProjectLayout,
} from '@/compiler/projectLayout/layout';

interface FormattedTableName {
  schema: string;
  table: string;
  formattedSchema: string;
  formattedTable: string;
  shouldQuoteSchema: boolean;
  shouldQuoteTable: boolean;
}

function isValidIdentifier (name: string): boolean {
  if (!name) return false;
  return name.split('').every((char) => isAlphaOrUnderscore(char) || isDigit(char)) && !isDigit(name[0]);
}

/**
 * Examines the source text at the declaration's name node to detect whether
 * the original declaration used double-quoted identifiers.
 */
function checkIfDeclarationUsesQuotes (declarationNode: SyntaxNode | undefined, source: string): boolean {
  if (!declarationNode || !(declarationNode instanceof ElementDeclarationNode)) return false;
  const nameNode = declarationNode.name;
  if (!nameNode) return false;
  const nameText = source.substring(nameNode.start, nameNode.end);
  // FIXME: This check is fragile but matches the original heuristic.
  return nameText.includes('"');
}

function formatTableName (
  schema: string,
  table: string,
  originalUsedQuotes: boolean,
): FormattedTableName {
  const tableNeedsQuotes = !isValidIdentifier(table);
  const schemaNeedsQuotes = !isValidIdentifier(schema);
  const shouldQuoteTable = originalUsedQuotes || tableNeedsQuotes;
  const shouldQuoteSchema = originalUsedQuotes || schemaNeedsQuotes;
  return {
    schema,
    table,
    formattedSchema: shouldQuoteSchema ? `"${schema}"` : schema,
    formattedTable: shouldQuoteTable ? `"${table}"` : table,
    shouldQuoteSchema,
    shouldQuoteTable,
  };
}

function checkForNameCollision (
  compiler: Compiler,
  filepath: Filepath,
  oldSchema: string,
  oldTable: string,
  newSchema: string,
  newTable: string,
): boolean {
  if (oldSchema === newSchema && oldTable === newTable) return false;
  return lookupTableSymbol(compiler, filepath, newSchema, newTable) !== null;
}

/**
 * Detects whether `node` is the rightmost token of a qualified reference like
 * `schema.table`, returning the start..end range that covers the whole
 * `schema.table` substring so callers can rewrite both halves at once.
 *
 * FIXME: this regex/character-walk approach is fragile and ad-hoc.
 */
function checkIfPartOfQualifiedReference (
  node: SyntaxNode,
  oldSchema: string,
  source: string,
): { start: number;
  end: number; } | null {
  let i = node.start - 1;
  while (i >= 0 && /\s/.test(source[i])) i--;
  if (i < 0 || source[i] !== '.') return null;
  i--;
  while (i >= 0 && /\s/.test(source[i])) i--;
  if (i < 0) return null;

  let schemaStart: number;
  let schemaEnd: number;

  if (source[i] === '"') {
    schemaEnd = i + 1;
    i--;
    while (i >= 0 && source[i] !== '"') i--;
    if (i < 0) return null;
    schemaStart = i;
  } else {
    schemaEnd = i + 1;
    while (i >= 0 && /[a-zA-Z0-9_]/.test(source[i])) i--;
    schemaStart = i + 1;
  }

  const schemaText = source.substring(schemaStart, schemaEnd);
  if (stripQuotes(schemaText) === oldSchema) {
    return {
      start: schemaStart,
      end: node.end,
    };
  }
  return null;
}

function buildReplacementText (newFormatted: FormattedTableName): string {
  return newFormatted.schema !== DEFAULT_SCHEMA_NAME
    ? `${newFormatted.formattedSchema}.${newFormatted.formattedTable}`
    : newFormatted.formattedTable;
}

function findReplacements (
  nodes: SyntaxNode[],
  oldSchema: string,
  oldTable: string,
  newFormatted: FormattedTableName,
  source: string,
): TextEdit[] {
  const replacements: TextEdit[] = [];
  const processedRanges = new Set<string>();
  const newText = buildReplacementText(newFormatted);

  for (const node of nodes) {
    // Skip refs whose source text is not the renamed table — handles inline
    // table aliases (`Table users as U`) where `symbolReferences` returns both
    // `users.id` and `U.id` against the same underlying symbol but only
    // `users.id` should be rewritten when renaming the source name.
    const refText = source.substring(node.start, node.end);
    if (stripQuotes(refText) !== oldTable) continue;

    const qualifiedRange = checkIfPartOfQualifiedReference(node, oldSchema, source);
    const range = qualifiedRange ?? {
      start: node.start,
      end: node.end,
    };
    const rangeKey = `${range.start}-${range.end}`;

    if (processedRanges.has(rangeKey)) continue;
    processedRanges.add(rangeKey);

    replacements.push({
      start: range.start,
      end: range.end,
      newText,
    });
  }

  return replacements;
}

/**
 * Renames a table across every file in the project layout.
 *
 * Resolution starts in `filepath`'s scope. Two paths:
 *
 *   1. **Alias rename.** `filepath` introduces a use specifier with an alias
 *      whose name matches `oldName` (e.g. `use { table users as u }` and
 *      `oldName === 'u'`). Only `filepath` is rewritten — the alias token is
 *      replaced and every reference to the alias inside `filepath` is updated.
 *      The original declaration in another file is left alone.
 *
 *   2. **Real-declaration rename.** Otherwise the resolved symbol is the real
 *      table (or a `UseSymbol` that imports the source name without an alias).
 *      Both the declaring file and every file that imports the table by its
 *      direct name are rewritten — declaration name, in-scope refs, use
 *      specifier source-name tokens, and refs that flow through unaliased
 *      imports.
 *
 * Returns a fresh `DbmlProjectLayout` containing every file from the input
 * layout with the rename applied where appropriate. Files the rename did not
 * touch are returned with byte-identical source. A lookup miss or name
 * collision still produces a fresh-copy layout (caller can always swap).
 */
export function renameTable (
  this: Compiler,
  filepath: Filepath,
  oldName: TableNameInput,
  newName: TableNameInput,
): DbmlProjectLayout {
  const newLayout = this.layout.clone();

  const normalizedOld = normalizeTableName(oldName);
  const normalizedNew = normalizeTableName(newName);
  const oldSchema = normalizedOld.schema;
  const oldTable = normalizedOld.table;
  const newSchema = normalizedNew.schema;
  const newTable = normalizedNew.table;

  const tableSymbol = lookupTableSymbol(this, filepath, oldSchema, oldTable);
  if (!tableSymbol) return newLayout;

  if (checkForNameCollision(this, filepath, oldSchema, oldTable, newSchema, newTable)) {
    return newLayout;
  }

  // Alias rename: the resolved symbol is a UseSymbol whose alias text matches oldTable.
  if (
    tableSymbol instanceof UseSymbol
    && tableSymbol.useSpecifierDeclaration instanceof UseSpecifierNode
    && tableSymbol.useSpecifierDeclaration.alias
  ) {
    const spec = tableSymbol.useSpecifierDeclaration;
    const aliasName = this.nodeAlias(spec).getFiltered(UNHANDLED);
    if (aliasName === oldTable) {
      return renameAlias(this, newLayout, filepath, spec, tableSymbol, newSchema, newTable);
    }
  }

  return renameRealDeclaration(this, newLayout, tableSymbol, oldSchema, oldTable, newSchema, newTable);
}

function renameAlias (
  compiler: Compiler,
  newLayout: DbmlProjectLayout,
  filepath: Filepath,
  spec: UseSpecifierNode,
  useSymbol: UseSymbol,
  newSchema: string,
  newTable: string,
): DbmlProjectLayout {
  const source = compiler.layout.getSource(filepath) ?? '';
  if (!spec.alias) return newLayout;
  const aliasText = source.substring(spec.alias.start, spec.alias.end);
  const usedQuotes = aliasText.includes('"');
  // Aliases live in the default schema — schema prefix is ignored for the alias text itself.
  const newFormatted = formatTableName(newSchema, newTable, usedQuotes);

  const edits: TextEdit[] = [];
  edits.push({
    start: spec.alias.start,
    end: spec.alias.end,
    newText: newFormatted.formattedTable,
  });

  const refs = compiler.symbolReferences(useSymbol).getValue();
  for (const ref of refs) {
    if (ref.filepath.absolute !== filepath.absolute) continue;
    if (ref === spec.alias) continue; // skip alias declaration token, already handled
    edits.push({
      start: ref.start,
      end: ref.end,
      newText: newFormatted.formattedTable,
    });
  }

  newLayout.setSource(filepath, applyTextEdits(source, edits));
  return newLayout;
}

function renameRealDeclaration (
  compiler: Compiler,
  newLayout: DbmlProjectLayout,
  tableSymbol: NodeSymbol,
  oldSchema: string,
  oldTable: string,
  newSchema: string,
  newTable: string,
): DbmlProjectLayout {
  const original = tableSymbol.originalSymbol;
  const declNode = original.declaration;
  if (!declNode || !(declNode instanceof ElementDeclarationNode)) return newLayout;

  const declFp = declNode.filepath;
  if (!declFp) return newLayout;

  const declSource = compiler.layout.getSource(declFp) ?? '';
  const usedQuotes = checkIfDeclarationUsesQuotes(declNode, declSource);
  const newFormatted = formatTableName(newSchema, newTable, usedQuotes);

  const editsByFile = new Map<string, { fp: Filepath; edits: TextEdit[] }>();
  const addEdit = (fp: Filepath, edit: TextEdit): void => {
    const key = fp.absolute;
    let bucket = editsByFile.get(key);
    if (!bucket) {
      bucket = {
        fp,
        edits: [],
      };
      editsByFile.set(key, bucket);
    }
    bucket.edits.push(edit);
  };

  // 1. Declaration name token in the declaring file.
  const declNameNode = declNode.name;
  if (declNameNode) {
    addEdit(declFp, {
      start: declNameNode.start,
      end: declNameNode.end,
      newText: buildReplacementText(newFormatted),
    });
  }

  // 2. Direct references to the original symbol across the project. These
  //    include in-file refs and the source-name tokens inside use specifiers
  //    (`use { table users [as alias] }` — the `users` token references the
  //    original symbol regardless of alias).
  const directRefs = compiler.symbolReferences(original).getValue();
  for (const ref of directRefs) {
    if (ref === declNameNode) continue; // already handled above
    const fp = ref.filepath;
    const src = compiler.layout.getSource(fp) ?? '';
    for (const e of findReplacements([ref], oldSchema, oldTable, newFormatted, src)) {
      addEdit(fp, e);
    }
  }

  // 3. Cascade through unaliased UseSymbols that wrap the original. Refs in
  //    importer files that use the direct name resolve to those UseSymbols
  //    (not to `original`), so they need a separate sweep.
  for (const fp of compiler.layout.getEntryPoints()) {
    if (fp.absolute === declFp.absolute) continue;
    const useSymbols = findUnaliasedUseSymbols(compiler, fp, original);
    if (useSymbols.length === 0) continue;
    const src = compiler.layout.getSource(fp) ?? '';
    for (const useSym of useSymbols) {
      const useRefs = compiler.symbolReferences(useSym).getValue();
      for (const ref of useRefs) {
        if (ref.filepath.absolute !== fp.absolute) continue;
        for (const e of findReplacements([ref], oldSchema, oldTable, newFormatted, src)) {
          addEdit(fp, e);
        }
      }
    }
  }

  for (const {
    fp, edits,
  } of editsByFile.values()) {
    const src = compiler.layout.getSource(fp) ?? '';
    newLayout.setSource(fp, applyTextEdits(src, edits));
  }

  return newLayout;
}

/**
 * Returns every UseSymbol in `fp`'s public schema scope whose `originalSymbol`
 * is `original` and whose use specifier carries no alias — i.e. importers that
 * pulled the table in by its source name.
 */
function findUnaliasedUseSymbols (
  compiler: Compiler,
  fp: Filepath,
  original: NodeSymbol,
): UseSymbol[] {
  const ast = compiler.parseFile(fp).getValue().ast;
  const schemaSymbol = compiler.lookupMembers(ast, SymbolKind.Schema, DEFAULT_SCHEMA_NAME).getValue();
  if (!schemaSymbol || !(schemaSymbol instanceof SchemaSymbol)) return [];
  const members = compiler.symbolMembers(schemaSymbol).getFiltered(UNHANDLED) ?? [];
  const out: UseSymbol[] = [];
  for (const m of members) {
    if (!(m instanceof UseSymbol)) continue;
    if (m.originalSymbol !== original) continue;
    const spec = m.useSpecifierDeclaration;
    if (spec instanceof UseSpecifierNode && !spec.alias) {
      out.push(m);
    }
  }
  return out;
}
