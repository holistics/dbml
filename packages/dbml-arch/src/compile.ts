import {
  Compiler, Filepath, MemoryProjectLayout, SyntaxTokenKind,
} from '@dbml/parse';

const FRONT_MATTER: string = SyntaxTokenKind.FRONT_MATTER;
import type {
  DbmlProjectLayout, ElementDeclarationNode, SyntaxNode, SyntaxToken,
} from '@dbml/parse';
import { emptyNetworkModel } from './model.js';
import type {
  Element, GroupElement, KindDef, Link, LinkOp, NetworkModel, NodeElement, Settings,
} from './model.js';
import {
  bodyOf, elementKindWord, infixOf, isElement, locate, nameOf, rowOf, settingsOf, targetOf,
} from './read.js';
import { resolveIcon } from './icons.js';
import { ARCH_TYPES, isArchDiagramType } from './frontmatter.js';
import {
  BUILTIN_KINDS, isIconName, isReserved, suggestIcon, suggestKind,
} from './vocabulary.js';

/**
 * THE ARCHITECTURE DIALECT.
 *
 * It borrows the whole front end: DBML's lexer, its parser, its file graph, its caching and its
 * positions. What it does not borrow is the vocabulary, because `Table` and `Server` have
 * nothing to say to each other, and because an architecture file is mostly bare nouns while a
 * DBML file is mostly bodies.
 *
 * Two switches make that possible and both are off for DBML:
 *
 *   new Compiler(layout, [], { allowBodylessElement: true })
 *
 * The empty module list means no DBML element can claim a node in an architecture file. The
 * grammar switch allows `Database mongo1` as a complete statement. Everything else in the
 * language, including `use * from`, port rows, `[settings]` and `a > b`, parses through DBML's
 * grammar unchanged; a probe of twenty constructs found those two and nothing more.
 *
 * Binding and interpretation are this dialect's own, below. They are deliberately not written
 * as `GlobalModule`s yet: a module buys symbol-level services (go to definition, rename, find
 * references) that nothing here asks for, at the cost of a symbol kind per element in DBML's
 * own enum. When the editor wants those services, this file is what becomes the modules.
 */

export type Severity = 'error' | 'warning';

export interface ArchDiagnostic {
  severity: Severity;
  code: string;
  message: string;
  file: string;
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
}

export interface ArchResult {
  model: NetworkModel;
  diagnostics: ArchDiagnostic[];
  /**
   * `Project x { diagram_type: 'architecture' }`, when the author said so.
   *
   * ADVISORY, NEVER A MODE. It decides which canvas a host opens on and which completions it
   * offers, and nothing else. What a file can draw is decided by its `Kind` declarations, which
   * is the only signal that survives being pasted into a cloud editor with no filename.
   *
   * It earns its place on the case inference cannot cover: a document holding four `Kind` lines
   * and no elements yet is not "unknown", it is an architecture diagram nobody has drawn on.
   * Without the marker the canvas flickers between answers while the author is still typing.
   */
  diagramType: string | null;
}

/**
 * The three places this dialect differs from DBML at the grammar level, and nowhere else.
 *
 * Front matter and bodyless elements are both things DBML has no use for: a DBML element always
 * carries something, and `Project { ... }` already holds file-level metadata. An architecture
 * file is mostly bare nouns, and people expect Markdown's `---` fence for metadata because they
 * have met it everywhere else.
 */
const DIALECT = {
  lexer: { allowFrontMatter: true },
  parser: { allowBodylessElement: true },
} as const;

/**
 * The naming convention, which is a convention and nothing more.
 *
 * The compiler never reads a file's name. What a file can draw is decided by the `Kind`
 * declarations it has, inline or imported, and nothing else. This string exists so a file tree
 * reads at a glance and so a CI glob over `.dbml` files still picks these up.
 *
 * The language goes last, the way it does in `.d.ts` and `.spec.ts`, and that is not only
 * taste: DBML's import resolver appends `.dbml` to any specifier that does not already end in
 * it, so `use * from './packs/devops.arch'` finds `devops.arch.dbml` with no change to the
 * resolver at all. Spelled the other way round, `devops.dbml.arch`, every form of the specifier
 * misses, and every tool that keys on the last extension stops seeing DBML.
 */
