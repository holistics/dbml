import {
  last, partition,
} from 'lodash-es';
import Compiler from '@/compiler';
import {
  CompileError,
} from '@/core/types/errors';
import {
  BlockExpressionNode, ElementDeclarationNode, FunctionApplicationNode, ListExpressionNode, ProgramNode, SyntaxNode,
} from '@/core/types/nodes';
import {
  SyntaxToken,
} from '@/core/types/tokens';
import {
  destructureComplexVariableTuple,
} from '../../utils/expression';
import {
  aggregateSettingList,
} from '../../utils/validate';
import {
  scanNonListNodeForBinding,
} from '../utils';

export default class TablePartialBinder {
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

      const errors: CompileError[] = [];

      const args = [field.callee, ...field.args];
      if (last(args) instanceof ListExpressionNode) {
        const listExpression = last(args) as ListExpressionNode;
        const settingsMap = aggregateSettingList(listExpression).getValue();

        errors.push(...(settingsMap.ref?.flatMap((ref) => (ref.value ? this.bindInlineRef(ref.value) : [])) || []));
        args.pop();
      }

      if (!args[1]) {
        return errors;
      }
      this.tryToBindColumnType(args[1]);

      return errors;
    });
  }

  private tryToBindColumnType (typeNode: SyntaxNode): CompileError[] {
    const fragments = destructureComplexVariableTuple(typeNode);
    if (!fragments) {
      return [];
    }

    const enumBindee = fragments.variables.pop();
    const schemaBindees = fragments.variables;

    if (!enumBindee) {
      return [];
    }

    return this.compiler.nodeReferee(enumBindee).getErrors();
  }

  private bindInlineRef (ref: SyntaxNode): CompileError[] {
    const bindees = scanNonListNodeForBinding(ref);

    return bindees.flatMap((bindee) => {
      const columnBindee = bindee.variables.pop();
      const tableBindee = bindee.variables.pop();
      if (!columnBindee) {
        return [];
      }

      if (tableBindee) {
        const errors: CompileError[] = [];
        const schemaBindees = bindee.variables;
        for (const schemaBind of schemaBindees) {
          errors.push(...this.compiler.nodeReferee(schemaBind).getErrors());
        }
        const tableResult = this.compiler.nodeReferee(tableBindee);
        errors.push(...tableResult.getErrors());
        // Only resolve column if table resolved successfully
        if (tableResult.getValue()) {
          errors.push(...this.compiler.nodeReferee(columnBindee).getErrors());
        }
        return errors;
      }
      return this.compiler.nodeReferee(columnBindee).getErrors();
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
