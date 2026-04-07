import { isElementNode, isElementFieldNode, getBody } from '@/core/utils/expression';
import { ElementKind } from '@/core/types/keywords';
import { ElementDeclarationNode } from '@/core/parser/nodes';
import type { SyntaxNode } from '@/core/parser/nodes';
import type { SyntaxToken } from '@/core/lexer/tokens';
import { NodeSymbol, SymbolKind } from '@/core/types/symbols';
import type { GlobalModule } from '../types';
import { PASS_THROUGH, UNHANDLED, type PassThrough } from '@/constants';
import Report from '@/core/report';
import type Compiler from '@/compiler/index';
import type { SchemaElement } from '@/core/types/schemaJson';
import { CompileError } from '@/core/errors';
import { getNodeMemberSymbols } from '../utils';
import ProjectBinder from './bind';
import { ProjectInterpreter } from './interpret';

export const projectModule: GlobalModule = {
  nodeSymbol (compiler: Compiler, node: SyntaxNode): Report<NodeSymbol> | Report<PassThrough> {
    if (isElementNode(node, ElementKind.Project)) {
      return new Report(compiler.symbolFactory.create(NodeSymbol, {
        kind: SymbolKind.Project,
        declaration: node,
      }, node.filepath));
    }
    if (isElementFieldNode(node, ElementKind.Project)) {
      return new Report(compiler.symbolFactory.create(NodeSymbol, { kind: SymbolKind.ProjectField, declaration: node }, node.filepath));
    }
    return Report.create(PASS_THROUGH);
  },

  symbolMembers (compiler: Compiler, symbol: NodeSymbol): Report<NodeSymbol[]> | Report<PassThrough> {
    if (symbol.isKind(SymbolKind.Project)) {
      const node = symbol.declaration;
      if (!(node instanceof ElementDeclarationNode)) return new Report([]);
      const children = getBody(node);

      const members: NodeSymbol[] = [];
      const errors: CompileError[] = [];
      for (const child of children) {
        const res = compiler.nodeSymbol(child);
        if (res.hasValue(UNHANDLED)) continue;
        members.push(res.getValue());
        errors.push(...res.getErrors());
      }

      return new Report(members, errors);
    }
    if (symbol.isKind(SymbolKind.ProjectField)) {
      return new Report([]);
    }
    return Report.create(PASS_THROUGH);
  },

  nestedSymbols (compiler: Compiler, node: SyntaxNode): Report<NodeSymbol[]> | Report<PassThrough> {
    if (isElementNode(node, ElementKind.Project)) {
      return getNodeMemberSymbols(compiler, node);
    }
    return Report.create(PASS_THROUGH);
  },

  nodeReferee (compiler: Compiler, node: SyntaxNode): Report<NodeSymbol | undefined> | Report<PassThrough> {
    return Report.create(PASS_THROUGH);
  },

  bind (compiler: Compiler, node: SyntaxNode): Report<void> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.Project)) return Report.create(PASS_THROUGH);
    return Report.create(
      undefined,
      new ProjectBinder(compiler, node as ElementDeclarationNode & { type: SyntaxToken }).bind(),
    );
  },

  interpret (compiler: Compiler, node: SyntaxNode): Report<SchemaElement | SchemaElement[] | undefined> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.Project)) return Report.create(PASS_THROUGH);
    if (compiler.bind(node).getErrors().length + compiler.validate(node).getErrors().length > 0) return Report.create(undefined);
    return new ProjectInterpreter(compiler, node).interpret();
  },
};