export const ARCH_SUFFIX = '.arch.dbml';

/** no DBML module may claim a node here; the dialect binds its own tree */
const ARCH_MODULES: [] = [];

/**
 * Is this document an architecture diagram?
 *
 * It lives here rather than in a host's view layer because it is a question about the language,
 * and because a host that gets it wrong shows an empty canvas to every DBML user on a public
 * page. Two ways to answer yes:
 *
 *   the author said so            `Project { diagram_type: 'architecture' }`
 *   the document drew something   a vocabulary, and an element built on it
 *
 * A vocabulary on its own is not a diagram, and a note on its own is not either: both are
 * things a half-written DBML file can contain by accident. An element whose kind came from a
 * `Kind` declaration is not an accident.
 */
export function isArchitecture (result: ArchResult): boolean {
  if (isArchDiagramType(result.diagramType)) return true;
  const { model } = result;
  if (!model || !model.kinds.size) return false;
  return [...model.elements.values()].some((element) => element.sort !== 'note');
}

export function archCompiler (layout: DbmlProjectLayout): Compiler {
  return new Compiler(layout, ARCH_MODULES, DIALECT);
}

/**
 * A project has many files and a drawing has one entry point.
 *
 * `MemoryProjectLayout` treats every file it holds as an entry point, which is right for a
 * language server that wants diagnostics on everything and wrong here: a project holding a DBML
 * schema beside an architecture document would report `Table is not a kind` against the schema,
 * a file this dialect was never asked to read. The entry and whatever it imports, nothing else.
 */
class SingleEntryLayout extends MemoryProjectLayout {
  constructor (private readonly entry: Filepath) {
    super();
  }

  getEntrypoints (): Filepath[] {
    return [this.entry];
  }
}

/** the usual case: a set of files in memory, one of them the entry point */
export function compileArch (files: Record<string, string>, entry = '/main.arch.dbml'): ArchResult {
  const absolute = entry.startsWith('/') ? entry : `/${entry}`;
  const layout = new SingleEntryLayout(Filepath.from(absolute));
  for (const [path, source] of Object.entries(files)) {
    layout.setSource(Filepath.from(path.startsWith('/') ? path : `/${path}`), source);
  }
  return interpret(archCompiler(layout), absolute);
}

