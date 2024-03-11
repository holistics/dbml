import _ from 'lodash';
import {
  BlockExpressionNode,
  ElementDeclarationNode,
  FunctionApplicationNode,
  ProgramNode,
} from '../../../parser/nodes';
import { ElementBinder } from '../types';
import { SyntaxToken } from '../../../lexer/tokens';
import { CompileError, CompileErrorCode } from '../../../errors';
import { pickBinder, scanNonListNodeForBinding } from '../utils';
import { destructureComplexVariable, extractVarNameFromPrimaryVariable, getElementKind } from '../../../analyzer/utils';
import { ElementKind } from '../../../analyzer/types';
import { createColumnSymbolIndex } from '../../../analyzer/symbol/symbolIndex';

export default class IndexesBinder implements ElementBinder {
  private declarationNode: ElementDeclarationNode & { type: SyntaxToken; };
  private ast: ProgramNode;

 constructor(declarationNode: ElementDeclarationNode & { type: SyntaxToken }, ast: ProgramNode) {
    this.declarationNode = declarationNode;
    this.ast = ast;
  }

  bind(): CompileError[] {
    if (!(this.declarationNode.parent instanceof ElementDeclarationNode) || getElementKind(this.declarationNode.parent).unwrap() !== ElementKind.Table) {
      return [];
    }

    if (!(this.declarationNode.body instanceof BlockExpressionNode)) {
      return [];
    }

    return this.bindBody(this.declarationNode.body);
  }

  private bindBody(body?: FunctionApplicationNode | BlockExpressionNode): CompileError[] {
    if (!body) {
      return [];
    }
    if (body instanceof FunctionApplicationNode) {
      return this.bindFields([body]);
    }

    const [fields, subs] = _.partition(body.body, (e) => e instanceof FunctionApplicationNode);

    return [...this.bindFields(fields as FunctionApplicationNode[]), ...this.bindSubElements(subs as ElementDeclarationNode[])];
  }

  private bindFields(fields: FunctionApplicationNode[]): CompileError[] {
    return fields.flatMap((field) => {
      if (!field.callee) {
        return [];
      }
      const ownerTableName = destructureComplexVariable((this.declarationNode.parent! as ElementDeclarationNode).name).map((fragments) => fragments.join('.')).unwrap_or('<unnamed>');
      const ownerTableSymbolTable = this.declarationNode.parent!.symbol!.symbolTable!;

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
        const columnName = extractVarNameFromPrimaryVariable(bindee).unwrap();
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

  private bindSubElements(subs: ElementDeclarationNode[]): CompileError[] {
    return subs.flatMap((sub) => {
      if (!sub.type) {
        return [];
      }
      const _Binder = pickBinder(sub as ElementDeclarationNode & { type: SyntaxToken });
      const binder = new _Binder(sub as ElementDeclarationNode & { type: SyntaxToken }, this.ast);

      return binder.bind();
    });
  }
}
