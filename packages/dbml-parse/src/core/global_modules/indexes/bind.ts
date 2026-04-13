import {
  partition,
} from 'lodash-es';
import {
  BlockExpressionNode,
  ElementDeclarationNode,
  FunctionApplicationNode,
  ProgramNode,
} from '@/core/types/nodes';
import {
  SyntaxToken,
} from '@/core/types/tokens';
import {
  CompileError, CompileErrorCode,
} from '@/core/types/errors';
import {
  scanNonListNodeForBinding,
} from '../utils';
import {
  destructureComplexVariable, extractVarNameFromPrimaryVariable,
} from '../../utils/expression';
import {
  ElementKind,
} from '../../types';
import Compiler from '@/compiler';
import {
  UNHANDLED,
} from '@/core/types/module';

export default class IndexesBinder {
  private compiler: Compiler;
  private declarationNode: ElementDeclarationNode & { type: SyntaxToken };

  constructor (compiler: Compiler, declarationNode: ElementDeclarationNode & { type: SyntaxToken }) {
    this.declarationNode = declarationNode;
    this.compiler = compiler;
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
      )
        ?.join('.')
        || '<unnamed>';

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
        const columnName = extractVarNameFromPrimaryVariable(bindee);
        if (columnName === undefined) return [];
        const column = this.compiler.nodeReferee(bindee);
        if (!column.getValue() || column.hasValue(UNHANDLED)) {
          return new CompileError(CompileErrorCode.BINDING_ERROR, `No column named '${columnName}' inside Table '${ownerTableName}'`, bindee);
        }

        return [];
      });
    });
  }

  private bindSubElements (subs: ElementDeclarationNode[]): CompileError[] {
    return subs.flatMap((sub) => {
      if (!sub.type) {
        return [];
      }

      return this.compiler.bindNode(sub).getErrors();
    });
  }
}