export function interpret (compiler: Compiler, entry: string): ArchResult {
  const model = emptyNetworkModel();
  const diagnostics: ArchDiagnostic[] = [];
  let diagramType: string | null = null;
  const file = Filepath.from(entry);

  const say = (severity: Severity, code: string, message: string, node: SyntaxNode, where = entry): void => {
    const at = locate(node, where);
    diagnostics.push({
      severity,
      code,
      message,
      file: where,
      line: at.range.start.line,
      column: at.range.start.column,
      endLine: at.range.end.line,
      endColumn: at.range.end.column,
    });
  };

  /**
   * Every reachable file, dependencies first and the entry point last.
   *
   * `parseProject` walks `use` for us, which works with no modules registered at all: following
   * an import is a property of the file graph, not of the vocabulary. Ordering the entry last
   * means a name declared both in a pack and in the file that imported it resolves to the one
   * the author was looking at.
   */
  const project = compiler.parseProject();
  const paths = [...project.keys()].filter((p) => p !== file.absolute).sort();
  paths.push(file.absolute);

  const declarations: { node: ElementDeclarationNode; file: string }[] = [];
  for (const path of paths) {
    const parsed = project.get(path);
    if (!parsed) continue;
    for (const error of parsed.getErrors()) {
      diagnostics.push({
        severity: 'error',
        code: `parse-${error.code}`,
        message: error.message,
        file: path,
        line: (error.nodeOrToken?.startPos?.line ?? 0) + 1,
        column: (error.nodeOrToken?.startPos?.column ?? 0) + 1,
        endLine: (error.nodeOrToken?.endPos?.line ?? 0) + 1,
        endColumn: (error.nodeOrToken?.endPos?.column ?? 0) + 1,
      });
    }
    for (const node of parsed.getValue().ast.body) {
      if (isElement(node)) declarations.push({ node, file: path });
    }
    readFrontMatter(parsed.getValue().tokens, model.frontMatter);
  }
  model.files = paths;

  /**
   * WHERE A DOCUMENT SAYS WHAT IT IS, and why `Project` is the wrong place.
   *
   * It is tempting to copy DBML and write `Project { diagram_type: 'arch' }`, because DBML
   * has `database_type` sitting right there. The two are not the same kind of thing at all.
   * `database_type: 'PostgreSQL'` is a property OF THE DATABASE being described: it changes
   * which SQL comes out and nothing about how the file is read. A diagram type describes
   * neither the estate nor the project. It describes THE DOCUMENT, and says which pipeline
   * should pick it up.
   *
   * Which is also why it cannot live in `Project` even if we wanted it to. Finding a `Project`
   * block means parsing the file, and parsing is the thing we would be choosing. Front matter
   * is the one place a host can read WITHOUT parsing: it is fenced, it is first, and the lexer
   * hands it over as a single trivia token. A marker that selects a pipeline has to be
   * readable before the pipeline runs, and only front matter is.
   *
   * A `Project` block is still read, and warns, so nobody's existing file silently stops
   * working. `arch` is the canonical spelling, matching the `.arch.dbml` extension;
   * `architecture` is accepted because two spellings of one word is nobody's idea of a
   * language.
   */
  const fromFrontMatter = typeof model.frontMatter.diagram_type === 'string'
    ? model.frontMatter.diagram_type
    : null;
  if (fromFrontMatter) diagramType = fromFrontMatter;

  // ── pass one: the vocabulary ────────────────────────────────────────────────
  // Kinds are collected before anything that uses them, so a Kind may be declared below the
  // element that needs it. Order in a file is the author's business, not the compiler's.
  const vocabulary = new Vocabulary(model.kinds);
  for (const [name, spec] of Object.entries(BUILTIN_KINDS)) {
    vocabulary.set(name, {
      name, icon: spec.icon, glyph: null, image: null, category: spec.category, color: null, builtin: true, at: null,
    });
  }
  /**
   * It is NOT read here, and that is the point rather than an omission.
   *
   * A host has to route a document before it parses it, so the marker has to be readable
   * before parsing. Inside `Project` it is not: reaching it means parsing the file, and
   * parsing is the thing being chosen. Honouring it here would mean a file that works in this
   * compiler and is unroutable by the host that has to decide which compiler to call, which
   * is a worse failure than not working at all.
   */
  const sayMisplaced = (row: SyntaxNode): void => {
    say(
      'error',
      'diagram-type-not-here',
      'diagram_type has no effect inside Project. It says what the DOCUMENT is, and a host '
      + 'reads it before parsing, so it has to be in front matter:\n\n'
      + '---\ndiagram_type: arch\n---',
      row,
    );
  };

  for (const { node: declaration } of declarations) {
    if (elementKindWord(declaration) !== 'Project') continue;
    for (const row of bodyOf(declaration)) {
      if (isElement(row)) {
        // `diagram_type: 'architecture'` is a declaration whose type IS the key and whose body
        // is the value, the same shape DBML's own `database_type` has. The parser files it
        // under `type`, not under a callee, so it is read from there.
        const key = elementKindWord(row)?.toLowerCase();
        const value = nameOf(rowOf(bodyOf(row)[0])?.callee);
        if (key === 'diagram_type') { sayMisplaced(row); continue; }
        if (key && value !== undefined) model.frontMatter[key] = value;
        continue;
      }
      const parsed = rowOf(row);
      const key = nameOf(parsed?.callee)?.toLowerCase();
      const value = nameOf(parsed?.args[0]);
      if (key === 'diagram_type') { sayMisplaced(row); continue; }
      if (key && value !== undefined) model.frontMatter[key] = value;
    }
  }

  for (const { node: declaration, file: where } of declarations) {
    if (elementKindWord(declaration) !== 'Kind') continue;
    const name = nameOf(declaration.name);
    if (!name) continue;
    if (isReserved(name)) {
      say('error', 'reserved-kind', `${name} opens a declaration, so it cannot also be the name of a kind`, declaration, where);
      continue;
    }
    const settings = settingsOf(declaration.attributeList);
    const typed = typeof settings.icon === 'string' ? settings.icon : 'box';
    // a kind's `icon` takes a name or a URL, exactly as an element's `type` does
    const kindPicture = IMAGE_URL.test(typed) ? typed : null;
    if (!kindPicture && typeof settings.icon === 'string' && !isIconName(typed)) {
      const scheme = /^[a-z][a-z0-9+.-]*:/i.test(typed);
      say(
        'warning',
        scheme ? 'bad-image' : 'unknown-icon',
        scheme ? `${IMAGE_REFUSED} Got: ${typed}` : `There is no icon called ${typed}. ${suggestIcon(typed)}`,
        declaration,
        where,
      );
    }
    // several subpaths in one setting, because a mark is rarely one stroke
    const glyph = typeof settings.glyph === 'string'
      ? settings.glyph.split(';').map((d) => d.trim()).filter(Boolean)
      : null;
    vocabulary.set(name, {
      name,
      icon: !kindPicture && isIconName(typed) ? resolveIcon(typed) : 'box',
      glyph: glyph?.length ? glyph : null,
      image: kindPicture,
      category: 'custom',
      color: typeof settings.color === 'string' ? settings.color : null,
      builtin: false,
      at: locate(declaration, where),
    });
  }

  // ── pass two: the things ────────────────────────────────────────────────────
  for (const { node: declaration, file: where } of declarations) {
    const word = elementKindWord(declaration);
    if (!word
      || word === 'Kind' || word === 'Link' || word === 'Ref'
      || word === 'Metadata' || word === 'Project') continue;

    const name = nameOf(declaration.name);
    if (!name) {
      say('error', 'missing-name', `A ${word} needs a name`, declaration, where);
      continue;
    }
    if (model.elements.has(name)) {
      say('error', 'duplicate-name', `${name} is already declared`, declaration, where);
      continue;
    }

    if (word === 'Group') {
      model.elements.set(name, readGroup(declaration, name, where));
      continue;
    }
    if (word === 'Note') {
      const text = bodyOf(declaration).map((row) => nameOf(rowOf(row)?.callee) ?? '').join(' ').trim();
      model.elements.set(name, {
        sort: 'note',
        id: name,
        label: name,
        text,
        settings: {},
        meta: {},
        note: null,
        parent: null,
        at: locate(declaration, where),
      });
      continue;
    }

    const kindName = vocabulary.resolve(word);
    if (!kindName) {
      say('error', 'unknown-kind', `${word} is not a kind. ${suggestKind(word)}`, declaration, where);
      continue;
    }
    const node = readNode(declaration, name, kindName, where);

    // the brand, which beats the role's mark but never replaces the role itself
    const brand = readType(node.settings, declaration, where, say);
    node.type = brand.type;
    if (brand.image) node.image = brand.image;

    model.elements.set(name, node);
  }

  // ── pass three: parents, metadata, links ────────────────────────────────────
  for (const element of model.elements.values()) {
    if (element.sort !== 'group') continue;
    for (const child of element.children) {
      const target = model.elements.get(child);
      if (!target) continue;
      if (target.parent && target.parent !== element.id) {
        // the first container to claim a name keeps it; a second one is a real mistake
        continue;
      }
      target.parent = element.id;
    }
  }
  for (const element of model.elements.values()) {
    if (element.sort !== 'group') continue;
    element.children = element.children.filter((child) => model.elements.get(child)?.parent === element.id);
  }

  for (const { node: declaration, file: where } of declarations) {
    if (elementKindWord(declaration) !== 'Metadata') continue;
    /**
     * DBML's parser reads a second identifier after `Metadata` as the target KIND, because a
     * DBML metadata block names what it is attached to twice: `Metadata Table users { ... }`.
     * This dialect names the thing once, so the identifier the parser filed under `targetKind`
     * is the thing. Reading it from there is cheaper than teaching the grammar a second shape.
     */
    const name = declaration.targetKind?.value ?? nameOf(declaration.name);
    const target = name ? model.elements.get(name) : undefined;
    if (!target) {
      say('error', 'unknown-metadata-target', `${name ?? 'that'} is not declared anywhere`, declaration, where);
      continue;
    }
    for (const row of bodyOf(declaration)) {
      const parsedRow = rowOf(row);
      const key = nameOf(parsedRow?.callee);
      if (!key) continue;
      target.meta[key] = nameOf(parsedRow?.args[0]) ?? true;
    }
  }

  let counter = 0;
  const seen = new Set<string>();
  for (const { node: declaration, file: where } of declarations) {
    const word = elementKindWord(declaration);
    if (word !== 'Link' && word !== 'Ref') continue;
    const link = readLink(declaration, where, counter, say);
    if (!link) continue;

    const from = model.elements.get(link.from);
    const to = model.elements.get(link.to);
    if (!from) say('error', 'unknown-endpoint', `${link.from} is not declared anywhere`, declaration, where);
    if (!to) say('error', 'unknown-endpoint', `${link.to} is not declared anywhere`, declaration, where);
    if (!from || !to) continue;

    // A duplicate still draws, and a line to your own container still draws. They are opinions,
    // not structural errors, which is the whole reason they warn instead of stopping the page.
    const key = [link.from, link.to].sort().join('\u0000');
    if (seen.has(key)) say('warning', 'duplicate-link', `${link.from} and ${link.to} are already connected`, declaration, where);
    seen.add(key);
    if (from.parent === to.id || to.parent === from.id) {
      say('warning', 'nested-endpoints', `${link.from} is already inside ${link.to}`, declaration, where);
    }

    counter += 1;
    model.links.push(link);
  }

  model.roots = [...model.elements.values()].filter((e) => !e.parent).map((e) => e.id);
  return { model, diagnostics, diagramType };
}

