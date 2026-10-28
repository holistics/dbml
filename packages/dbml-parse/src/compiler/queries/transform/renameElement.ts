import { isValidIdentifier } from '@/compiler/queries/utils';
import {
  type Ref, archSort, refsOf, roleOf,
} from '@/core/arch/read';
import {
  candidatesOf, isAliasSymbol, resolveName, roleOfSymbol,
} from '@/core/global_modules/arch/utils';
import { Filepath } from '@/core/types/filepath';
import { BlockExpressionNode, ElementDeclarationNode, type SyntaxNode } from '@/core/types/nodes';
import { SymbolKind } from '@/core/types/symbol';
import type { SyntaxToken } from '@/core/types/tokens';
import type Compiler from '../../index';
import { TextEdit, applyTextEdits } from './applyTextEdits';
import { memberEdit } from './removeElement';
import { archDeclarations, findArchElement, refersTo } from './utils/arch';

/**
 * With an `as` alias only the name changes. Without one, every link endpoint, group member and
 * metadata target in the same file that means it is renamed too, written by full name (`Server web`).
 * `role` picks among elements sharing the handle. An empty map means no change (lookup miss or name collision).
 */
export function renameElement (
  this: Compiler,
  filepath: Filepath,
  oldHandle: string,
  newName: string,
  role?: string,
): Map<string, string> {
  const declaration = findArchElement(this, filepath, oldHandle, role);
  const targetRole = declaration && roleOf(declaration);
  if (!declaration?.name || !targetRole) return new Map();

  const renamesHandle = !declaration.alias;
  const others = candidatesOf(this, filepath, newName).filter((symbol) => symbol.originalSymbol.declaration !== declaration);
  const taken = others.some((symbol) => roleOfSymbol(symbol) === targetRole || isAliasSymbol(symbol));
  if (renamesHandle && newName !== oldHandle && taken) {
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
    // The app writes every reference it touches by full name, keeping the declaration's quoting
    const declarations = archDeclarations(this, filepath);
    for (const ref of references(this, declarations, declaration)) {
      edits.push(...writeRef(source, ref, targetRole, newText));
    }
    // Once the new name is shared, a bare reference to another element with that name gets its full name too
    for (const other of others) {
      const otherRole = roleOfSymbol(other);
      const target = other.originalSymbol.declaration;
      if (!otherRole || !(target instanceof ElementDeclarationNode)) continue;
      for (const ref of references(this, declarations, target)) {
        if ('token' in ref || !ref.role) edits.push(...writeRef(source, ref, otherRole, quotedHandle(source, target)));
      }
    }
  }

  return new Map([
    [
      filepath.absolute,
      applyTextEdits(source, edits),
    ],
  ]);
}

// A reference as rename sees it: a name in a link, an inline link or a group, or a Metadata target
type Written = (Ref & { group?: ElementDeclarationNode }) | { token: SyntaxToken };

function references (compiler: Compiler, declarations: ElementDeclarationNode[], target: ElementDeclarationNode): Written[] {
  const out: Written[] = [];
  for (const declaration of declarations) {
    for (const ref of refsOf(declaration)) {
      if (refersTo(compiler, ref.node, target)) out.push(archSort(declaration) === 'group' ? { ...ref, group: declaration } : ref);
    }
    if (archSort(declaration) !== 'metadata') continue;
    // `Metadata Server api { }` names its target in the name position, `Metadata api { }` in the kind position
    if (declaration.name) {
      if (refersTo(compiler, declaration.name, target)) out.push({ node: declaration.name, role: declaration.targetKind?.value });
      continue;
    }
    const value = declaration.targetKind?.value;
    const found = value === undefined ? undefined : resolveName(compiler, declaration.filepath, value, undefined, [SymbolKind.Element]);
    if (declaration.targetKind && found?.originalSymbol.declaration === target) out.push({ token: declaration.targetKind });
  }
  return out;
}

// The text that names the element: its role, then its name
function writeRef (source: string, ref: Written, role: string, quoted: string): TextEdit[] {
  const text = `${role} ${quoted}`;
  if ('token' in ref) return [{ start: ref.token.start, end: ref.token.end, newText: text }];
  if (ref.roleNode) return [{ start: ref.roleNode.start, end: ref.node.end, newText: text }];
  // `Metadata Server api { }` already writes the role, before the name
  if (ref.role) return [{ start: ref.node.start, end: ref.node.end, newText: quoted }];
  // On the line of `{` a group lists names only, so the member moves to a line of its own
  if (ref.braceLine && ref.group?.body instanceof BlockExpressionNode && ref.group.body.blockCloseBrace) {
    const close = ref.group.body.blockCloseBrace;
    const lineStart = source.lastIndexOf('\n', close.start - 1) + 1;
    const closeOnOwnLine = !source.slice(lineStart, close.start).trim();
    return [
      memberEdit(source, ref.node),
      closeOnOwnLine
        ? { start: lineStart, end: lineStart, newText: `  ${text}\n` }
        : { start: spaceBefore(source, close.start), end: close.start, newText: `\n  ${text}\n` },
    ];
  }
  return [{ start: ref.node.start, end: ref.node.end, newText: text }];
}

function spaceBefore (source: string, at: number): number {
  let start = at;
  while (start > 0 && (source[start - 1] === ' ' || source[start - 1] === '\t')) start -= 1;
  return start;
}

// An element's handle as its declaration writes it, quoted or not
function quotedHandle (source: string, declaration: ElementDeclarationNode): string {
  const node = declaration.alias ?? declaration.name!;
  return source.substring(node.start, node.end);
}
