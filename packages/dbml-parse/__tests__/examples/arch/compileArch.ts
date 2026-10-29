// The result shape the original architecture compiler gave, built from @dbml/parse, so its ported tests run against this pipeline
import Compiler from '@/compiler';
import { MemoryProjectLayout } from '@/compiler/projectLayout/layout';
import { isArchDiagramType } from '@/compiler/queries/files/fileKind';
import { CompileErrorCode } from '@/core/types/errors';
import { Filepath } from '@/core/types/filepath';
import type { ArchSettings, Database, TokenPosition } from '@/core/types/schemaJson';

export interface Located {
  file: string;
  range: {
    start: { line: number; column: number; offset: number };
    end: { line: number; column: number; offset: number };
  };
}

interface ElementBase {
  id: string;
  alias: string | null;
  label: string;
  settings: ArchSettings;
  note: string | null;
  parent: string | null;
  at: Located;
}

export interface NodeElement extends ElementBase {
  sort: 'node';
  role: string;
  type: string | null;
  image: string | null;
}

export interface GroupElement extends ElementBase {
  sort: 'group';
  children: string[];
}

export interface NoteElement extends ElementBase {
  sort: 'note';
  text: string;
}

export type Element = NodeElement | GroupElement | NoteElement;

export interface NetworkModel {
  frontMatter: Record<string, string>;
  elements: Map<string, Element>;
  links: { id: string; from: string; fromRole: string; to: string; toRole: string; op: string; settings: ArchSettings; at: Located }[];
  roots: string[];
  files: string[];
}

export interface ArchDiagnostic {
  severity: 'error' | 'warning';
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
  diagramType: string | null;
}

export const isNode = (e: Element | undefined): e is NodeElement => !!e && e.sort === 'node';
export const isGroup = (e: Element | undefined): e is GroupElement => !!e && e.sort === 'group';

// The codes the original compiler named; anything else came from the parser or DBML's binder, which it reported as `parse-<code>`
const CODE_NAMES: Partial<Record<number, string>> = {
  [CompileErrorCode.UNKNOWN_ROLE]: 'unknown-role',
  [CompileErrorCode.MISSING_NAME]: 'missing-name',
  [CompileErrorCode.DUPLICATE_NAME]: 'duplicate-name',
  [CompileErrorCode.NO_CUSTOM_ROLE]: 'no-custom-role',
  [CompileErrorCode.UNKNOWN_ENDPOINT]: 'unknown-endpoint',
  [CompileErrorCode.EMPTY_LINK]: 'empty-link',
  [CompileErrorCode.BAD_LINK]: 'bad-link',
  [CompileErrorCode.UNKNOWN_METADATA_TARGET]: 'unknown-metadata-target',
  [CompileErrorCode.BAD_PROPERTY]: 'bad-property',
  [CompileErrorCode.DUPLICATE_PROPERTY]: 'duplicate-property',
  [CompileErrorCode.DIAGRAM_TYPE_NOT_HERE]: 'diagram-type-not-here',
  [CompileErrorCode.METADATA_ROLE_MISMATCH]: 'metadata-role-mismatch',
  [CompileErrorCode.UNKNOWN_TYPE]: 'unknown-type',
  [CompileErrorCode.UNKNOWN_ICON]: 'unknown-icon',
  [CompileErrorCode.BAD_IMAGE]: 'bad-image',
  [CompileErrorCode.DUPLICATE_LINK]: 'duplicate-link',
  [CompileErrorCode.NESTED_ENDPOINTS]: 'nested-endpoints',
  [CompileErrorCode.BAD_MEMBER]: 'bad-member',
  [CompileErrorCode.AMBIGUOUS_NAME]: 'ambiguous-name',
};

const locate = (token: TokenPosition): Located => ({
  file: token.filepath.absolute,
  range: {
    start: token.start,
    end: token.end,
  },
});

interface Diagnosable {
  code: number;
  diagnostic: string;
  nodeOrToken: {
    startPos: { line: number; column: number };
    endPos: { line: number; column: number };
    filepath: Filepath;
  };
}

function toDiagnostic (d: Diagnosable, severity: 'error' | 'warning'): ArchDiagnostic {
  return {
    severity,
    code: CODE_NAMES[d.code] ?? `parse-${d.code}`,
    message: d.diagnostic,
    file: d.nodeOrToken.filepath.absolute,
    line: d.nodeOrToken.startPos.line + 1,
    column: d.nodeOrToken.startPos.column + 1,
    endLine: d.nodeOrToken.endPos.line + 1,
    endColumn: d.nodeOrToken.endPos.column + 1,
  };
}