function readGroup (declaration: ElementDeclarationNode, id: string, file: string): GroupElement {
  const settings = settingsOf(declaration.attributeList);
  const children: string[] = [];
  for (const row of bodyOf(declaration)) {
    // `{ api1  api2 }` on one line is a callee and an argument to DBML's parser, exactly as
    // `id integer` is in a table body. Both are member names here, so read the whole row.
    const parsed = rowOf(row);
    if (!parsed) continue;
    for (const part of [parsed.callee, ...parsed.args]) {
      const name = nameOf(part);
      if (name && !children.includes(name)) children.push(name);
    }
  }
  return {
    sort: 'group',
    id,
    label: typeof settings.name === 'string' ? settings.name : id,
    children,
    settings,
    meta: {},
    note: noteOf(declaration),
    parent: null,
    at: locate(declaration, file),
  };
}

/**
 * `type: 'haproxy'` — THE BRAND, which is a setting and not a keyword.
 *
 * The role is the word that opened the declaration and the brand is this. It resolves through
 * the icon pack's own alias table, so `pg`, `postgres` and `postgresql` are one thing and cost
 * one line between them rather than three keywords each.
 *
 * A URL is accepted in the same slot, which is the answer to the brand the pack has never
 * drawn: there is no second setting to learn, and nothing about the declaration changes.
 */
