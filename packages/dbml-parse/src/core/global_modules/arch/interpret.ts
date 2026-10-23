import type Compiler from '@/compiler';
import { isIconName, resolveIcon } from '@/core/arch/icons';
import {
  IMAGE_REFUSED, IMAGE_URL, archSort, bodyOf, declarationWord, linkPartsOf, nameOf, noteDeclarationOf,
  noteTextOf, propertyOf, readBody, settingsOf,
} from '@/core/arch/read';
import { roleName, suggestIcon } from '@/core/arch/vocabulary';
import { CompileErrorCode, CompileWarning } from '@/core/types/errors';
import type { Filepath } from '@/core/types/filepath';
import { UNHANDLED } from '@/core/types/module';
import { ElementDeclarationNode, FunctionApplicationNode } from '@/core/types/nodes';
import Report from '@/core/types/report';
import type {
  ArchSettings, Group, Link, LinkOp, Node,
} from '@/core/types/schemaJson';
import type { ElementSymbol } from '@/core/types/symbol';
import { ArchMetadataElementMetadata, type LinkMetadata } from '@/core/types/symbol/metadata';
import { getTokenPosition } from '@/core/utils/interpret';
import { isExpressionAVariableNode } from '@/core/utils/validate';
import { metadataFilePrecedence } from '../metadata/utils';
import { getProgramSymbol } from '../utils';
import { originalHandle } from './utils';

// Warnings are raised here because DBML's validator and binder pass on errors only

// `Metadata` blocks outrank the element's own settings: imported files first, later imports over earlier, this file last
function applyMetadata (compiler: Compiler, symbol: ElementSymbol, filepath: Filepath, settings: ArchSettings, role?: string): CompileWarning[] {
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
    // `Metadata Database api` where `api` is a Server still applies, with a warning
    const stated = block.declaration.name ? block.declaration.targetKind?.value : undefined;
    if (role && stated && role.toLowerCase() !== stated.toLowerCase()) {
      warnings.push(new CompileWarning(
        CompileErrorCode.METADATA_ROLE_MISMATCH,
        `${nameOf(block.declaration.name)} is a ${role}, not a ${stated}`,
        block.declaration,
      ));
    }
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
    const children: string[] = [];
    for (const row of bodyOf(declaration)) {
      if (!(row instanceof FunctionApplicationNode)) continue;
      for (const part of [
        row.callee,
        ...row.args,
      ]) {
        if (!isExpressionAVariableNode(part)) continue;
        const member = compiler.nodeReferee(part).getFiltered(UNHANDLED);
        const handle = member && originalHandle(compiler, member, filepath);
        if (handle !== undefined && !children.includes(handle)) children.push(handle);
      }
    }
    const warnings = applyMetadata(compiler, symbol, filepath, settings);
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
  warnings.push(...applyMetadata(compiler, symbol, filepath, settings, role));
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
  const [from, to] = metadata.endpoints(compiler);
  const fromHandle = from && originalHandle(compiler, from, filepath);
  const toHandle = to && originalHandle(compiler, to, filepath);
  if (!op || fromHandle === undefined || toHandle === undefined) return new Report(undefined);
  // an inline link has no settings list of its own: the brackets it sits in are the element's
  const settings = declaration instanceof ElementDeclarationNode
    ? settingsOf(linkPartsOf(declaration)?.row?.settings ?? declaration.attributeList)
    : {};
  return new Report({
    from: fromHandle,
    to: toHandle,
    op: op as LinkOp,
    settings,
    token: getTokenPosition(declaration),
  });
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
