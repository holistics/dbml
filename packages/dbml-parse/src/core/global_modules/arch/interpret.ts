import type Compiler from '@/compiler';
import { isIconName, resolveIcon } from '@/core/arch/icons';
import {
  IMAGE_REFUSED, IMAGE_URL, type Ref, archSort, bodyOf, declarationWord, inlineLinkOf, linkPartsOf, membersOf, nameOf, noteDeclarationOf,
  noteTextOf, propertyOf, readBody, settingsOf,
} from '@/core/arch/read';
import { roleName, suggestIcon } from '@/core/arch/vocabulary';
import { CompileErrorCode, CompileWarning } from '@/core/types/errors';
import type { Filepath } from '@/core/types/filepath';
import { UNHANDLED } from '@/core/types/module';
import { AttributeNode, ElementDeclarationNode } from '@/core/types/nodes';
import Report from '@/core/types/report';
import type {
  ArchRef, ArchSettings, Group, Link, LinkOp, Node,
} from '@/core/types/schemaJson';
import { type ElementSymbol, type NodeSymbol, SymbolKind } from '@/core/types/symbol';
import { ArchMetadataElementMetadata, type LinkMetadata } from '@/core/types/symbol/metadata';
import { getTokenPosition } from '@/core/utils/interpret';
import { isExpressionAVariableNode } from '@/core/utils/validate';
import { metadataFilePrecedence } from '../metadata/utils';
import { getProgramSymbol } from '../utils';
import { candidatesOf, localHandle, roleOfSymbol } from './utils';

// Warnings are raised here because DBML's validator and binder pass on errors only

// A name with no role that more than one element answers to: NAME_PRECEDENCE picks one, and the author is told which
function ambiguity (compiler: Compiler, name: string | undefined, at: Ref['node'], kinds?: SymbolKind[]): CompileWarning[] {
  if (name === undefined) return [];
  const meant = candidatesOf(compiler, at.filepath, name, kinds).map((symbol) => `${roleOfSymbol(symbol)} ${name}`);
  if (meant.length < 2) return [];
  const [used, ...others] = meant;
  const listed = `${meant.slice(0, -1).join(', ')} and ${meant[meant.length - 1]}`;
  const rest = others.length === 1 ? `${others[0]} for the other` : `${others.slice(0, -1).join(', ')} or ${others[others.length - 1]} for the others`;
  return [
    new CompileWarning(CompileErrorCode.AMBIGUOUS_NAME, `${name} matches ${listed}; ${used} is used. Write ${rest}.`, at),
  ];
}

const refAmbiguity = (compiler: Compiler, ref: Ref | undefined): CompileWarning[] => (ref && !ref.role ? ambiguity(compiler, nameOf(ref.node), ref.node) : []);

// How the model names what a link or a group points at
function archRef (compiler: Compiler, symbol: NodeSymbol | undefined, filepath: Filepath): ArchRef | undefined {
  const handle = symbol && localHandle(compiler, symbol, filepath);
  const role = symbol && roleOfSymbol(symbol);
  return handle === undefined || role === undefined ? undefined : { handle, role };
}

// `Metadata` blocks outrank the element's own settings: imported files first, later imports over earlier, this file last
function applyMetadata (compiler: Compiler, symbol: ElementSymbol, filepath: Filepath, settings: ArchSettings): CompileWarning[] {
  const warnings: CompileWarning[] = [];
  const program = getProgramSymbol(compiler, filepath);
  if (!program) return warnings;
  const precedence = metadataFilePrecedence(compiler, filepath);
  const blocks = compiler.symbolMetadata(symbol)
    .filter((m): m is ArchMetadataElementMetadata => m instanceof ArchMetadataElementMetadata && m.owners(compiler).includes(program))
    .sort((a, b) => {
      const rankA = precedence.get(a.declaration.filepath.intern()) ?? -1;
      const rankB = precedence.get(b.declaration.filepath.intern()) ?? -1;
      return rankA !== rankB ? rankA - rankB : a.declaration.start - b.declaration.start;
    });
  for (const block of blocks) {
    Object.assign(settings, interpretArchMetadata(block).getValue());
    // `Metadata api { }` names no role, so the name may match more than one element
    if (!block.declaration.name) warnings.push(...ambiguity(compiler, block.declaration.targetKind?.value, block.declaration, [SymbolKind.Element]));
  }
  return warnings;
}

function noteOf (declaration: ElementDeclarationNode): Node['note'] {
  const note = noteDeclarationOf(declaration);
  if (!note) return null;
  const value = noteTextOf(note);
  return value
    ? {
        value,
        token: getTokenPosition(note),
      }
    : null;
}

