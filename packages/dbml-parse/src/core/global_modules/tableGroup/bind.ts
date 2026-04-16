import {
  partition,
} from 'lodash-es';
import Compiler from '@/compiler';
import {
  CompileError, CompileErrorCode,
} from '@/core/types/errors';
import {
  UNHANDLED,
} from '@/core/types/module';
import {
  BlockExpressionNode, ElementDeclarationNode, FunctionApplicationNode, ProgramNode,
} from '@/core/types/nodes';
import {
  SyntaxToken,
} from '@/core/types/tokens';
import {
  UseSymbol,
} from '@/core/types/symbol';
import {
  scanNonListNodeForBinding,
} from '../utils';

export default class TableGroupBinder {
  private compiler: Compiler;
  private declarationNode: ElementDeclarationNode & { type: SyntaxToken };

  constructor (compiler: Compiler, declarationNode: ElementDeclarationNode & { type: SyntaxToken }) {
    this.declarationNode = declarationNode;
    this.compiler = compiler;
  }

  bind (): CompileError[] {
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

      const args = [
        field.callee,
        ...field.args,
      ];
      const bindees = args.flatMap(scanNonListNodeForBinding);

      return bindees.flatMap((bindee) => {
        const tableBindee = bindee.variables.pop();
        if (!tableBindee) {
          return [];
        }
        const result = this.compiler.nodeReferee(tableBindee);
        const sym = result.getFiltered(UNHANDLED);
        if (sym instanceof UseSymbol) {
          return [
            ...result.getErrors(),
            new CompileError(
              CompileErrorCode.BINDING_ERROR,
              `TableGroup cannot reference imported table '${this.compiler.symbolName(sym)}'`,
              tableBindee,
            ),
          ];
        }
        return result.getErrors();
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
