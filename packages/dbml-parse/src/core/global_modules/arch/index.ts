import type Compiler from '@/compiler';
import {
  type Ref, archSort, bodyOf, declarationWord, handleOf, inlineLinkOf, inlineLinksOf, isInlineLink, isTopLevel, isTopLevelNote,
  linkPartsOf, membersOf, nameOf, roleWord, topLevelDeclaration,
} from '@/core/arch/read';
import { roleName, suggestRole } from '@/core/arch/vocabulary';
import { CompileError, CompileErrorCode } from '@/core/types/errors';
import type { Filepath } from '@/core/types/filepath';
import { PASS_THROUGH, type PassThrough, UNHANDLED } from '@/core/types/module';
import {
  AttributeNode, BlockExpressionNode, ElementDeclarationNode, FunctionApplicationNode, type SyntaxNode, UseSpecifierNode,
} from '@/core/types/nodes';
import Report from '@/core/types/report';
import type { SchemaElement } from '@/core/types/schemaJson';
import { ElementSymbol, type NodeSymbol, SymbolKind } from '@/core/types/symbol';
import { ArchMetadataElementMetadata, LinkMetadata, type NodeMetadata } from '@/core/types/symbol/metadata';
import { isExpressionAVariableNode } from '@/core/utils/validate';
import type { GlobalModule } from '../types';
import { interpretArchMetadata, interpretElement, interpretLink } from './interpret';
import { lookupVisible, resolveName } from './utils';

// Nodes, groups and notes take `[link: > b]`
const takesInlineLinks = (declaration: ElementDeclarationNode): boolean => ['node', 'group'].includes(archSort(declaration) ?? '') || isTopLevelNote(declaration);

const describe = (name: string, role?: string): string => (role ? `${role} ${name}` : name);

const notDeclared = (code: CompileErrorCode, name: string, at: SyntaxNode, role?: string) => new CompileError(code, `${describe(name, role)} is not declared anywhere`, at);

// A table visible under that name, which a link or a group cannot use
function tableError (compiler: Compiler, node: SyntaxNode, name: string, rule: string): CompileError | undefined {
  if (!lookupVisible(compiler, node.filepath, SymbolKind.Table, name)) return undefined;
  return new CompileError(CompileErrorCode.BINDING_ERROR, `${name} is a table; ${rule}`, node);
}

// A link end, written in `Link: a > b` or after the operator of an inline `[link: > b]`
function linkEndpointReferee (compiler: Compiler, ref: Ref, name: string, at: SyntaxNode): Report<NodeSymbol | undefined> {
  const found = resolveName(compiler, ref.node.filepath, name, ref.role);
  if (found) return new Report(found);
  return new Report(undefined, [
    (ref.role ? undefined : tableError(compiler, ref.node, name, 'a link joins elements')) ?? notDeclared(CompileErrorCode.UNKNOWN_ENDPOINT, name, at, ref.role),
  ]);
}

function nodeRefereeOfDeclaration (compiler: Compiler, node: SyntaxNode, declaration: ElementDeclarationNode): Report<NodeSymbol | undefined> {
  const name = nameOf(node);
  if (name === undefined) return new Report(undefined);

  const inline = takesInlineLinks(declaration)
    ? inlineLinksOf(declaration).map(inlineLinkOf).find((link) => link?.node === node)
    : undefined;
  if (inline) return linkEndpointReferee(compiler, inline, name, node);

  switch (archSort(declaration)) {
    case 'group': {
      // A name never declared is left out of the group, not reported; a table is reported
      const ref = membersOf(declaration).refs.find((member) => member.node === node);
      if (!ref) return new Report(undefined);
      const found = resolveName(compiler, node.filepath, name, ref.role);
      const table = found || ref.role ? undefined : tableError(compiler, node, name, 'a group lists elements and groups');
      return new Report(found, table ? [table] : []);
    }

    case 'link': {
      const parts = linkPartsOf(declaration);
      const ref = [parts?.from, parts?.to].find((end) => end?.node === node);
      if (!ref) return new Report(undefined);
      return linkEndpointReferee(compiler, ref, name, declaration);
    }

    case 'metadata': {
      if (!declaration.name?.containsEq(node)) return new Report(undefined);
      const role = roleWord(declaration.targetKind?.value);
      const found = resolveName(compiler, node.filepath, name, role, [SymbolKind.Element]);
      return found
        ? new Report(found)
        : new Report(undefined, [
            notDeclared(CompileErrorCode.UNKNOWN_METADATA_TARGET, name, declaration, role ?? declaration.targetKind?.value),
          ]);
    }

    default:
      return new Report(undefined);
  }
}