export function interpretElement (compiler: Compiler, symbol: ElementSymbol, filepath: Filepath): Report<Node | Group | undefined> {
  const declaration = symbol.declaration;
  if (!(declaration instanceof ElementDeclarationNode)) return new Report(undefined);
  const sort = archSort(declaration);
  const name = nameOf(declaration.name) ?? '';
  const token = getTokenPosition(declaration);

  const alias = nameOf(declaration.alias) ?? null;
  const settings = settingsOf(declaration.attributeList);
  readBody(declaration, settings, sort === 'node');

  if (sort === 'group') {
    const children: ArchRef[] = [];
    const warnings: CompileWarning[] = [];
    for (const ref of membersOf(declaration).refs) {
      if (!isExpressionAVariableNode(ref.node)) continue;
      const child = archRef(compiler, compiler.nodeReferee(ref.node).getFiltered(UNHANDLED), filepath);
      if (!child) continue;
      warnings.push(...refAmbiguity(compiler, ref));
      if (!children.some((other) => other.handle === child.handle && other.role === child.role)) children.push(child);
    }
    warnings.push(...applyMetadata(compiler, symbol, filepath, settings));
    return new Report({
      name,
      alias,
      children,
      settings,
      note: noteOf(declaration),
      token,
    }, [], warnings);
  }

  // The brand is read before `Metadata` applies, so a block cannot change the icon
  const { type, image } = brandOf(settings.type);
  const warnings = brandWarnings(settings.type, declaration);
  const word = declarationWord(declaration)!;
  const role = roleName(word) ?? word;
  warnings.push(...applyMetadata(compiler, symbol, filepath, settings));
  return new Report({
    name,
    alias,
    role,
    type,
    image,
    settings,
    note: noteOf(declaration),
    token,
  }, [], warnings);
}

function brandOf (raw: unknown): { type: string | null; image: string | null } {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value) return {
    type: null,
    image: null,
  };
  if (IMAGE_URL.test(value)) return {
    type: null,
    image: value,
  };
  return {
    type: isIconName(value) ? resolveIcon(value) : null,
    image: null,
  };
}

function brandWarnings (raw: unknown, declaration: ElementDeclarationNode): CompileWarning[] {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value || IMAGE_URL.test(value) || isIconName(value)) return [];
  if (/^[a-z]+:/i.test(value)) {
    return [
      new CompileWarning(CompileErrorCode.BAD_IMAGE, `${IMAGE_REFUSED} Got: ${value}`, declaration),
    ];
  }
  return [
    new CompileWarning(CompileErrorCode.UNKNOWN_TYPE, `There is no type called ${value}. ${suggestIcon(value)}`, declaration),
  ];
}

export function interpretLink (compiler: Compiler, metadata: LinkMetadata, filepath: Filepath): Report<Link | undefined> {
  const { declaration } = metadata;
  const op = metadata.op();
  const [fromSymbol, toSymbol] = metadata.endpoints(compiler);
  const from = archRef(compiler, fromSymbol, filepath);
  const to = archRef(compiler, toSymbol, filepath);
  if (!op || !from || !to) return new Report(undefined);
  // an inline link has no settings list of its own: the brackets it sits in are the element's
  const settings = declaration instanceof ElementDeclarationNode
    ? settingsOf(linkPartsOf(declaration)?.row?.settings ?? declaration.attributeList)
    : {};
  const parts = declaration instanceof ElementDeclarationNode ? linkPartsOf(declaration) : undefined;
  const warnings = declaration instanceof AttributeNode
    ? refAmbiguity(compiler, inlineLinkOf(declaration))
    : [...refAmbiguity(compiler, parts?.from), ...refAmbiguity(compiler, parts?.to)];
  return new Report({
    from: from.handle,
    fromRole: from.role,
    to: to.handle,
    toRole: to.role,
    op: op as LinkOp,
    settings,
    token: getTokenPosition(declaration),
  }, [], warnings);
}

// The `key: 'value'` rows of a `Metadata` block; a bad or repeated row is reported by validation and skipped here
export function interpretArchMetadata (metadata: ArchMetadataElementMetadata): Report<ArchSettings> {
  const values: ArchSettings = {};
  const seen = new Set<string>();
  for (const row of bodyOf(metadata.declaration)) {
    const entry = row instanceof ElementDeclarationNode ? propertyOf(row) : undefined;
    if (!entry || entry.value === undefined || seen.has(entry.key)) continue;
    seen.add(entry.key);
    values[entry.key] = entry.value;
  }
  return new Report(values);
}
