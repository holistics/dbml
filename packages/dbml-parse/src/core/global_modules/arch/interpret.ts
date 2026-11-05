import type Compiler from '@/compiler';
import { resolveArchType } from '@/core/arch';
import {
  IMAGE_URL,
  type ArchPropertyEntry,
  type ArchNodeRef,
  archSort,
  getArchNodeBody,
  declarationWord,
  getArchInlineLink,
  getArchLinkParts,
  getArchMembers,
  getArchNodeName,
  getArchNoteDeclaration,
  getArchNoteText,
  getArchProperties,
  getArchNodeField,
  extractArchNodeSettings,
} from '@/core/arch';
import { getArchRoleName, suggestType } from '@/core/arch';
import { CompileErrorCode, CompileWarning } from '@/core/types/errors';
import type { Filepath } from '@/core/types/filepath';
import { UNHANDLED } from '@/core/types/module';
import { AttributeNode, ElementDeclarationNode } from '@/core/types/nodes';
import Report from '@/core/types/report';
import type {
  ArchRef,
  CustomMetadata,
  CustomMetadataValue,
  Group,
  Link,
  LinkOp,
  Node,
} from '@/core/types/schemaJson';
import {
  type ElementSymbol,
  type NodeSymbol,
  SymbolKind,
} from '@/core/types/symbol';
import {
  ArchMetadataElementMetadata,
  type LinkMetadata,
} from '@/core/types/symbol/metadata';
import { extractMetadataValue, getTokenPosition } from '@/core/utils/interpret';
import { isExpressionAVariableNode } from '@/core/utils/validate';
import {
  type MetadataFieldRegistry,
  attachCustomMetadata,
} from '../metadata/utils';
import {
  GROUP_METADATA_FIELDS,
  NODE_METADATA_FIELDS,
  NOTE_METADATA_FIELDS,
} from '../metadata/registries';
import { getProgramSymbol } from '../utils';
import { getCandidates, getLocalHandle, getSymbolRole } from './utils';

// Warnings are raised here because DBML's validator and binder pass on errors only

// A name with no role that more than one element answers to: NAME_PRECEDENCE picks one, and the author is told which
function getAmbiguityWarnings (
  compiler: Compiler,
  name: string | undefined,
  at: ArchNodeRef['node'],
  kinds?: SymbolKind[],
): CompileWarning[] {
  if (name === undefined) return [];
  const meant = getCandidates(compiler, at.filepath, name, kinds).map(
    (symbol) => `${getSymbolRole(symbol)} ${name}`,
  );
  if (meant.length < 2) return [];
  const [used, ...others] = meant;
  const listed = `${meant.slice(0, -1).join(', ')} and ${meant[meant.length - 1]}`;
  const rest =
    others.length === 1
      ? `${others[0]} for the other`
      : `${others.slice(0, -1).join(', ')} or ${others[others.length - 1]} for the others`;
  return [
    new CompileWarning(
      CompileErrorCode.AMBIGUOUS_NAME,
      `${name} matches ${listed}; ${used} is used. Write ${rest}.`,
      at,
    ),
  ];
}

const getRefAmbiguityWarnings = (
  compiler: Compiler,
  ref: ArchNodeRef | undefined,
): CompileWarning[] =>
  ref && !ref.role
    ? getAmbiguityWarnings(compiler, getArchNodeName(ref.node), ref.node)
    : [];

// How the model names what a link or a group points at
function makeArchRef (
  compiler: Compiler,
  symbol: NodeSymbol | undefined,
  filepath: Filepath,
): ArchRef | undefined {
  const handle = symbol && getLocalHandle(compiler, symbol, filepath);
  const role = symbol && getSymbolRole(symbol);
  return handle === undefined || role === undefined
    ? undefined
    : { handle, role };
}

// The fields a `Metadata` block or a setting can change on the element a symbol names
export function getFieldsOf (
  symbol: NodeSymbol | undefined,
): MetadataFieldRegistry<any, any> {
  const role = symbol && getSymbolRole(symbol);
  if (role === 'Group') return GROUP_METADATA_FIELDS;
  if (role === 'Note') return NOTE_METADATA_FIELDS;
  return NODE_METADATA_FIELDS;
}

// `Metadata api { }` names no role, so the name may match more than one element
function getMetadataWarnings (
  compiler: Compiler,
  symbol: ElementSymbol,
  filepath: Filepath,
): CompileWarning[] {
  const program = getProgramSymbol(compiler, filepath);
  return compiler
    .symbolMetadata(symbol)
    .filter(
      (m): m is ArchMetadataElementMetadata =>
        m instanceof ArchMetadataElementMetadata
        && !!program
        && m.owners(compiler).includes(program),
    )
    .filter((block) => !block.declaration.name)
    .flatMap((block) =>
      getAmbiguityWarnings(
        compiler,
        block.declaration.targetKind?.value,
        block.declaration,
      ),
    );
}

// Settings go through their field, every other key is a custom property. A later entry wins, so the body wins over `[ ]`.
function applyProperties (
  element: Partial<Node | Group>,
  entries: ArchPropertyEntry[],
  fields: MetadataFieldRegistry<any, any>,
): void {
  const metadata = new Map<string, [string, CustomMetadataValue]>();
  for (const entry of entries) {
    const token = getTokenPosition(entry.node);
    const field = fields[entry.key.toLowerCase()];
    if (field) {
      const value = field.parse(entry.value);
      if (value !== undefined) field.assign(element, value, token);
      continue;
    }
    const value = extractMetadataValue(entry.value);
    if (value !== undefined)
      metadata.set(entry.key.toLowerCase(), [entry.key, { ...value, token }]);
  }
  element.metadata = Object.fromEntries(metadata.values());
}

