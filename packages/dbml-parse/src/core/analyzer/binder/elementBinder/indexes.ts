import { partition } from 'lodash-es';
import {
  BlockExpressionNode,
  ElementDeclarationNode,
  FunctionApplicationNode,
  ProgramNode,
} from '@/core/parser/nodes';
import { ElementBinder } from '../types';
import { SyntaxToken } from '@/core/lexer/tokens';
import { CompileError, CompileErrorCode } from '@/core/errors';
import { addSymbolReference, pickBinder, scanNonListNodeForBinding } from '../utils';
import { destructureComplexVariable, extractVarNameFromPrimaryVariable, getElementKind } from '@/core/analyzer/utils';
import { ElementKind } from '@/core/analyzer/types';
import { BinderContext } from '@/core/analyzer/analyzer';
import { createColumnSymbolIndex } from '@/core/analyzer/symbol/symbolIndex';
import SymbolFactory from '@/core/analyzer/symbol/factory';

export default class IndexesBinder implements ElementBinder {
  private symbolFactory: SymbolFactory;
  private declarationNode: ElementDeclarationNode & { type: SyntaxToken };
  private context: BinderContext;

  constructor (
    declarationNode: ElementDeclarationNode & { type: SyntaxToken },
    context: BinderContext,
    symbolFactory: SymbolFactory,
  ) {
    this.declarationNode = declarationNode;
    this.symbolFactory = symbolFactory;
    this.context = context;
  }

  bind (): CompileError[] {
    if (!(this.declarationNode.parent instanceof ElementDeclarationNode) || getElementKind(this.declarationNode.parent).unwrap_or(undefined) !== ElementKind.Table) {
      return [];
    }

    if (!(this.declarationNode.body instanceof BlockExpressionNode)) {
      return [];
    }

    return this.bindBody(this.declarationNode.body);
  }

  private bindBody (body?: FunctionApplicationNode | BlockExpressionNode): CompileError[] {
    if (!body) {
      return [];
    }
    if (body instanceof FunctionApplicationNode) {
      return this.bindFields([body]);
    }

    const [fields, subs] = partition(body.body, (e) => e instanceof FunctionApplicationNode);

    return [...this.bindFields(fields as FunctionApplicationNode[]), ...this.bindSubElements(subs as ElementDeclarationNode[])];
  }

  private bindFields (fields: FunctionApplicationNode[]): CompileError[] {
    return fields.flatMap((field) => {
      if (!field.callee) {
        return [];
      }
      const ownerTableName = destructureComplexVariable(
        (this.declarationNode.parent! as ElementDeclarationNode).name,
      ).map(
        (fragments) => fragments.join('.'),
      ).unwrap_or('<unnamed>');
      const ownerTableSymbol = this.context.nodeToSymbol.get(this.declarationNode.parent!);
      const ownerTableSymbolTable = ownerTableSymbol!.symbolTable!;

      const args = [field.callee, ...field.args];
      const bindees = args.flatMap(scanNonListNodeForBinding)
        .flatMap((bindee) => {
          if (bindee.variables.length + bindee.tupleElements.length > 1) {
            return [];
          }
          if (bindee.variables.length) {
            return bindee.variables[0];
          }

          return bindee.tupleElements;
        });

      return bindees.flatMap((bindee) => {
        const columnName = extractVarNameFromPrimaryVariable(bindee).unwrap_or(undefined);
        if (columnName === undefined) return [];
        const columnIndex = createColumnSymbolIndex(columnName);
        const column = ownerTableSymbolTable.get(columnIndex);
        if (!column) {
          return new CompileError(CompileErrorCode.BINDING_ERROR, `No column named '${columnName}' inside Table '${ownerTableName}'`, bindee);
        }
        this.context.nodeToReferee.set(bindee, column);
        addSymbolReference(this.context.symbolToReferences, column, bindee);

        return [];
      });
    });
  }

  private bindSubElements (subs: ElementDeclarationNode[]): CompileError[] {
    return subs.flatMap((sub) => {
      if (!sub.type) {
        return [];
      }
      const _Binder = pickBinder(sub as ElementDeclarationNode & { type: SyntaxToken });
      const binder = new _Binder(
        sub as ElementDeclarationNode & { type: SyntaxToken },
        this.context,
        this.symbolFactory,
      );

      return binder.bind();
    });
  }
}
