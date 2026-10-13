/**
 * WHAT THIS DIALECT PRODUCES, and who owns the definition.
 *
 * It lives here, in the open package, because it is the public output of an open compiler: a
 * host that wants to do something with an architecture document should not have to take a
 * drawing library to find out what is in one.
 *
 * The renderer declares the same shape for itself and satisfies this one structurally, which a
 * test on that side asserts. The dependency points one way on purpose: the closed package may
 * read the open one, never the other way round.
 */

export type LinkOp = '>' | '<' | '<>' | '-';

export type Category = 'compute' | 'data' | 'net' | 'edge' | 'people' | 'ops' | 'custom';

export type SettingValue = string | number | boolean;
export type Settings = Record<string, SettingValue>;

/** where something was written, so a click on the canvas can reach the line that made it */
export interface Located {
  file: string;
  range: {
    start: { line: number; column: number; offset: number };
    end: { line: number; column: number; offset: number };
  };
}

export interface KindDef {
  name: string;
  icon: string;
  /** raw path data, when the producer drew its own mark instead of naming one in the pack */
  glyph: string[] | null;
  category: Category;
  color: string | null;
  builtin: boolean;
  at: Located | null;
}

interface ElementBase {
  id: string;
  label: string;
  settings: Settings;
  meta: Settings;
  note: string | null;
  parent: string | null;
  at: Located;
}

export interface NodeElement extends ElementBase {
  sort: 'node';
  kind: string;
}

export interface GroupElement extends ElementBase {
  sort: 'group';
  /** ids, in the order the group lists them */
  children: string[];
}

export interface NoteElement extends ElementBase {
  sort: 'note';
  text: string;
}

export type Element = NodeElement | GroupElement | NoteElement;

export interface Link {
  id: string;
  from: string;
  to: string;
  op: LinkOp;
  settings: Settings;
  at: Located;
}

export interface NetworkModel {
  frontMatter: Record<string, string>;
  kinds: Map<string, KindDef>;
  elements: Map<string, Element>;
  links: Link[];
  /** ids with no parent, in declaration order */
  roots: string[];
  files: string[];
}

export const isNode = (e: Element | undefined): e is NodeElement => !!e && e.sort === 'node';
export const isGroup = (e: Element | undefined): e is GroupElement => !!e && e.sort === 'group';

export const emptyNetworkModel = (): NetworkModel => ({
  frontMatter: {},
  kinds: new Map(),
  elements: new Map(),
  links: [],
  roots: [],
  files: [],
});
