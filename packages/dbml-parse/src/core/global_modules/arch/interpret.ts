import type Compiler from '@/compiler';
import { resolveArchType } from '@/core/arch';
import {
  IMAGE_URL,
  type ArchPropertyEntry,
  archSort,
  getArchNodeBody,
  declarationWord,
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
import { ElementDeclarationNode } from '@/core/types/nodes';
import Report from '@/core/types/report';
import type {
  ArchRef,
  CustomMetadata,
  CustomMetadataValue,
  ArchGroup,
  ArchLink,
  ArchLinkOp,
  ArchNode,
} from '@/core/types/schemaJson';
import {
  type ElementSymbol,
  type NodeSymbol,
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
import { getLocalHandle, getSymbolRole } from './utils';

// Warnings are raised here because DBML's validator and binder pass on errors only

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

// Settings go through their field, every other key is a custom property. A later entry wins, so the body wins over `[ ]`.
function applyProperties (
  element: Partial<ArchNode | ArchGroup>,
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

function getNodeNote (declaration: ElementDeclarationNode): ArchNode['note'] {
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

// The resolved type of an element member; a group or a note has none
function getMemberType (compiler: Compiler, symbol: NodeSymbol, role: string, filepath: Filepath): string | null {
  if (role === 'Group' || role === 'Note') return null;
  const value = compiler.interpretSymbol(symbol, filepath).getFiltered(UNHANDLED);
  return value && !Array.isArray(value) && 'type' in value && typeof value.type === 'string'
    ? value.type
    : null;
}

// `stacked` draws a group's members as one card, which is meant for copies of one thing.
// Members of different roles or types are allowed, but their names are hidden, so this warns at the `stacked` setting.
function checkStackedMembers (
  compiler: Compiler,
  declaration: ElementDeclarationNode,
  children: ArchRef[],
  childSymbols: NodeSymbol[],
  filepath: Filepath,
): CompileWarning | undefined {
  if (children.length < 2) return undefined;
  const roles = new Set(children.map((child) => child.role));
  const types = new Set(children.map((child, i) => getMemberType(compiler, childSymbols[i], child.role, filepath)));
  const differs = [
    roles.size > 1 ? 'role' : undefined,
    types.size > 1 ? 'type' : undefined,
  ].filter(Boolean);
  if (!differs.length) return undefined;
  // The last `stacked` in `[ ]` or the body is the one that counts; one set by a Metadata block points at the group
  const setting = getArchProperties(declaration, false).entries
    .filter((entry) => entry.key.toLowerCase() === 'stacked')
    .pop();
  return new CompileWarning(
    CompileErrorCode.ARCH_STACKED_MIXED_MEMBERS,
    `stacked draws these ${children.length} members as one card; they differ in ${differs.join(' and ')}`,
    setting?.node ?? declaration,
  );
}

export function interpretElement (
  compiler: Compiler,
  symbol: ElementSymbol,
  filepath: Filepath,
): Report<ArchNode | ArchGroup | undefined> {
  const declaration = symbol.declaration;
  if (!(declaration instanceof ElementDeclarationNode))
    return new Report(undefined);
  const sort = archSort(declaration);
  const fields = getFieldsOf(symbol);
  const element: Partial<ArchNode & ArchGroup> = {
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
  element.note = getNodeNote(declaration) ?? element.note;
  attachCustomMetadata(compiler, element, symbol, fields, filepath);
  const warnings: CompileWarning[] = [];
  const token = getTokenPosition(declaration);

  if (sort === 'group') {
    const children: ArchRef[] = [];
    const childSymbols: NodeSymbol[] = [];
    for (const ref of getArchMembers(declaration).refs) {
      if (!isExpressionAVariableNode(ref.node)) continue;
      const symbol = compiler.nodeReferee(ref.node).getFiltered(UNHANDLED);
      const child = makeArchRef(compiler, symbol, filepath);
      if (!child) continue;
      if (
        !children.some(
          (other) => other.handle === child.handle && other.role === child.role,
        )
      ) {
        children.push(child);
        childSymbols.push(symbol!);
      }
    }
    if (element.settings!.stacked === true) {
      const warning = checkStackedMembers(compiler, declaration, children, childSymbols, filepath);
      if (warning) warnings.push(warning);
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
        CompileErrorCode.ARCH_UNKNOWN_TYPE,
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
): Report<ArchLink | undefined> {
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
  return new Report({
    from: from.handle,
    fromRole: from.role,
    to: to.handle,
    toRole: to.role,
    op: op as ArchLinkOp,
    settings,
    token: getTokenPosition(declaration),
  });
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
