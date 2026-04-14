import {
  partition,
} from 'lodash-es';
import {
  CompileError, CompileErrorCode,
} from '@/core/types/errors';
import SymbolFactory from '@/core/types/symbol/factory';
import {
  createColumnSymbolIndex,
} from '@/core/types/symbol/symbolIndex';
import {
  BlockExpressionNode,
  ElementDeclarationNode,
  FunctionApplicationNode,
  ProgramNode,
} from '../../../types/nodes';
import {
  SyntaxToken,
} from '../../../types/tokens';
import {
  ElementKind,
} from '../../types';
import {
  destructureComplexVariable, extractVarNameFromPrimaryVariable,
} from '../../utils';
import {
  ElementBinder,
} from '../types';
import {
  pickBinder, scanNonListNodeForBinding,
} from '../utils';

export default class IndexesBinder implements ElementBinder {
  private symbolFactory: SymbolFactory;
  private declarationNode: ElementDeclarationNode & { type: SyntaxToken };
  private ast: ProgramNode;

  constructor (declarationNode: ElementDeclarationNode & { type: SyntaxToken }, ast: ProgramNode, symbolFactory: SymbolFactory) {
    this.declarationNode = declarationNode;
    this.ast = ast;
    this.symbolFactory = symbolFactory;
  }

  bind (): CompileError[] {
    if (!(this.declarationNode.parent instanceof ElementDeclarationNode) || !this.declarationNode.parent.isKind(ElementKind.Table)) {
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
      return this.bindFields([
        body,
      ]);
    }

    const [
      fields,
      subs,
    ] = partition(body.body, (e) => e instanceof FunctionApplicationNode);

    return [
      ...this.bindFields(fields as FunctionApplicationNode[]),
      ...this.bindSubElements(subs as ElementDeclarationNode[]),
    ];
  }

  private bindFields (fields: FunctionApplicationNode[]): CompileError[] {
    return fields.flatMap((field) => {
      if (!field.callee) {
        return [];
      }
      const ownerTableName = (() => {
        const frags = destructureComplexVariable((this.declarationNode.parent! as ElementDeclarationNode).name);
        return frags !== undefined ? frags.join('.') : '<unnamed>';
      })();
      const ownerTableSymbolTable = this.declarationNode.parent!.symbol!.symbolTable!;

      const args = [
        field.callee,
        ...field.args,
      ];
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
        const columnName = extractVarNameFromPrimaryVariable(bindee);
        if (columnName === undefined) return [];
        const columnIndex = createColumnSymbolIndex(columnName);
        const column = ownerTableSymbolTable.get(columnIndex);
        if (!column) {
          return new CompileError(CompileErrorCode.BINDING_ERROR, `No column named '${columnName}' inside Table '${ownerTableName}'`, bindee);
        }
        bindee.referee = column;
        column.references.push(bindee);

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
      const binder = new _Binder(sub as ElementDeclarationNode & { type: SyntaxToken }, this.ast, this.symbolFactory);

      return binder.bind();
    });
  }
}
