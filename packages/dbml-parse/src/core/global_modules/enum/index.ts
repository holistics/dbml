import { isElementNode, isElementFieldNode, getBody } from '@/core/utils/expression';
import { ElementKind } from '@/core/types/keywords';
import { ElementDeclarationNode } from '@/core/types/nodes';
import type { SyntaxNode } from '@/core/types/nodes';
import type { SyntaxToken } from '@/core/types/tokens';
import { NodeSymbol, SymbolKind } from '@/core/types/symbol';
import type { GlobalModule } from '../types';
import { PASS_THROUGH, UNHANDLED, type PassThrough } from '@/constants';
import Report from '@/core/types/report';
import type Compiler from '@/compiler/index';
import type { SchemaElement } from '@/core/types/schemaJson';
import { getNodeMemberSymbols, shouldInterpretNode } from '../utils';
import { CompileError, CompileErrorCode } from '@/core/types/errors';
import EnumBinder from './bind';
import EnumInterpreter from './interpret';

// Public utils that other modules can use
export const enumUtils = {
  getDuplicateError (name: string, schemaLabel: string, errorNode: SyntaxNode): CompileError {
    return new CompileError(CompileErrorCode.DUPLICATE_NAME, `Enum name ${name} already exists in schema '${schemaLabel}'`, errorNode);
  },
  getFieldDuplicateError (name: string, errorNode: SyntaxNode): CompileError {
    return new CompileError(CompileErrorCode.DUPLICATE_COLUMN_NAME, `Duplicate enum field ${name}`, errorNode);
  },
};

export const enumModule: GlobalModule = {
  nodeSymbol (compiler: Compiler, node: SyntaxNode): Report<NodeSymbol> | Report<PassThrough> {
    if (isElementNode(node, ElementKind.Enum)) {
      return new Report(compiler.symbolFactory.create(NodeSymbol, {
        kind: SymbolKind.Enum,
        declaration: node,
      }, node.filepath));
    }
    if (isElementFieldNode(node, ElementKind.Enum)) {
      return new Report(compiler.symbolFactory.create(NodeSymbol, {
        kind: SymbolKind.EnumField,
        declaration: node,
      }, node.filepath));
    }
    return Report.create(PASS_THROUGH);
  },

  symbolMembers (compiler: Compiler, symbol: NodeSymbol): Report<NodeSymbol[]> | Report<PassThrough> {
    if (!symbol.isKind(SymbolKind.Enum)) {
      return Report.create(PASS_THROUGH);
    }

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
  },

  bindNode (compiler: Compiler, node: SyntaxNode): Report<void> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.Enum)) return Report.create(PASS_THROUGH);

    return Report.create(
      undefined,
      new EnumBinder(compiler, node as ElementDeclarationNode & { type: SyntaxToken }).bind(),
    );
  },

  interpretNode (compiler: Compiler, node: SyntaxNode): Report<SchemaElement | SchemaElement[] | undefined> | Report<PassThrough> {
    if (!isElementNode(node, ElementKind.Enum)) return Report.create(PASS_THROUGH);

    if (!shouldInterpretNode(compiler, node)) return Report.create(undefined);

    return new EnumInterpreter(compiler, node).interpret();
  },
};
