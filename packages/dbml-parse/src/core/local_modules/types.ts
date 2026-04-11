import type Compiler from '@/compiler';
import type { PassThrough } from '@/constants';
import type { Module } from '@/core/types/module';
import type { SyntaxNode } from '@/core/types/nodes';
import type Report from '@/core/types/report';
import type { Settings } from '@/core/utils/validate';
export type { Settings };

// Local modules handle syntax-level queries (validation, naming, settings) for each DBML element kind.
// All methods are optional, missing methods are treated as returning PASS_THROUGH.
export interface LocalModule extends Module {
  // Validate the syntax of this node, return errors in Report
  validateNode? (compiler: Compiler, node: SyntaxNode): Report<void> | Report<PassThrough>;
  // Extract the fully-qualified name segments (e.g. ['myschema', 'users'])
  nodeFullname? (compiler: Compiler, node: SyntaxNode): Report<string[] | undefined> | Report<PassThrough>;
  // Extract the short alias (e.g. 'U' for Table users as U)
  nodeAlias? (compiler: Compiler, node: SyntaxNode): Report<string | undefined> | Report<PassThrough>;
  // Parse and validate the [bracket] settings, return clean settings with errors
  nodeSettings? (compiler: Compiler, node: SyntaxNode): Report<Settings> | Report<PassThrough>;
}
