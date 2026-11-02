import type Compiler from '@/compiler';
import {
  archSort, bodyOf, declarationWord, handleOf, inlineLinkOf, inlineLinksOf, isDotted, isTopLevel, isTopLevelNote, linkPartsOf, membersOf,
  nameOf, propertiesOf, propertyOf, rowOf,
} from '@/core/arch/read';
import { GROUP_METADATA_FIELDS, NODE_METADATA_FIELDS } from '@/core/global_modules/metadata/registries';
import { extractMetadataValue, extractHexColor } from '@/core/utils/interpret';
import { AttributeNode } from '@/core/types/nodes';
import { NO_CUSTOM_ROLE_MESSAGE } from '@/core/arch/vocabulary';
import { CompileError, CompileErrorCode } from '@/core/types/errors';
import { PASS_THROUGH, type PassThrough } from '@/core/types/module';
import { ElementDeclarationNode, type SyntaxNode } from '@/core/types/nodes';
import Report from '@/core/types/report';
import type { Settings } from '@/core/utils/validate';
import NoteValidator from '../note/validate';
import ProjectValidator from '../project/validate';
import type { LocalModule } from '../types';

const DIRECTIONS = ['right', 'down'];

// The rows DBML accepts, and `direction` limited to the two layouts
function projectErrors (compiler: Compiler, declaration: ElementDeclarationNode): CompileError[] {
  const errors = new ProjectValidator(compiler, declaration).validate();
  for (const row of bodyOf(declaration)) {
    if (!(row instanceof ElementDeclarationNode) || declarationWord(row)?.toLowerCase() !== 'direction') continue;
    const value = nameOf(rowOf(bodyOf(row)[0])?.callee);
    if (value !== undefined && DIRECTIONS.includes(value)) continue;
    errors.push(new CompileError(CompileErrorCode.BAD_PROPERTY, "'direction' must be 'right' or 'down'", row));
  }
  return errors;
}

const DOTTED_MESSAGE = 'A link end is the name of a node, a group or a sticky note. `a.b` is not a name';

// Settings take their own values, custom properties take DBML's. A key repeated in the body is reported once.
function propertyErrors (declaration: ElementDeclarationNode, sort: 'node' | 'group'): CompileError[] {
  const errors: CompileError[] = [];
  const fields = sort === 'node' ? NODE_METADATA_FIELDS : GROUP_METADATA_FIELDS;
  const { entries, bad } = propertiesOf(declaration, sort === 'node');
  for (const row of bad) {
    errors.push(new CompileError(CompileErrorCode.BAD_PROPERTY, `A property reads  ${declarationWord(row)}: 'value'`, row));
  }
  const seen = new Set<string>();
  for (const entry of entries) {
    const key = entry.key.toLowerCase();
    if (entry.inBody) {
      if (seen.has(key)) {
        errors.push(new CompileError(CompileErrorCode.DUPLICATE_PROPERTY, `${entry.key} is set twice`, entry.node));
        continue;
      }
      seen.add(key);
    }
    const field = fields[key];
    if (field ? field.parse(entry.value) !== undefined : extractMetadataValue(entry.value) !== undefined) continue;
    errors.push(new CompileError(
      CompileErrorCode.BAD_PROPERTY,
      field ? field.message : `Custom setting '${entry.key}' must be a string, a color literal, a number literal, or a boolean literal`,
      entry.value ?? entry.node,
    ));
  }
  return errors;
}

function inlineLinkErrors (declaration: ElementDeclarationNode): CompileError[] {
  const errors: CompileError[] = [];
  for (const attribute of inlineLinksOf(declaration)) {
    if (attribute.value === undefined) {
      errors.push(new CompileError(CompileErrorCode.EMPTY_LINK, 'An inline link needs an endpoint:  [link: > b]', attribute));
      continue;
    }
    const end = inlineLinkOf(attribute)?.node;
    if (isDotted(end)) {
      errors.push(new CompileError(CompileErrorCode.BAD_LINK, DOTTED_MESSAGE, end!));
      continue;
    }
    if (!nameOf(end)) {
      errors.push(new CompileError(CompileErrorCode.BAD_LINK, 'An inline link reads  [link: > b],  [link: < b],  [link: <> b]  or  [link: - b]', attribute));
    }
  }
  return errors;
}

