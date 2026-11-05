import {
  AttributeNode,
  BlockExpressionNode,
  ElementDeclarationNode,
  FunctionApplicationNode,
  IdentifierStreamNode,
  InfixExpressionNode,
  ListExpressionNode,
  LiteralNode,
  PrefixExpressionNode,
  PrimaryExpressionNode,
  ProgramNode,
  type SyntaxNode,
  VariableNode,
} from '@/core/types/nodes';
import { SyntaxTokenKind } from '@/core/types/tokens';
import { roleName } from '@/core/arch/vocabulary';
import type { ArchSettingValue, ArchSettings } from '@/core/types/schemaJson';

// What a top-level declaration in an architecture file is, from its first word
export type ArchSort =
  | 'node'
  | 'group'
  | 'kind'
  | 'link'
  | 'metadata'
  | 'project';

const SORT_BY_WORD: Record<string, ArchSort> = {
  group: 'group',
  kind: 'kind',
  link: 'link',
  ref: 'link',
  metadata: 'metadata',
  project: 'project',
};

export const declarationWord = (
  node: ElementDeclarationNode,
): string | undefined => node.type?.value;

export function isTopLevel (node: SyntaxNode): node is ElementDeclarationNode {
  return (
    node instanceof ElementDeclarationNode
    && node.parentNode instanceof ProgramNode
    && !!node.type
  );
}

// Any word that is not a reserved one is a role, so the declaration is a node.
// A top-level `Note` is a DBML sticky note, read by DBML's note module.
export function archSort (node: SyntaxNode): ArchSort | undefined {
  if (!isTopLevel(node)) return undefined;
  const word = node.type!.value.toLowerCase();
  if (word === 'note') return undefined;
  return SORT_BY_WORD[word] ?? 'node';
}

export const isTopLevelNote = (node: SyntaxNode): boolean =>
  isTopLevel(node) && node.type!.value.toLowerCase() === 'note';

export function topLevelDeclaration (
  node: SyntaxNode,
): ElementDeclarationNode | undefined {
  let current: SyntaxNode | undefined = node;
  while (current) {
    if (isTopLevel(current)) return current;
    current = current.parentNode;
  }
  return undefined;
}

export function getArchNodeName (node?: SyntaxNode): string | undefined {
  if (!node) return undefined;
  if (node instanceof PrimaryExpressionNode) {
    if (node.expression instanceof VariableNode)
      return node.expression.variable?.value;
    if (node.expression instanceof LiteralNode)
      return String(node.expression.literal?.value);
  }
  if (node instanceof IdentifierStreamNode) {
    return node.identifiers?.map((t) => t.value).join(' ');
  }
  return undefined;
}

// The name links, groups and metadata use: the `as` word, or the name when there is none
export const handleOf = (node: ElementDeclarationNode): string | undefined =>
  getArchNodeName(node.alias) ?? getArchNodeName(node.name);

// The role a reference may name: a built-in role, `Group` or `Note`, in its declared spelling
export function roleWord (text: string | undefined): string | undefined {
  if (text === undefined) return undefined;
  const lower = text.toLowerCase();
  if (lower === 'group') return 'Group';
  if (lower === 'note') return 'Note';
  return roleName(text);
}

// The role an element is declared with: `Server api` is a Server, a group a Group, a sticky note a Note
export function roleOf (node: ElementDeclarationNode): string | undefined {
  if (isTopLevelNote(node)) return 'Note';
  if (archSort(node) === 'group') return 'Group';
  const word = declarationWord(node);
  return word === undefined ? undefined : (roleName(word) ?? word);
}

// A name in a link, an inline link or a group, with the role written before it if any:  api,  Server api
export interface ArchNodeRef {
  node: SyntaxNode;
  role?: string;
  roleNode?: SyntaxNode;
  // a group member on the line of `{`, where a role cannot be written
  braceLine?: boolean;
}

