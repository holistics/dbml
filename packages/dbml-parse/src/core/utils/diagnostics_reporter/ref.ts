/*
 * Ref constraint diagnostics
 *
 * Reports mismatches between a ref's cardinality operator and its endpoint column constraints (nullability, uniqueness)
* */

import type Compiler from '@/compiler';
import {
  CompileErrorCode,
  CompileInfo,
  DiagnosticCategory,
  type QuickFix,
} from '@/core/types/errors';
import type { SyntaxNode } from '@/core/types/nodes';
import type { SyntaxToken } from '@/core/types/tokens';
import type { ColumnSymbol } from '@/core/types/symbol';
import type { RelationshipOp } from '@/core/types/relation';
import { getSourceSnippet } from '@/core/utils/span';

function qualifiedColumnNames (compiler: Compiler, columns: ColumnSymbol[]): string {
  return columns.map((c) => c.qualifiedName(compiler).join('.')).join(', ');
}

// Column is nullable but the ref operator requires NOT NULL.
// e.g. `user_id integer` with `Ref: posts.user_id > users.id`
export function refNullableMismatch (
  compiler: Compiler,
  node: SyntaxNode | SyntaxToken,
  options: {
    relOp: RelationshipOp; // the ref operator, e.g. '>'
    columns: ColumnSymbol[]; // the endpoint columns
    refNode: SyntaxNode; // the ref declaration node, for source snippet
    quickFixes?: QuickFix[];
  },
): CompileInfo {
  const { relOp, columns, refNode, quickFixes } = options;
  const names = qualifiedColumnNames(compiler, columns);
  const isComposite = columns.length > 1;

  const message = isComposite
    ? `Columns (\`${names}\`) are all nullable but operator \`${relOp}\` requires at least one to be NOT NULL`
    : `Column \`${names}\` is nullable but operator \`${relOp}\` requires it to be NOT NULL`;

  const refSnippet = getSourceSnippet(compiler, refNode);
  const colDecl = columns[0]?.declaration;
  const colSnippet = colDecl && getSourceSnippet(compiler, colDecl);
  const explanation = [
    `- In ref definition \`${refSnippet ?? relOp}\`, the operator \`${relOp}\` requires \`${names}\` to reference an existing row.`,
    colSnippet
      ? `- In column definition \`${colSnippet}\`, the column is nullable, which allows rows with no parent.`
      : '- A nullable column allows rows with no parent.',
  ].join('\n');

  return new CompileInfo(
    CompileErrorCode.INVALID_REF_RELATIONSHIP,
    message,
    node,
    { category: DiagnosticCategory.RefColumnMismatch, explanation, quickFixes },
  );
}

// Column is NOT NULL but the ref operator marks it as optional.
// e.g. `user_id integer [not null]` with `Ref: posts.user_id >? users.id`
export function refNotNullMismatch (
  compiler: Compiler,
  node: SyntaxNode | SyntaxToken,
  options: {
    relOp: RelationshipOp; // the ref operator, e.g. '>?'
    columns: ColumnSymbol[]; // the endpoint columns
    refNode: SyntaxNode; // the ref declaration node, for source snippet
    quickFixes?: QuickFix[];
  },
): CompileInfo {
  const { relOp, columns, refNode, quickFixes } = options;
  const names = qualifiedColumnNames(compiler, columns);
  const isComposite = columns.length > 1;

  const message = isComposite
    ? `Columns (\`${names}\`) are NOT NULL but operator \`${relOp}\` allows them to be optional`
    : `Column \`${names}\` is NOT NULL but operator \`${relOp}\` allows it to be optional`;

  const refSnippet = getSourceSnippet(compiler, refNode);
  const colDecl = columns[0]?.declaration;
  const colSnippet = colDecl && getSourceSnippet(compiler, colDecl);

  const explanation = [
    `- In ref definition \`${refSnippet ?? relOp}\`, the operator \`${relOp}\` marks \`${names}\` as optional.`,
    colSnippet
      ? `- In column definition \`${colSnippet}\`, the column is NOT NULL.`
      : '- The column is NOT NULL.',
  ].join('\n');

  return new CompileInfo(
    CompileErrorCode.INVALID_REF_RELATIONSHIP,
    message,
    node,
    { category: DiagnosticCategory.RefColumnMismatch, explanation, quickFixes },
  );
}

// Column has a unique/pk constraint but the ref operator allows many.
// e.g. `id integer [pk]` with `Ref: users.id <> posts.user_id`
export function refUniqueMismatch (
  compiler: Compiler,
  node: SyntaxNode | SyntaxToken,
  options: {
    relOp: RelationshipOp; // the ref operator, e.g. '<>'
    columns: ColumnSymbol[]; // the endpoint columns
    refNode: SyntaxNode; // the ref declaration node, for source snippet
    quickFixes?: QuickFix[];
  },
): CompileInfo {
  const { relOp, columns, refNode, quickFixes } = options;
  const names = qualifiedColumnNames(compiler, columns);
  const isComposite = columns.length > 1;

  const message = isComposite
    ? `Columns (\`${names}\`) have a unique index but operator \`${relOp}\` allows many`
    : `Column \`${names}\` is unique but operator \`${relOp}\` allows many`;

  const refSnippet = getSourceSnippet(compiler, refNode);
  const explanation = [
    `- In ref definition \`${refSnippet ?? relOp}\`, the operator \`${relOp}\` allows many.`,
    `- \`${names}\` has a unique constraint, so each value can appear at most once.`,
  ].join('\n');

  return new CompileInfo(
    CompileErrorCode.INVALID_REF_RELATIONSHIP,
    message,
    node,
    { category: DiagnosticCategory.RefColumnMismatch, explanation, quickFixes },
  );
}

// Ref operator implies one-to-one but column has no unique/pk constraint.
// e.g. `user_id integer` with `Ref: profiles.user_id - users.id`
export function refNonUniqueMismatch (
  compiler: Compiler,
  node: SyntaxNode | SyntaxToken,
  options: {
    relOp: RelationshipOp; // the ref operator, e.g. '-'
    columns: ColumnSymbol[]; // the endpoint columns
    refNode: SyntaxNode; // the ref declaration node, for source snippet
    quickFixes?: QuickFix[];
  },
): CompileInfo {
  const { relOp, columns, refNode, quickFixes } = options;
  const names = qualifiedColumnNames(compiler, columns);
  const isComposite = columns.length > 1;

  const message = isComposite
    ? `Columns (\`${names}\`) should have a composite unique index for operator \`${relOp}\``
    : `Column \`${names}\` should be unique or primary key for operator \`${relOp}\``;

  const refSnippet = getSourceSnippet(compiler, refNode);
  const explanation = [
    `- In ref definition \`${refSnippet ?? relOp}\`, the operator \`${relOp}\` implies \`${names}\` has at most one row.`,
    `- \`${names}\` has no unique or primary key constraint.`,
  ].join('\n');

  return new CompileInfo(
    CompileErrorCode.INVALID_REF_RELATIONSHIP,
    message,
    node,
    { category: DiagnosticCategory.RefColumnMismatch, explanation, quickFixes },
  );
}