function readType (
  settings: Settings,
  declaration: ElementDeclarationNode,
  where: string,
  say: (s: Severity, c: string, m: string, n: SyntaxNode, w?: string) => void,
): { type: string | null; image: string | null } {
  const raw = settings.type;
  if (typeof raw !== 'string' || !raw.trim()) return { type: null, image: null };
  const value = raw.trim();

  if (IMAGE_URL.test(value)) return { type: null, image: value };
  if (isIconName(value)) return { type: resolveIcon(value), image: null };

  if (/^[a-z]+:/i.test(value)) {
    say('warning', 'bad-image', `${IMAGE_REFUSED} Got: ${value}`, declaration, where);
    return { type: null, image: null };
  }
  say('warning', 'unknown-type', `There is no type called ${value}. ${suggestIcon(value)}`, declaration, where);
  return { type: null, image: null };
}

/**
 * A KIND WORD IS CASE-INSENSITIVE, because `Table` is.
 *
 * DBML matches every element keyword on `value.toLowerCase()`: `table users {}` and
 * `Table users {}` are the same declaration, and so are `use` and `Use`. These words sit in
 * exactly that slot. `Database`, `Cache` and `LoadBalancer` are to this dialect what `Table`
 * is to DBML, so somebody who knows one should not discover that the other is stricter.
 *
 * It was case-sensitive until a reader pointed at the inconsistency, and the failure was the
 * worst kind: `database api` reported that `database` is not a kind, while `Database api` on
 * the next line worked.
 *
 * The CANONICAL spelling is kept, not the author's. A node records `Postgres` however it was
 * typed, so everything downstream - the renderer's icon lookup, a tooltip, a host reading the
 * model - sees one name per kind.
 */
