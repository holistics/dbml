import { isValidIdentifier } from '@/compiler/queries/utils';
import {
  archSort, bodyOf, declarationWord, endpointNode, inlineLinkOf, inlineLinksOf, linkPartsOf, nameOf,
} from '@/core/arch/read';
import { lookupVisible } from '@/core/global_modules/arch/utils';
import { Filepath } from '@/core/types/filepath';
import { ElementDeclarationNode, FunctionApplicationNode, type SyntaxNode } from '@/core/types/nodes';
import { SymbolKind } from '@/core/types/symbol';
import { SyntaxToken } from '@/core/types/tokens';
import { isExpressionAVariableNode } from '@/core/utils/validate';
import type Compiler from '../../index';
import { TextEdit, applyTextEdits } from './applyTextEdits';
import { archDeclarations, findArchElement } from './utils/arch';

/**
 * Renames an architecture element (node, group or note box) in `filepath`.
 *
 * With an `as` alias, links, groups and metadata name the element by its alias, so only the
 * name changes. Without one the name is the handle, so every link endpoint, group member and
 * metadata target in the same file that names it is renamed too.
 *
 * Returns a map of absolute file paths to new source content. An empty map indicates a no-op
 * (lookup miss or name collision).
 */
export function renameElement (
  this: Compiler,
  filepath: Filepath,
  oldHandle: string,
  newName: string,
): Map<string, string> {
  const declaration = findArchElement(this, filepath, oldHandle);
  if (!declaration?.name) return new Map();

  const renamesHandle = !declaration.alias;
  if (renamesHandle && newName !== oldHandle && lookupVisible(this, filepath, SymbolKind.Element, newName)) {
    return new Map();
  }

  const source = this.getSource(filepath) ?? '';
  const nameText = source.substring(declaration.name.start, declaration.name.end);
  const newText = nameText.includes('"') || !isValidIdentifier(newName) ? `"${newName}"` : newName;

  const edits: TextEdit[] = [
    {
      start: declaration.name.start,
      end: declaration.name.end,
      newText,
    },
  ];
  if (renamesHandle) {
    // The kind position of `Metadata api { }` takes only a bare word, so a quoted name moves to the name position
    const kindPositionText = isValidIdentifier(newName) ? newName : `${declarationWord(declaration)} ${newText}`;
    for (const ref of handleReferences(archDeclarations(this, filepath), oldHandle)) {
      edits.push({
        start: ref.start,
        end: ref.end,
        newText: ref instanceof SyntaxToken ? kindPositionText : newText,
      });
    }
  }

  return new Map([
    [
      filepath.absolute,
      applyTextEdits(source, edits),
    ],
  ]);
}

function handleReferences (declarations: ElementDeclarationNode[], handle: string): (SyntaxNode | SyntaxToken)[] {
  const names = (node: SyntaxNode | undefined): node is SyntaxNode => isExpressionAVariableNode(node) && nameOf(node) === handle;
  const refs: (SyntaxNode | SyntaxToken)[] = [];

  for (const declaration of declarations) {
    // `[link: > api]` on any element names `api` too
    refs.push(...inlineLinksOf(declaration).map((attribute) => inlineLinkOf(attribute)?.target).filter(names));

    switch (archSort(declaration)) {
      case 'link': {
        const parts = linkPartsOf(declaration);
        if (!parts) break;
        refs.push(...[
          endpointNode(parts.infix.left),
          endpointNode(parts.infix.right),
        ].filter(names));
        break;
      }

      case 'group':
        for (const row of bodyOf(declaration)) {
          if (!(row instanceof FunctionApplicationNode)) continue;
          refs.push(...[
            row.callee,
            ...row.args,
          ].filter(names));
        }
        break;

      // `Metadata Server api { }` names its target in the name position, `Metadata api { }` in the kind position
      case 'metadata':
        if (declaration.name) {
          if (names(declaration.name)) refs.push(declaration.name);
        } else if (declaration.targetKind?.value === handle) {
          refs.push(declaration.targetKind);
        }
        break;

      default:
        break;
    }
  }

  return refs;
}
