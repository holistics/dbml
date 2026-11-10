import type Compiler from '@/compiler';
import { ElementKind } from '@/core/types/keywords';
import { UNHANDLED } from '@/core/types/module';
import { ElementDeclarationNode, type SyntaxNode } from '@/core/types/nodes';
import { DepMetadata, MetadataElementMetadata, RefMetadata } from '@/core/types/symbol/metadata';
import type { NamedTargetMetadata } from '@/core/global_modules/metadata/namedTargets';
import { isElementNode, isExpressionAVariableNode } from '@/core/utils/validate';
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
// Resolve the named Ref/Dep that `node` names: either the name of a `Ref name: ...`/`Dep name { ... }` declaration or the target name of a `Metadata Ref|Dep name` header.
export function getNamedTargetAt (compiler: Compiler, node: SyntaxNode): NamedTargetMetadata | undefined {
  // `Ref name: ...` or `Dep name { ... }` declaration itself
  if (isElementNode(node, ElementKind.Ref) || isElementNode(node, ElementKind.Dep)) {
    const meta = compiler.nodeMetadata(node).getFiltered(UNHANDLED);
    return (meta instanceof RefMetadata || meta instanceof DepMetadata) && meta.name(compiler) !== undefined ? meta : undefined;
  }

  // `Metadata Ref|Dep name` header target name
  if (!isExpressionAVariableNode(node)) return undefined;
  const metadataNode = node.parentOfKind(ElementDeclarationNode);
  if (!metadataNode || !isElementNode(metadataNode, ElementKind.Metadata)) return undefined;
  if (!metadataNode.name?.containsEq(node)) return undefined;

  const block = compiler.nodeMetadata(metadataNode).getFiltered(UNHANDLED);
  if (!(block instanceof MetadataElementMetadata)) return undefined;
  return block.targets(compiler)
    .filter((t) => compiler.symbolMetadata(t).includes(block))
    .find((o): o is NamedTargetMetadata => o instanceof RefMetadata || o instanceof DepMetadata);
}
