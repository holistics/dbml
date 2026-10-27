import type Compiler from '@/compiler';
import { ElementKind } from '@/core/types/keywords';
import { UNHANDLED } from '@/core/types/module';
import { ElementDeclarationNode, type SyntaxNode } from '@/core/types/nodes';
import { MetadataElementMetadata, RefMetadata } from '@/core/types/symbol/metadata';
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

// A Ref has no symbol, so the Ref-name features (definition, references) resolve the Ref through its metadata.
// Resolve the named Ref that `node` names: either the name of a `Ref name: ...` declaration or the target name of a `Metadata Ref name` header.
export function namedRefAt (compiler: Compiler, node: SyntaxNode): RefMetadata | undefined {
  // `Ref name: ...` declaration itself
  if (isElementNode(node, ElementKind.Ref)) {
    const meta = compiler.nodeMetadata(node).getFiltered(UNHANDLED);
    return meta instanceof RefMetadata && meta.name(compiler) !== undefined ? meta : undefined;
  }

  // `Metadata Ref name` header target name
  if (!isExpressionAVariableNode(node)) return undefined;
  const metadataNode = node.parentOfKind(ElementDeclarationNode);
  if (!metadataNode || !isElementNode(metadataNode, ElementKind.Metadata)) return undefined;
  if (!metadataNode.name?.containsEq(node)) return undefined;

  const block = compiler.nodeMetadata(metadataNode).getFiltered(UNHANDLED);
  if (!(block instanceof MetadataElementMetadata)) return undefined;
  const target = block.target(compiler);
  return target instanceof RefMetadata ? target : undefined;
}

// The name nodes of a named Ref: its declaration name and the header target names of the Metadata blocks aimed at it
export function namedRefNameNodes (compiler: Compiler, ref: RefMetadata): SyntaxNode[] {
  const blockNames = compiler.symbolMetadata(ref)
    .filter((m): m is MetadataElementMetadata => m instanceof MetadataElementMetadata)
    .flatMap((m) => m.declaration.name ?? []);
  return [
    ...(ref.declaration instanceof ElementDeclarationNode && ref.declaration.name ? [ref.declaration.name] : []),
    ...blockNames,
  ];
}
