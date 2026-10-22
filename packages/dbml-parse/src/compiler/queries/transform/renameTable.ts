import { isValidIdentifier } from '@/compiler/queries/utils';
import { DEFAULT_SCHEMA_NAME } from '@/constants';
import { Filepath } from '@/core/types/filepath';
import { UNHANDLED } from '@/core/types/module';
import {
  ElementDeclarationNode, SyntaxNode, UseDeclarationNode, UseSpecifierNode, WildcardNode,
} from '@/core/types/nodes';
import { AliasSymbol, NodeSymbol, UseSymbol } from '@/core/types/symbol';
import type Compiler from '../../index';
import { TextEdit, applyTextEdits } from './applyTextEdits';
import type { TableIdentifier } from './types';
import { lookupElementSymbol, normalizeTableName, stripQuotes } from './utils';

interface FormattedTableName {
  schema: string;
  table: string;
  formattedSchema: string;
  formattedTable: string;
  shouldQuoteSchema: boolean;
  shouldQuoteTable: boolean;
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
  // FIXME: This check is fragile but matches the original heuristic
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
  return lookupElementSymbol(compiler, filepath, newSchema, newTable) !== undefined;
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
): {
  start: number;
  end: number;
} | null {
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
    // Skip refs not matching the renamed table's source text, handles inline aliases where symbolReferences returns both `users.id` and `U.id` but only the source name should be rewritten
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
 *      `oldName === 'u'`). Only `filepath` is rewritten - the alias token is
 *      replaced and every reference to the alias inside `filepath` is updated.
 *      The original declaration in another file is left alone.
 *
 *   2. **Real-declaration rename.** Otherwise the resolved symbol is the real
 *      table (or a `UseSymbol` that imports the source name without an alias).
 *      Both the declaring file and every file that imports the table by its
 *      direct name are rewritten - declaration name, in-scope refs, use
 *      specifier source-name tokens, and refs that flow through unaliased
 *      imports.
 *
 * Returns a map of absolute file paths to new source content, containing
 * only the files that were actually changed by the rename. An empty map
 * indicates a no-op (lookup miss, name collision, or alias rename attempt).
 */
export function renameTable (
  this: Compiler,
  filepath: Filepath,
  oldName: string | TableIdentifier,
  newName: string | TableIdentifier,
): Map<string, string> {
  const normalizedOld = normalizeTableName(oldName);
  const normalizedNew = normalizeTableName(newName);
  const oldSchema = normalizedOld.schema;
  const oldTable = normalizedOld.table;
  const newSchema = normalizedNew.schema;
  const newTable = normalizedNew.table;

  const tableSymbol = lookupElementSymbol(this, filepath, oldSchema, oldTable);
  if (!tableSymbol) return new Map();

  // Inline table aliases (e.g., `Table users as U`) resolve to an AliasSymbol
  // Renaming via the alias name is a no-op, only the direct declaration name can be renamed
  if (tableSymbol instanceof AliasSymbol) return new Map();

  if (checkForNameCollision(this, filepath, oldSchema, oldTable, newSchema, newTable)) {
    return new Map();
  }

  // Alias rename: the resolved symbol is a UseSymbol whose alias text matches oldTable
  if (
    tableSymbol instanceof UseSymbol
    && tableSymbol.useSpecifierDeclaration instanceof UseSpecifierNode
    && tableSymbol.useSpecifierDeclaration.alias
  ) {
    const spec = tableSymbol.useSpecifierDeclaration;
    const aliasName = this.nodeAlias(spec).getFiltered(UNHANDLED);
    if (aliasName === oldTable) {
      return renameAlias(this, filepath, spec, tableSymbol, newSchema, newTable);
    }
  }

  // Remote rename: the symbol is imported (UseSymbol) — rename alias/add alias in the consumer
  // file rather than touching the declaring file
  if (tableSymbol instanceof UseSymbol) {
    if (
      tableSymbol.useSpecifierDeclaration instanceof UseSpecifierNode
      && !tableSymbol.useSpecifierDeclaration.alias
    ) {
      // Named import without alias: add ` as newName` to the specifier
      return renameRemoteNamedSpecifier(this, filepath, tableSymbol.useSpecifierDeclaration, tableSymbol, oldTable, newSchema, newTable);
    }
    if (tableSymbol.useSpecifierDeclaration instanceof WildcardNode) {
      // Wildcard import: add a separate named specifier with alias
      return renameRemoteWildcard(this, filepath, tableSymbol, oldTable, newSchema, newTable);
    }
  }

  return renameRealDeclaration(this, tableSymbol, oldSchema, oldTable, newSchema, newTable);
}

function renameAlias (
  compiler: Compiler,
  filepath: Filepath,
  spec: UseSpecifierNode,
  useSymbol: UseSymbol,
  newSchema: string,
  newTable: string,
): Map<string, string> {
  const source = compiler.getSource(filepath) ?? '';
  if (!spec.alias) return new Map();
  const aliasText = source.substring(spec.alias.start, spec.alias.end);
  const usedQuotes = aliasText.includes('"');
  // Aliases live in the default schema, schema prefix is ignored for the alias text itself
  const newFormatted = formatTableName(newSchema, newTable, usedQuotes);

  const edits: TextEdit[] = [];
  edits.push({
    start: spec.alias.start,
    end: spec.alias.end,
    newText: newFormatted.formattedTable,
  });

  const refs = compiler.symbolReferences(useSymbol);
  for (const ref of refs) {
    if (ref.filepath.absolute !== filepath.absolute) continue;
    if (ref === spec.alias) continue; // skip alias declaration token, already handled
    edits.push({
      start: ref.start,
      end: ref.end,
      newText: newFormatted.formattedTable,
    });
  }

  return new Map([
    [
      filepath.absolute,
      applyTextEdits(source, edits),
    ],
  ]);
}