// One word is a name; two are a role and a name. undefined when the first of two is not a role, or for more words.
export function getArchNodeRef (words: SyntaxNode[]): ArchNodeRef | undefined {
  if (words.length === 1) return { node: words[0] };
  if (words.length !== 2) return undefined;
  const role = roleWord(getArchNodeName(words[0]));
  return role ? { node: words[1], role, roleNode: words[0] } : undefined;
}

// A quoted value stays a string; only a bare number is a number
export function getArchNodeNumber (node?: SyntaxNode): number | null {
  if (
    !(node instanceof PrimaryExpressionNode)
    || !(node.expression instanceof LiteralNode)
  )
    return null;
  const token = node.expression.literal;
  if (token?.kind !== SyntaxTokenKind.NUMERIC_LITERAL) return null;
  const value = Number(token.value);
  return Number.isFinite(value) ? value : null;
}

export function valueOf (node: SyntaxNode): ArchSettingValue | undefined {
  const number = getArchNodeNumber(node);
  if (number !== null) return number;
  const text = getArchNodeName(node);
  if (text === undefined) return undefined;
  if (text === 'true') return true;
  if (text === 'false') return false;
  return text;
}

// `Server api [link: > db]`: a link from the element to `db`. `ref` is the same word, as `Ref:` is `Link:`.
const ARCH_INLINE_LINK_KEYS = new Set(['link', 'ref']);

export const isArchInlineLinkKey = (key: string): boolean =>
  ARCH_INLINE_LINK_KEYS.has(key.toLowerCase());

// `[style: dashed, inactive]`: a setting with no value is true. An inline link is a link, not a setting.
export function extractArchNodeSettings (
  list?: ListExpressionNode,
): ArchSettings {
  const out: ArchSettings = {};
  for (const attribute of list?.elementList ?? []) {
    if (!(attribute instanceof AttributeNode)) continue;
    const key = getArchNodeName(attribute.name)?.toLowerCase();
    if (!key || ARCH_INLINE_LINK_KEYS.has(key)) continue;
    out[key] =
      attribute.value === undefined ? true : (valueOf(attribute.value) ?? true);
  }
  return out;
}

// The statements inside `{ ... }`, or the single expression after `:`
export function getArchNodeBody (node: ElementDeclarationNode): SyntaxNode[] {
  if (!node.body) return [];
  return node.body instanceof BlockExpressionNode
    ? [...node.body.body]
    : [node.body];
}

// A body row is `callee arg1 arg2 [settings]`, the shape a DBML column has
export interface ArchField {
  callee: SyntaxNode | undefined;
  args: SyntaxNode[];
  settings: ListExpressionNode | undefined;
}

export function getArchNodeField (
  node: SyntaxNode | undefined,
): ArchField | undefined {
  if (!(node instanceof FunctionApplicationNode)) return undefined;
  const args = [...(node.args ?? [])];
  const last = args[args.length - 1];
  const settings =
    last instanceof ListExpressionNode
      ? (args.pop() as ListExpressionNode)
      : undefined;
  return {
    callee: node.callee,
    args,
    settings,
  };
}

export interface ArchInfix {
  left: SyntaxNode;
  op: string;
  right: SyntaxNode;
}

export function getArchNodeInfix (node?: SyntaxNode): ArchInfix | undefined {
  if (!(node instanceof InfixExpressionNode)) return undefined;
  const op = node.op?.value;
  if (!op || !node.leftExpression || !node.rightExpression) return undefined;
  return {
    left: node.leftExpression,
    op,
    right: node.rightExpression,
  };
}

export const ARCH_LINK_OPS = new Set(['>', '<', '<>', '-']);

export interface ArchLinkParts {
  row: ArchField | undefined;
  op: string;
  // undefined when that side is not a name or a role and a name
  from: ArchNodeRef | undefined;
  to: ArchNodeRef | undefined;
}

const isArchLinkInfix = (node: SyntaxNode | undefined): boolean =>
  !!node && ARCH_LINK_OPS.has(getArchNodeInfix(node)?.op ?? '');