// The errors a declaration shows on its own. Warnings come from the interpreter, where DBML collects them.
function validate (declaration: ElementDeclarationNode): Report<void> {
  const errors: CompileError[] = [];
  const word = declarationWord(declaration)!;
  const sort = archSort(declaration);

  switch (sort) {
    case 'node':
    case 'group': {
      if (!nameOf(declaration.name)) {
        errors.push(new CompileError(CompileErrorCode.MISSING_NAME, `A ${word} needs a name`, declaration));
        break;
      }
      errors.push(...inlineLinkErrors(declaration));
      if (sort === 'group') {
        const members = membersOf(declaration);
        for (const row of members.bad) {
          errors.push(new CompileError(CompileErrorCode.BAD_MEMBER, 'A member line holds one member: a name, or a role and a name (Server api)', row));
        }
        for (const ref of members.refs.filter((member) => isDotted(member.node))) {
          errors.push(new CompileError(CompileErrorCode.BAD_MEMBER, 'A member is the name of a node, a group or a sticky note. `a.b` is not a name', ref.node));
        }
      }
      errors.push(...propertyErrors(declaration, sort));
      break;
    }

    case 'kind': {
      errors.push(new CompileError(CompileErrorCode.NO_CUSTOM_ROLE, NO_CUSTOM_ROLE_MESSAGE, declaration));
      break;
    }

    case 'link': {
      if (!bodyOf(declaration)[0]) {
        errors.push(new CompileError(CompileErrorCode.EMPTY_LINK, 'A Link needs two endpoints:  Link: a > b', declaration));
        break;
      }
      const parts = linkPartsOf(declaration);
      const dotted = [parts?.from?.node, parts?.to?.node].find(isDotted);
      if (dotted) {
        errors.push(new CompileError(CompileErrorCode.BAD_LINK, DOTTED_MESSAGE, dotted));
        break;
      }
      if (!parts || !nameOf(parts.from?.node) || !nameOf(parts.to?.node)) {
        errors.push(new CompileError(CompileErrorCode.BAD_LINK, 'A Link reads  a > b,  a < b,  a <> b  or  a - b', declaration));
        break;
      }
      if (declaration.attributeList && parts.row?.settings) {
        errors.push(new CompileError(
          CompileErrorCode.BAD_LINK,
          'Write the link settings in one place: before the colon or after the second end',
          parts.row.settings,
        ));
      }
      for (const attribute of (parts.row?.settings ?? declaration.attributeList)?.elementList ?? []) {
        if (!(attribute instanceof AttributeNode) || nameOf(attribute.name)?.toLowerCase() !== 'color') continue;
        if (extractHexColor(attribute.value) === undefined) {
          errors.push(new CompileError(CompileErrorCode.BAD_PROPERTY, "'color' must be a color literal", attribute.value ?? attribute));
        }
      }
      break;
    }

    case 'metadata': {
      const seen = new Set<string>();
      for (const row of bodyOf(declaration)) {
        const entry = row instanceof ElementDeclarationNode ? propertyOf(row) : undefined;
        if (!entry || entry.value === undefined) {
          errors.push(new CompileError(CompileErrorCode.BAD_PROPERTY, "A Metadata field must use the 'key: value' syntax", row));
          continue;
        }
        if (seen.has(entry.key.toLowerCase())) {
          errors.push(new CompileError(CompileErrorCode.DUPLICATE_PROPERTY, 'Duplicate Metadata fields are defined', row));
          continue;
        }
        seen.add(entry.key.toLowerCase());
      }
      break;
    }

    default:
      break;
  }

  return new Report(undefined, errors);
}

// Notes and Project are read by DBML's own modules
const isArchDeclaration = (node: SyntaxNode): node is ElementDeclarationNode => isTopLevel(node) && !isTopLevelNote(node) && archSort(node) !== 'project';

export const archModule: LocalModule = {
  validateNode (compiler: Compiler, node: SyntaxNode): Report<void> | Report<PassThrough> {
    // A note is a sticky note, but one that can carry inline links
    if (isTopLevelNote(node)) {
      const note = node as ElementDeclarationNode;
      return new Report(undefined, [
        ...(note.body ? [] : [new CompileError(CompileErrorCode.INVALID_NOTE, `A sticky note needs a body:  Note ${nameOf(note.name) ?? 'name'} { 'text' }`, note)]),
        ...inlineLinkErrors(note),
        ...new NoteValidator(compiler, note).validate(),
      ]);
    }
    if (!isTopLevel(node)) return Report.create(PASS_THROUGH);
    if (archSort(node) === 'project') return new Report(undefined, projectErrors(compiler, node));
    return validate(node);
  },

  nodeFullname (compiler: Compiler, node: SyntaxNode): Report<string[] | undefined> | Report<PassThrough> {
    if (!isArchDeclaration(node)) return Report.create(PASS_THROUGH);
    const sort = archSort(node);
    const name = sort === 'node' || sort === 'group' ? handleOf(node) : undefined;
    return new Report(name === undefined
      ? undefined
      : [
          name,
        ]);
  },

  // The `as` word is the element's name for lookup, so there is no separate alias symbol
  nodeAlias (compiler: Compiler, node: SyntaxNode): Report<string | undefined> | Report<PassThrough> {
    if (!isArchDeclaration(node)) return Report.create(PASS_THROUGH);
    return new Report(undefined);
  },

  nodeSettings (compiler: Compiler, node: SyntaxNode): Report<Settings> | Report<PassThrough> {
    if (!isArchDeclaration(node)) return Report.create(PASS_THROUGH);
    return new Report({});
  },
};
