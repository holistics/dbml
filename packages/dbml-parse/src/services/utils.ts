import type Compiler from '@/compiler';
import { ElementKind } from '@/core/types/keywords';
import { UNHANDLED } from '@/core/types/module';
import type { SyntaxNode } from '@/core/types/nodes';
import { DepMetadata, RefMetadata, type NamedTargetMetadata } from '@/core/types/symbol/metadata';
import { metadataHeaderTargets } from '@/core/global_modules/metadata/utils';
import { isElementNode } from '@/core/utils/validate';
import { SyntaxToken } from '@/core/types/tokens';
import type { Position, Range, TextModel } from '@/services/types';

export function getOffsetFromMonacoPosition (model: TextModel, position: Position): number {
  return model.getOffsetAt(position);
}

export function getEditorRange (model: TextModel, nodeOrToken: SyntaxNode | SyntaxToken): Range {
  const {
    startPos,
    endPos,
  } = nodeOrToken;

  return {
    startLineNumber: startPos.line + 1,
    startColumn: startPos.column + 1,
    endLineNumber: endPos.line + 1,
    endColumn: endPos.column + 1,
  };
}

// Refs and Deps have no symbol, so the name features (definition, references) resolve them through their metadata.
// Resolve the named Refs/Deps that `node` names: either the name of a `Ref name: ...`/`Dep name { ... }` declaration or the target name of a `Metadata Ref|Dep name` header.
// An ambiguous header name resolves to every matching Ref/Dep.
export function getNamedTargetsAt (compiler: Compiler, node: SyntaxNode): NamedTargetMetadata[] {
  // `Ref name: ...` or `Dep name { ... }` declaration itself
  if (isElementNode(node, ElementKind.Ref) || isElementNode(node, ElementKind.Dep)) {
    const meta = compiler.nodeMetadata(node).getFiltered(UNHANDLED);
    return (meta instanceof RefMetadata || meta instanceof DepMetadata) && meta.name(compiler) !== undefined ? [meta] : [];
  }

  // `Metadata Ref|Dep name` header target name
  return metadataHeaderTargets(compiler, node)
    .filter((t): t is NamedTargetMetadata => t instanceof RefMetadata || t instanceof DepMetadata);
}
