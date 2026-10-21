import type Compiler from '@/compiler';
import {
  archSort, bodyOf, declarationWord, endpointNode, handleOf, inlineLinkOf, inlineLinksOf, isTopLevel, linkPartsOf, nameOf,
  propertyOf, readBody, rowOf, settingsOf,
} from '@/core/arch/read';
import { isReserved } from '@/core/arch/vocabulary';
import { CompileError, CompileErrorCode } from '@/core/types/errors';
import { PASS_THROUGH, type PassThrough } from '@/core/types/module';
import { ElementDeclarationNode, type SyntaxNode } from '@/core/types/nodes';
import Report from '@/core/types/report';
import type { Settings } from '@/core/utils/validate';
import type { LocalModule } from '../types';

// The errors a declaration shows on its own. Warnings come from the interpreter, where DBML collects them.
function validate (declaration: ElementDeclarationNode): Report<void> {
  const errors: CompileError[] = [];
  const word = declarationWord(declaration)!;
  const sort = archSort(declaration);

  switch (sort) {
    case 'node':
    case 'group':
    case 'note': {
      if (!nameOf(declaration.name)) {
        errors.push(new CompileError(CompileErrorCode.MISSING_NAME, `A ${word} needs a name`, declaration));
        break;
      }
      for (const attribute of inlineLinksOf(declaration)) {
        if (attribute.value === undefined) {
          errors.push(new CompileError(CompileErrorCode.EMPTY_LINK, 'An inline link needs an endpoint:  [link: > b]', attribute));
          continue;
        }
        if (!nameOf(inlineLinkOf(attribute)?.target)) {
          errors.push(new CompileError(CompileErrorCode.BAD_LINK, 'An inline link reads  [link: > b],  [link: < b],  [link: <> b]  or  [link: - b]', attribute));
        }
      }
      if (sort === 'note') break;
      for (const problem of readBody(declaration, settingsOf(declaration.attributeList), sort === 'node').problems) {
        errors.push(new CompileError(
          problem.code === 'bad' ? CompileErrorCode.BAD_PROPERTY : CompileErrorCode.DUPLICATE_PROPERTY,
          problem.message,
          problem.node,
        ));
      }
      break;
    }

    case 'kind': {
      const name = nameOf(declaration.name);
      if (name && isReserved(name)) {
        errors.push(new CompileError(CompileErrorCode.RESERVED_KIND, `${name} opens a declaration, so it cannot also be the name of a kind`, declaration));
      }
      break;
    }

    case 'link': {
      if (!bodyOf(declaration)[0]) {
        errors.push(new CompileError(CompileErrorCode.EMPTY_LINK, 'A Link needs two endpoints:  Link: a > b', declaration));
        break;
      }
      const parts = linkPartsOf(declaration);
      if (!parts || !nameOf(endpointNode(parts.infix.left)) || !nameOf(endpointNode(parts.infix.right))) {
        errors.push(new CompileError(CompileErrorCode.BAD_LINK, 'A Link reads  a > b,  a < b,  a <> b  or  a - b', declaration));
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
        if (seen.has(entry.key)) {
          errors.push(new CompileError(CompileErrorCode.DUPLICATE_PROPERTY, 'Duplicate Metadata fields are defined', row));
          continue;
        }
        seen.add(entry.key);
      }
      break;
    }

    case 'project': {
      for (const row of bodyOf(declaration)) {
        const key = row instanceof ElementDeclarationNode ? declarationWord(row) : nameOf(rowOf(row)?.callee);
        if (key?.toLowerCase() !== 'diagram_type') continue;
        errors.push(new CompileError(
          CompileErrorCode.DIAGRAM_TYPE_NOT_HERE,
          'diagram_type has no effect inside Project. It says what the DOCUMENT is, and a host '
          + 'reads it before parsing, so it has to be in front matter:\n\n'
          + '---\ndiagram_type: arch\n---',
          row,
        ));
      }
      break;
    }

    default:
      break;
  }

  return new Report(undefined, errors);
}

export const archModule: LocalModule = {
  validateNode (compiler: Compiler, node: SyntaxNode): Report<void> | Report<PassThrough> {
    if (!isTopLevel(node)) return Report.create(PASS_THROUGH);
    return validate(node);
  },

  nodeFullname (compiler: Compiler, node: SyntaxNode): Report<string[] | undefined> | Report<PassThrough> {
    if (!isTopLevel(node)) return Report.create(PASS_THROUGH);
    const sort = archSort(node);
    const name = sort === 'kind'
      ? nameOf(node.name)
      : sort === 'node' || sort === 'group' || sort === 'note'
        ? handleOf(node)
        : undefined;
    return new Report(name === undefined
      ? undefined
      : [
          name,
        ]);
  },

  // The `as` word is the element's name for lookup, so there is no separate alias symbol
  nodeAlias (compiler: Compiler, node: SyntaxNode): Report<string | undefined> | Report<PassThrough> {
    if (!isTopLevel(node)) return Report.create(PASS_THROUGH);
    return new Report(undefined);
  },

  nodeSettings (compiler: Compiler, node: SyntaxNode): Report<Settings> | Report<PassThrough> {
    if (!isTopLevel(node)) return Report.create(PASS_THROUGH);
    return new Report({});
  },
};