class Vocabulary {
  private readonly canonical = new Map<string, string>();

  constructor (private readonly kinds: Map<string, KindDef>) {}

  set (name: string, def: KindDef): void {
    // a redeclaration in another case overrules the entry rather than sitting beside it
    const existing = this.canonical.get(name.toLowerCase());
    if (existing && existing !== name) this.kinds.delete(existing);
    this.canonical.set(name.toLowerCase(), name);
    this.kinds.set(name, def);
  }

  /** the canonical spelling of whatever was typed, or nothing if it is not a word we know */
  resolve (typed: string): string | undefined {
    return this.canonical.get(typed.toLowerCase());
  }
}


/**
 * A PICTURE WHERE A MARK WOULD GO, in whichever slot already names the mark.
 *
 * There is no `image` setting. There was one for a while and it was a second word for a thing
 * the language already had a word for: an element's picture is its `type`, and a kind's is its
 * `icon`. Which of the two you write is decided by what you are describing, never by whether
 * you happen to have a name or a URL in hand.
 *
 *   Database users_db [type: 'postgres']                      a brand the pack draws
 *   Database users_db [type: 'https://example.com/acme.svg']   one it has never heard of
 *
 * ONLY `https:` AND `data:image/`, AND THIS IS NOT A FORMALITY. The string ends up as an
 * `href` inside an SVG rendered in somebody else's page, and a `javascript:` href there
 * executes. The author of a diagram is not always the person opening it: a file arrives in a
 * pull request, a document is shared from another team. `http:` is refused as well, since it
 * breaks on any page served over TLS and the failure is a silently blank box.
 */
const IMAGE_URL = /^(https:\/\/|data:image\/)/i;

const IMAGE_REFUSED = 'A picture must be an https: URL or a data:image/ URI.';

/**
 * `Note: '...'` inside a body, in whichever element carries one.
 *
 * NEWLINES SURVIVE, which is the whole reason this is not a one-liner. A note on a container
 * is where a file listing goes, and a file listing is a list: flattening it to one line turns
 * reference material into a paragraph nobody reads. DBML's triple-quoted string already keeps
 * the line breaks, so all this has to do is not throw them away, and strip the indentation the
 * author used to keep the source readable.
 *
 * The text is handed on as the author wrote it. Whether `- a` becomes a bullet is the
 * renderer's business; the language's business is to deliver the characters intact.
 */