// `Link: a > b [settings]`, `Link: client > Server api`: the row's words split at the one operator.
// `client > Server api` parses as `client > Server` applied to `api`, so the words are put back in order first.
export function getArchLinkParts (
  declaration: ElementDeclarationNode,
): ArchLinkParts | undefined {
  const [statement] = getArchNodeBody(declaration);
  if (!statement) return undefined;
  const row = getArchNodeField(statement);
  const words = row
    ? [row.callee, ...row.args].filter((word): word is SyntaxNode => !!word)
    : [statement];
  const at = words.findIndex(isArchLinkInfix);
  if (at < 0 || words.slice(at + 1).some(isArchLinkInfix)) return undefined;
  const infix = getArchNodeInfix(words[at])!;
  return {
    row,
    op: infix.op,
    from: getArchNodeRef([...words.slice(0, at), infix.left]),
    to: getArchNodeRef([infix.right, ...words.slice(at + 1)]),
  };
}

export function isArchInlineLink (attribute: AttributeNode): boolean {
  return ARCH_INLINE_LINK_KEYS.has(
    getArchNodeName(attribute.name)?.toLowerCase() ?? '',
  );
}

export function getArchInlineLinks (
  declaration: ElementDeclarationNode,
): AttributeNode[] {
  return (declaration.attributeList?.elementList ?? []).filter(
    (attribute): attribute is AttributeNode =>
      attribute instanceof AttributeNode && isArchInlineLink(attribute),
  );
}

export interface ArchInlineLink extends ArchNodeRef {
  op: string;
}

// undefined when the value is not one of the four operators followed by a name, or a role and a name
export function getArchInlineLink (
  attribute: AttributeNode,
): ArchInlineLink | undefined {
  const { value } = attribute;
  const applied = value instanceof FunctionApplicationNode ? value : undefined;
  const prefix = applied ? applied.callee : value;
  if (!(prefix instanceof PrefixExpressionNode) || !prefix.expression)
    return undefined;
  const op = prefix.op?.value;
  if (!op || !ARCH_LINK_OPS.has(op)) return undefined;
  const ref = getArchNodeRef([prefix.expression, ...(applied?.args ?? [])]);
  return ref && { op, ...ref };
}

// The members a group lists. Words on the line of `{` are names only; on a line of its own a member is a name, or a role and a name.
export interface ArchMembers {
  refs: ArchNodeRef[];
  // own-line rows that are neither
  bad: SyntaxNode[];
}

export function getArchMembers (group: ElementDeclarationNode): ArchMembers {
  const out: ArchMembers = { refs: [], bad: [] };
  const brace =
    group.body instanceof BlockExpressionNode
      ? group.body.blockOpenBrace
      : undefined;
  for (const row of getArchNodeBody(group)) {
    if (row instanceof ElementDeclarationNode) continue;
    const parsed = getArchNodeField(row);
    const words = parsed
      ? [parsed.callee, ...parsed.args].filter(
          (word): word is SyntaxNode => !!word,
        )
      : [row];
    if (!brace || row.startPos.line === brace.startPos.line) {
      out.refs.push(...words.map((word) => ({ node: word, braceLine: true })));
      continue;
    }
    const ref = getArchNodeRef(words);
    if (ref) out.refs.push(ref);
    else out.bad.push(row);
  }
  return out;
}

// The names a declaration refers to: its inline links, a group's members, a link's two ends
export function getArchRefs (
  declaration: ElementDeclarationNode,
): ArchNodeRef[] {
  const refs: ArchNodeRef[] = getArchInlineLinks(declaration)
    .map(getArchInlineLink)
    .filter((link): link is ArchInlineLink => !!link);
  switch (archSort(declaration)) {
    case 'group':
      refs.push(...getArchMembers(declaration).refs);
      break;
    case 'link': {
      const parts = getArchLinkParts(declaration);
      if (parts?.from) refs.push(parts.from);
      if (parts?.to) refs.push(parts.to);
      break;
    }
    default:
      break;
  }
  return refs;
}