/**
 * Renames a remote table imported via a named specifier without an alias,
 * e.g. `use { table users } from './a'` becomes `use { table users as accounts } from './a'`.
 * Only rewrites the consumer file; the declaring file is untouched.
 */
function renameRemoteNamedSpecifier (
  compiler: Compiler,
  filepath: Filepath,
  spec: UseSpecifierNode,
  useSymbol: UseSymbol,
  oldTable: string,
  newSchema: string,
  newTable: string,
): Map<string, string> {
  const source = compiler.getSource(filepath) ?? '';
  const usedQuotes = spec.name ? source.substring(spec.name.start, spec.name.end).includes('"') : false;
  const newFormatted = formatTableName(newSchema, newTable, usedQuotes);

  const edits: TextEdit[] = [];

  // Insert ` as newName` right after the name token
  if (spec.name) {
    edits.push({
      start: spec.name.end,
      end: spec.name.end,
      newText: ` as ${newFormatted.formattedTable}`,
    });
  }

  // Rename all in-file references from oldTable to newName
  const refs = compiler.symbolReferences(useSymbol);
  for (const ref of refs) {
    if (ref.filepath.absolute !== filepath.absolute) continue;
    if (spec.name && ref.start === spec.name.start && ref.end === spec.name.end) continue; // skip the specifier name itself
    const refText = source.substring(ref.start, ref.end);
    if (stripQuotes(refText) !== oldTable) continue;
    edits.push({
      start: ref.start,
      end: ref.end,
      newText: newFormatted.formattedTable,
    });
  }

  return new Map([[filepath.absolute, applyTextEdits(source, edits)]]);
}

/**
 * Renames a remote table imported via a wildcard (`use * from './a'`) by adding
 * a separate named specifier with an alias, e.g. `use { table users as accounts } from './a'`.
 * The wildcard is left in place. Only the consumer file is rewritten.
 */
function renameRemoteWildcard (
  compiler: Compiler,
  filepath: Filepath,
  useSymbol: UseSymbol,
  oldTable: string,
  newSchema: string,
  newTable: string,
): Map<string, string> {
  const wildcard = useSymbol.useSpecifierDeclaration as WildcardNode;
  const useDecl = wildcard.parentOfKind(UseDeclarationNode);
  if (!useDecl) return new Map();

  const source = compiler.getSource(filepath) ?? '';
  const newFormatted = formatTableName(newSchema, newTable, false);

  // Determine the import kind label from the symbol kind
  const kindLabel = useSymbol.kind.toLowerCase();

  // Get the raw import path string as it appears in source (with quotes)
  const importPathText = useDecl.importPath ? source.substring(useDecl.importPath.start, useDecl.importPath.end) : "''";

  const reuseKeyword = useDecl.isReuse ? 'reuse' : 'use';
  const newStatement = `${reuseKeyword} { ${kindLabel} ${oldTable} as ${newFormatted.formattedTable} } from ${importPathText}`;

  const edits: TextEdit[] = [];

  // Insert the new statement after the wildcard use declaration
  edits.push({
    start: useDecl.end,
    end: useDecl.end,
    newText: `\n${newStatement}`,
  });

  // Rename all in-file references from oldTable to newName
  const refs = compiler.symbolReferences(useSymbol);
  for (const ref of refs) {
    if (ref.filepath.absolute !== filepath.absolute) continue;
    const refText = source.substring(ref.start, ref.end);
    if (stripQuotes(refText) !== oldTable) continue;
    edits.push({
      start: ref.start,
      end: ref.end,
      newText: newFormatted.formattedTable,
    });
  }

  return new Map([[filepath.absolute, applyTextEdits(source, edits)]]);
}

function renameRealDeclaration (
  compiler: Compiler,
  tableSymbol: NodeSymbol,
  oldSchema: string,
  oldTable: string,
  newSchema: string,
  newTable: string,
): Map<string, string> {
  const original = tableSymbol.originalSymbol;
  const declNode = original.declaration;
  if (!declNode || !(declNode instanceof ElementDeclarationNode)) return new Map();

  const declFp = declNode.filepath;
  if (!declFp) return new Map();

  const declSource = compiler.getSource(declFp) ?? '';
  const usedQuotes = checkIfDeclarationUsesQuotes(declNode, declSource);
  const newFormatted = formatTableName(newSchema, newTable, usedQuotes);

  const editsByFile = new Map<string, {
    fp: Filepath;
    edits: TextEdit[];
  }>();
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

  // 1. Declaration name token in the declaring file
  const declNameNode = declNode.name;
  if (declNameNode) {
    addEdit(declFp, {
      start: declNameNode.start,
      end: declNameNode.end,
      newText: buildReplacementText(newFormatted),
    });
  }

  // 2. All references across the project: symbolReferences is transitive, unions refs to the original, any AliasSymbol, and any UseSymbol
  //    findReplacements filters by source text, skipping alias-side refs and rewriting source-name refs in use specifiers and unaliased importers
  const directRefs = compiler.symbolReferences(original);
  for (const ref of directRefs) {
    if (ref === declNameNode) continue; // already handled above
    const fp = ref.filepath;
    const src = compiler.getSource(fp) ?? '';
    for (const e of findReplacements([
      ref,
    ], oldSchema, oldTable, newFormatted, src)) {
      addEdit(fp, e);
    }
  }

  const result = new Map<string, string>();
  for (const {
    fp, edits,
  } of editsByFile.values()) {
    const src = compiler.getSource(fp) ?? '';
    result.set(fp.absolute, applyTextEdits(src, edits));
  }

  return result;
}