function noteOf (declaration: ElementDeclarationNode): string | null {
  for (const row of bodyOf(declaration)) {
    // `Note: 'DigitalOcean managed load balancer'` inside a body is a nested declaration
    if (!isElement(row)) continue;
    if (elementKindWord(row) !== 'Note') continue;
    const text = bodyOf(row).map((n) => nameOf(rowOf(n)?.callee) ?? '').join(' ');
    return dedent(text) || null;
  }
  return null;
}

/** the common left margin is the author indenting their source, not part of the note */
function dedent (text: string): string {
  const lines = text.split('\n');
  const indents = lines
    .filter((line) => line.trim())
    .map((line) => line.length - line.trimStart().length);
  const margin = indents.length ? Math.min(...indents) : 0;
  return lines.map((line) => line.slice(margin)).join('\n').trim();
}

function readNode (
  declaration: ElementDeclarationNode,
  id: string,
  kind: string,
  file: string,
): NodeElement {
  const settings = settingsOf(declaration.attributeList);
  const note = noteOf(declaration);

  return {
    sort: 'node',
    id,
    kind,
    type: null,
    image: null,
    label: typeof settings.name === 'string' ? settings.name : id,
    settings,
    meta: {},
    note,
    parent: null,
    at: locate(declaration, file),
  };
}

const LINK_OPS = new Set(['>', '<', '<>', '-']);

function readLink (
  declaration: ElementDeclarationNode,
  file: string,
  index: number,
  say: (s: Severity, c: string, m: string, n: SyntaxNode, where?: string) => void,
): Link | null {
  const [statement] = bodyOf(declaration);
  if (!statement) {
    say('error', 'empty-link', 'A Link needs two endpoints:  Link: a > b', declaration, file);
    return null;
  }
  const row = rowOf(statement);
  const infix = infixOf(row?.callee ?? statement);
  if (!infix || !LINK_OPS.has(infix.op)) {
    say('error', 'bad-link', 'A Link reads  a > b,  a < b,  a <> b  or  a - b', declaration, file);
    return null;
  }
  const from = targetOf(infix.left);
  const to = targetOf(infix.right);
  if (!from.id || !to.id) {
    say('error', 'bad-link', 'A Link reads  a > b,  a < b,  a <> b  or  a - b', declaration, file);
    return null;
  }
  const settings: Settings = settingsOf(row?.settings ?? declaration.attributeList);
  return {
    id: `link-${index}`,
    from: from.id,
    to: to.id,
    op: infix.op as LinkOp,
    settings,
    at: locate(declaration, file),
  };
}

export type { Element, KindDef, NetworkModel };

/**
 * `---` at the top of a file, Markdown's way of carrying metadata.
 *
 * The lexer hands it back as one trivia token with the fences still on, because a lexer that
 * understood YAML would be a lexer with a second language in it. The shape read here is the one
 * people actually write and the one `Project { ... }` uses: `key: value`, one per line. Nothing
 * nested, because nothing here needs nesting and half a YAML parser is worse than none.
 */
function readFrontMatter (tokens: readonly SyntaxToken[], into: Record<string, string>): void {
  // the lexer folds trivia into the next real token rather than leaving it in the stream, so
  // the block arrives as leading trivia on whatever declaration comes first
  const block = tokens
    .flatMap((token) => [token, ...token.leadingTrivia, ...token.trailingTrivia])
    .find((token) => token.kind === FRONT_MATTER);
  if (!block) return;
  for (const line of block.value.split('\n')) {
    const text = line.trim();
    if (!text || text === '---') continue;
    const colon = text.indexOf(':');
    if (colon <= 0) continue;
    const key = text.slice(0, colon).trim();
    const value = text.slice(colon + 1).trim().replace(/^['"]|['"]$/g, '');
    if (key) into[key] = value;
  }
}