// `owner: 'scott'` on a line of its own is a nested declaration whose type is the key
export interface ArchProperty {
  key: string;
  // undefined when there is a key and no value
  value: ArchSettingValue | undefined;
}

export function getArchProperty (node: SyntaxNode): ArchProperty | undefined {
  if (node instanceof ElementDeclarationNode) {
    const key = declarationWord(node);
    if (!key) return undefined;
    const [first] = getArchNodeBody(node);
    if (!first)
      return {
        key,
        value: undefined,
      };
    const row = getArchNodeField(first);
    return {
      key,
      value: row ? valueOf(row.callee ?? first) : valueOf(first),
    };
  }

  const row = getArchNodeField(node);
  const key = getArchNodeName(row?.callee);
  if (!key) return undefined;
  const [arg] = row?.args ?? [];
  return {
    key,
    value: arg === undefined ? undefined : valueOf(arg),
  };
}

const isNoteDeclaration = (node: SyntaxNode): node is ElementDeclarationNode =>
  node instanceof ElementDeclarationNode
  && node.type?.value.toLowerCase() === 'note';

// `Note: '...'` inside an element's or a group's body
export function getArchNoteDeclaration (
  declaration: ElementDeclarationNode,
): ElementDeclarationNode | undefined {
  return getArchNodeBody(declaration).find(isNoteDeclaration);
}

export function getArchNoteText (note: ElementDeclarationNode): string {
  return dedent(
    getArchNodeBody(note)
      .map((n) => getArchNodeName(getArchNodeField(n)?.callee) ?? '')
      .join(' '),
  );
}

// The common left margin is the author indenting their source, not part of the note
function dedent (text: string): string {
  const lines = text.split('\n');
  const indents = lines
    .filter((line) => line.trim())
    .map((line) => line.length - line.trimStart().length);
  const margin = indents.length ? Math.min(...indents) : 0;
  return lines
    .map((line) => line.slice(margin))
    .join('\n')
    .trim();
}

// Only these reach the page as a picture: anything else in an `href` can run script
export const IMAGE_URL = /^(https:\/\/|data:image\/)/i;

// One setting or custom property: `key: value` in `[ ]`, a `key: value` body line, or a bare word
export interface ArchPropertyEntry {
  key: string;
  // undefined for a bare word
  value: SyntaxNode | undefined;
  node: SyntaxNode;
  inBody: boolean;
}

export interface ArchPropertyRead {
  entries: ArchPropertyEntry[];
  // body lines with a key and no value
  bad: ElementDeclarationNode[];
}

// `[ ]` first, then the body, so a later entry wins. Inline links and `Note` lines are not properties.
// A bare word in the body is a flag on a node, and a member in a group.
export function getArchProperties (
  declaration: ElementDeclarationNode,
  bareWordIsAFlag: boolean,
): ArchPropertyRead {
  const out: ArchPropertyRead = { entries: [], bad: [] };
  for (const attribute of declaration.attributeList?.elementList ?? []) {
    if (!(attribute instanceof AttributeNode) || isArchInlineLink(attribute))
      continue;
    const key = getArchNodeName(attribute.name);
    if (key)
      out.entries.push({
        key,
        value: attribute.value,
        node: attribute,
        inBody: false,
      });
  }
  for (const row of getArchNodeBody(declaration)) {
    if (row instanceof ElementDeclarationNode) {
      const key = declarationWord(row);
      if (!key || key.toLowerCase() === 'note') continue;
      const [first] = getArchNodeBody(row);
      if (!first) {
        out.bad.push(row);
        continue;
      }
      out.entries.push({
        key,
        value: getArchNodeField(first)?.callee ?? first,
        node: row,
        inBody: true,
      });
      continue;
    }
    if (!bareWordIsAFlag) continue;
    const parsed = getArchNodeField(row);
    for (const part of parsed ? [parsed.callee, ...parsed.args] : []) {
      const key = getArchNodeName(part);
      if (key)
        out.entries.push({ key, value: undefined, node: row, inBody: true });
    }
  }
  return out;
}