export function compileArch (files: Record<string, string>, entry = '/main.arch.dbml'): ArchResult {
  const layout = new MemoryProjectLayout();
  for (const [path, source] of Object.entries(files)) {
    layout.setSource(Filepath.from(path.startsWith('/') ? path : `/${path}`), source);
  }
  const compiler = new Compiler(layout);
  const entryPath = Filepath.from(entry.startsWith('/') ? entry : `/${entry}`);
  const reachable = compiler.reachableFiles(entryPath);

  const diagnostics: ArchDiagnostic[] = [];
  const seen = new Set<string>();
  const add = (list: readonly unknown[], severity: 'error' | 'warning') => {
    for (const d of list as Diagnosable[]) {
      const out = toDiagnostic(d, severity);
      const key = JSON.stringify(out);
      if (seen.has(key)) continue;
      seen.add(key);
      diagnostics.push(out);
    }
  };

  for (const file of reachable) add(compiler.parseFile(file).getErrors(), 'error');
  for (const file of reachable) add(compiler.validateFile(file).getErrors(), 'error');
  add(compiler.bindNode(compiler.parseFile(entryPath).getValue().ast).getErrors(), 'error');

  const interpreted = compiler.interpretFile(entryPath);
  if (!diagnostics.length) {
    add(interpreted.getErrors(), 'error');
    add(interpreted.getWarnings(), 'warning');
  }

  return {
    model: modelOf(interpreted.getValue() as Database | undefined, reachable),
    diagnostics,
    diagramType: compiler.scanFile(entryPath).frontMatter.diagram_type ?? null,
  };
}

function modelOf (db: Database | undefined, reachable: Filepath[]): NetworkModel {
  const model: NetworkModel = {
    frontMatter: db?.frontMatter ?? {},
    elements: new Map(),
    links: [],
    roots: [],
    files: reachable.map((f) => f.absolute),
  };
  if (!db) return model;

  // A handle can repeat across roles: the second element with a handle is keyed `Role handle`
  const keyOf = (handle: string, role: string) => `${role}\u0000${handle}`;
  const parent = new Map<string, string>();
  for (const group of db.groups ?? []) for (const child of group.children) parent.set(keyOf(child.handle, child.role), group.alias ?? group.name);
  const idOf = (handle: string, role: string) => (model.elements.has(handle) ? `${role} ${handle}` : handle);

  for (const node of db.nodes ?? []) {
    const handle = node.alias ?? node.name;
    const id = idOf(handle, node.role);
    model.elements.set(id, {
      sort: 'node',
      id,
      alias: node.alias,
      label: node.name,
      role: node.role,
      type: node.type,
      image: node.image,
      settings: node.settings,
      note: node.note?.value ?? null,
      parent: parent.get(keyOf(handle, node.role)) ?? null,
      at: locate(node.token),
    });
  }
  for (const group of db.groups ?? []) {
    const handle = group.alias ?? group.name;
    const id = idOf(handle, 'Group');
    model.elements.set(id, {
      sort: 'group',
      id,
      alias: group.alias,
      label: group.name,
      children: group.children.map((child) => child.handle),
      settings: group.settings,
      note: group.note?.value ?? null,
      parent: parent.get(keyOf(handle, 'Group')) ?? null,
      at: locate(group.token),
    });
  }
  for (const note of db.notes ?? []) {
    const id = idOf(note.name, 'Note');
    model.elements.set(id, {
      sort: 'note',
      id,
      alias: null,
      label: note.name,
      text: note.content,
      settings: {},
      note: null,
      parent: parent.get(keyOf(note.name, 'Note')) ?? null,
      at: locate(note.token),
    });
  }

  model.links = (db.links ?? []).map((link, index) => ({
    id: `link-${index}`,
    from: link.from,
    fromRole: link.fromRole,
    to: link.to,
    toRole: link.toRole,
    op: link.op,
    settings: link.settings,
    at: locate(link.token),
  }));
  model.roots = [
    ...model.elements.values(),
  ].filter((e) => !e.parent).map((e) => e.id);
  return model;
}

export function isArchitecture (result: ArchResult): boolean {
  if (isArchDiagramType(result.diagramType)) return true;
  return [
    ...result.model.elements.values(),
  ].some((element) => element.sort !== 'note');
}