function getNoteOf (declaration: ElementDeclarationNode): Node['note'] {
  const note = getArchNoteDeclaration(declaration);
  if (!note) return null;
  const value = getArchNoteText(note);
  return value
    ? {
        value,
        token: getTokenPosition(note),
      }
    : null;
}

export function interpretElement (
  compiler: Compiler,
  symbol: ElementSymbol,
  filepath: Filepath,
): Report<Node | Group | undefined> {
  const declaration = symbol.declaration;
  if (!(declaration instanceof ElementDeclarationNode))
    return new Report(undefined);
  const sort = archSort(declaration);
  const fields = getFieldsOf(symbol);
  const element: Partial<Node & Group> = {
    name: getArchNodeName(declaration.name) ?? '',
    alias: getArchNodeName(declaration.alias) ?? null,
    settings: {},
    note: null,
  };
  applyProperties(
    element,
    getArchProperties(declaration, sort === 'node').entries,
    fields,
  );
  // A `Note` line in the body wins over `[note: ...]`
  element.note = getNoteOf(declaration) ?? element.note;
  attachCustomMetadata(compiler, element, symbol, fields, filepath);
  const warnings = getMetadataWarnings(compiler, symbol, filepath);
  const token = getTokenPosition(declaration);

  if (sort === 'group') {
    const children: ArchRef[] = [];
    for (const ref of getArchMembers(declaration).refs) {
      if (!isExpressionAVariableNode(ref.node)) continue;
      const child = makeArchRef(
        compiler,
        compiler.nodeReferee(ref.node).getFiltered(UNHANDLED),
        filepath,
      );
      if (!child) continue;
      warnings.push(...getRefAmbiguityWarnings(compiler, ref));
      if (
        !children.some(
          (other) => other.handle === child.handle && other.role === child.role,
        )
      )
        children.push(child);
    }
    return new Report(
      {
        name: element.name!,
        alias: element.alias!,
        children,
        settings: element.settings!,
        metadata: element.metadata ?? {},
        note: element.note ?? null,
        token,
      },
      [],
      warnings,
    );
  }

  const word = declarationWord(declaration)!;
  const { settings } = element;
  const type =
    typeof settings!.type === 'string'
      ? (resolveArchType(settings!.type) ?? null)
      : null;
  if (typeof settings!.type === 'string' && !type) {
    warnings.push(
      new CompileWarning(
        CompileErrorCode.UNKNOWN_TYPE,
        `There is no type called ${settings!.type}. ${suggestType(settings!.type)}`,
        declaration,
      ),
    );
  }
  // Only an image URL is used; any other value is ignored
  const icon =
    typeof settings!.icon === 'string' && IMAGE_URL.test(settings!.icon.trim())
      ? settings!.icon.trim()
      : null;
  return new Report(
    {
      name: element.name!,
      alias: element.alias!,
      role: getArchRoleName(word) ?? word,
      type,
      icon,
      settings: settings!,
      metadata: element.metadata ?? {},
      note: element.note ?? null,
      token,
    },
    [],
    warnings,
  );
}

export function interpretLink (
  compiler: Compiler,
  metadata: LinkMetadata,
  filepath: Filepath,
): Report<Link | undefined> {
  const { declaration } = metadata;
  const op = metadata.op();
  const [fromSymbol, toSymbol] = metadata.endpoints(compiler);
  const from = makeArchRef(compiler, fromSymbol, filepath);
  const to = makeArchRef(compiler, toSymbol, filepath);
  if (!op || !from || !to) return new Report(undefined);
  // an inline link has no settings list of its own: the brackets it sits in are the element's
  const settings =
    declaration instanceof ElementDeclarationNode
      ? extractArchNodeSettings(
          getArchLinkParts(declaration)?.row?.settings
          ?? declaration.attributeList,
        )
      : {};
  const parts =
    declaration instanceof ElementDeclarationNode
      ? getArchLinkParts(declaration)
      : undefined;
  const warnings =
    declaration instanceof AttributeNode
      ? getRefAmbiguityWarnings(compiler, getArchInlineLink(declaration))
      : [
          ...getRefAmbiguityWarnings(compiler, parts?.from),
          ...getRefAmbiguityWarnings(compiler, parts?.to),
        ];
  return new Report(
    {
      from: from.handle,
      fromRole: from.role,
      to: to.handle,
      toRole: to.role,
      op: op as LinkOp,
      settings,
      token: getTokenPosition(declaration),
    },
    [],
    warnings,
  );
}

// The `key: value` rows of a `Metadata` block, read with the fields of the element it targets.
// A bad or repeated row is reported by validation and binding, and skipped here.
export function interpretArchMetadata (
  compiler: Compiler,
  metadata: ArchMetadataElementMetadata,
): Report<CustomMetadata> {
  const fields = getFieldsOf(metadata.target(compiler));
  const values: CustomMetadata = {};
  const seen = new Set<string>();
  for (const row of getArchNodeBody(metadata.declaration)) {
    if (!(row instanceof ElementDeclarationNode)) continue;
    const key = declarationWord(row);
    const [first] = getArchNodeBody(row);
    if (!key || !first || seen.has(key.toLowerCase())) continue;
    seen.add(key.toLowerCase());
    const node = getArchNodeField(first)?.callee ?? first;
    const token = getTokenPosition(row);
    const field = fields[key.toLowerCase()];
    const parsed = field
      ? field.parse(node)
      : extractMetadataValue(node)?.value;
    if (parsed === undefined) continue;
    values[key] = {
      value: parsed,
      type: field ? field.type : extractMetadataValue(node)!.type,
      token,
    };
  }
  return new Report(values);
}