function bindDeclaration (compiler: Compiler, declaration: ElementDeclarationNode): Report<void> {
  const errors: CompileError[] = [];
  const word = declarationWord(declaration)!;

  if (takesInlineLinks(declaration)) {
    for (const attribute of inlineLinksOf(declaration)) {
      const target = inlineLinkOf(attribute)?.node;
      if (target && isExpressionAVariableNode(target)) errors.push(...compiler.nodeReferee(target).getErrors());
    }
  }

  switch (archSort(declaration)) {
    case 'node':
      if (nameOf(declaration.name) !== undefined && !roleName(word)) {
        errors.push(new CompileError(CompileErrorCode.UNKNOWN_ROLE, `${word} is not a role. ${suggestRole(word)}`, declaration));
      }
      break;

    case 'group':
      for (const { node } of membersOf(declaration).refs) {
        if (isExpressionAVariableNode(node)) errors.push(...compiler.nodeReferee(node).getErrors());
      }
      break;

    case 'link': {
      const parts = linkPartsOf(declaration);
      for (const end of [parts?.from, parts?.to]) {
        if (end && isExpressionAVariableNode(end.node)) errors.push(...compiler.nodeReferee(end.node).getErrors());
      }
      break;
    }

    case 'metadata': {
      if (isExpressionAVariableNode(declaration.name)) errors.push(...compiler.nodeReferee(declaration.name).getErrors());
      if (!new ArchMetadataElementMetadata(declaration).target(compiler) && !errors.length) {
        const name = nameOf(declaration.name) ?? declaration.targetKind?.value ?? 'that';
        errors.push(notDeclared(CompileErrorCode.UNKNOWN_METADATA_TARGET, name, declaration));
      }
      break;
    }

    default:
      break;
  }

  return new Report(undefined, errors);
}

// `use { Database users_db } from './x'`: the word must say what the element is
function bindUseSpecifier (compiler: Compiler, specifier: UseSpecifierNode): Report<void> {
  if (!specifier.name) return new Report(undefined);
  const result = compiler.nodeReferee(specifier.name);
  const errors = [
    ...result.getErrors(),
  ];
  const found = result.getFiltered(UNHANDLED)?.originalSymbol;
  const word = specifier.importKind?.value;
  const declaration = found?.declaration;
  if (word && found?.isKind(SymbolKind.Element) && declaration instanceof ElementDeclarationNode) {
    const declaredWord = declarationWord(declaration)!;
    const expected = archSort(declaration) === 'node' ? roleName(declaredWord) ?? declaredWord : declaredWord;
    if (expected.toLowerCase() !== word.toLowerCase()) {
      errors.push(new CompileError(
        CompileErrorCode.BINDING_ERROR,
        `${handleOf(declaration)} is a ${expected}, not a ${word}`,
        specifier.importKind!,
      ));
    }
  }
  return new Report(undefined, errors);
}

export const archModule: GlobalModule = {
  nodeSymbol (compiler: Compiler, node: SyntaxNode): Report<NodeSymbol> | Report<PassThrough> {
    if (!isTopLevel(node)) return Report.create(PASS_THROUGH);
    switch (archSort(node)) {
      case 'node':
      case 'group':
        return new Report(compiler.symbolFactory.create(ElementSymbol, {
          declaration: node,
          name: handleOf(node),
        }, node.filepath));
      default:
        return Report.create(PASS_THROUGH);
    }
  },

  symbolMembers (compiler: Compiler, symbol: NodeSymbol): Report<NodeSymbol[]> | Report<PassThrough> {
    if (symbol instanceof ElementSymbol) return new Report([]);
    return Report.create(PASS_THROUGH);
  },

  nodeReferee (compiler: Compiler, node: SyntaxNode): Report<NodeSymbol | undefined> | Report<PassThrough> {
    if (!isExpressionAVariableNode(node) || node.parentOfKind(UseSpecifierNode)) return Report.create(PASS_THROUGH);
    const declaration = topLevelDeclaration(node);
    if (!declaration) return Report.create(PASS_THROUGH);
    return nodeRefereeOfDeclaration(compiler, node, declaration);
  },

  // Claims top-level notes too: their only references are inline links, and DBML's note binder binds nothing for them
  bindNode (compiler: Compiler, node: SyntaxNode): Report<void> | Report<PassThrough> {
    if (node instanceof UseSpecifierNode && node.archImport) return bindUseSpecifier(compiler, node);
    if (!isTopLevel(node)) return Report.create(PASS_THROUGH);
    return bindDeclaration(compiler, node);
  },

  nodeMetadata (compiler: Compiler, node: SyntaxNode): Report<NodeMetadata> | Report<PassThrough> {
    // An inline `[link: > b]` on an element, the way DBML reads an inline `[ref: > b]` on a column
    if (node instanceof AttributeNode) {
      const element = node.parentOfKind(ElementDeclarationNode);
      if (!element || !isTopLevel(element) || !takesInlineLinks(element) || !isInlineLink(node)) return Report.create(PASS_THROUGH);
      return new Report(new LinkMetadata(node));
    }
    if (!isTopLevel(node)) return Report.create(PASS_THROUGH);
    switch (archSort(node)) {
      case 'link':
        return new Report(new LinkMetadata(node));
      case 'metadata':
        return new Report(new ArchMetadataElementMetadata(node));
      default:
        return Report.create(PASS_THROUGH);
    }
  },

  interpretSymbol (compiler: Compiler, symbol: NodeSymbol, filepath: Filepath): Report<SchemaElement | SchemaElement[] | undefined> | Report<PassThrough> {
    if (symbol instanceof ElementSymbol) return interpretElement(compiler, symbol, filepath);
    return Report.create(PASS_THROUGH);
  },

  interpretMetadata (compiler: Compiler, metadata: NodeMetadata, filepath: Filepath): Report<SchemaElement | SchemaElement[] | undefined> | Report<PassThrough> {
    if (metadata instanceof LinkMetadata) return interpretLink(compiler, metadata, filepath);
    if (metadata instanceof ArchMetadataElementMetadata) return interpretArchMetadata(metadata);
    return Report.create(PASS_THROUGH);
  },
};
