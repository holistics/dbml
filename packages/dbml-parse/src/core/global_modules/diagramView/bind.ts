import { partition } from 'lodash-es';
import {
  BlockExpressionNode, ElementDeclarationNode, FunctionApplicationNode,
} from '@/core/types/nodes';
import { isWildcardExpression } from '@/core/utils/expression';
import { scanNonListNodeForBinding } from '../utils';
import { SyntaxToken } from '@/core/types/tokens';
import { CompileError } from '@/core/types/errors';
import Compiler from '@/compiler';

export default class DiagramViewBinder {
  private compiler: Compiler;
  private declarationNode: ElementDeclarationNode & { type: SyntaxToken };

  constructor (compiler: Compiler, declarationNode: ElementDeclarationNode & { type: SyntaxToken }) {
    this.compiler = compiler;
    this.declarationNode = declarationNode;
  }

  bind (): CompileError[] {
    if (!(this.declarationNode.body instanceof BlockExpressionNode)) {
      return [];
    }

    return this.bindBody(this.declarationNode.body);
  }

  private bindBody (body: BlockExpressionNode): CompileError[] {
    const [, subs] = partition(body.body, (e) => e instanceof FunctionApplicationNode);

    return this.bindSubElements(subs as ElementDeclarationNode[]);
  }

  private bindSubElements (subs: ElementDeclarationNode[]): CompileError[] {
    return subs.flatMap((sub) => {
      if (!sub.type) {
        return [];
      }

      if (!(sub.body instanceof BlockExpressionNode)) {
        return [];
      }

      switch (sub.type.value.toLowerCase()) {
        case 'tables':
          return this.bindTableReferences(sub.body);
        case 'notes':
          return this.bindNoteReferences(sub.body);
        case 'tablegroups':
          return this.bindTableGroupReferences(sub.body);
        case 'schemas':
          return this.bindSchemaReferences(sub.body);
        default:
          return [];
      }
    });
  }

  private bindTableReferences (body: BlockExpressionNode): CompileError[] {
    const [fields] = partition(body.body, (e) => e instanceof FunctionApplicationNode);

    return (fields as FunctionApplicationNode[]).flatMap((field) => {
      if (!field.callee || isWildcardExpression(field.callee)) {
        return [];
      }

      const args = [field.callee, ...field.args];
      const bindees = args.flatMap(scanNonListNodeForBinding);

      return bindees.flatMap((bindee) => {
        const tableBindee = bindee.variables.pop();
        if (!tableBindee) {
          return [];
        }

        return this.compiler.nodeReferee(tableBindee).getErrors();
      });
    });
  }

  private bindNoteReferences (body: BlockExpressionNode): CompileError[] {
    const [fields] = partition(body.body, (e) => e instanceof FunctionApplicationNode);

    return (fields as FunctionApplicationNode[]).flatMap((field) => {
      if (!field.callee || isWildcardExpression(field.callee)) {
        return [];
      }

      const bindees = scanNonListNodeForBinding(field.callee);

      return bindees.flatMap((bindee) => {
        const noteBindee = bindee.variables.pop();
        if (!noteBindee) {
          return [];
        }

        return this.compiler.nodeReferee(noteBindee).getErrors();
      });
    });
  }

  private bindTableGroupReferences (body: BlockExpressionNode): CompileError[] {
    const [fields] = partition(body.body, (e) => e instanceof FunctionApplicationNode);

    return (fields as FunctionApplicationNode[]).flatMap((field) => {
      if (!field.callee || isWildcardExpression(field.callee)) {
        return [];
      }

      const bindees = scanNonListNodeForBinding(field.callee);

      return bindees.flatMap((bindee) => {
        const tableGroupBindee = bindee.variables.pop();
        if (!tableGroupBindee) {
          return [];
        }

        return this.compiler.nodeReferee(tableGroupBindee).getErrors();
      });
    });
  }

  private bindSchemaReferences (body: BlockExpressionNode): CompileError[] {
    const [fields] = partition(body.body, (e) => e instanceof FunctionApplicationNode);

    return (fields as FunctionApplicationNode[]).flatMap((field) => {
      if (!field.callee || isWildcardExpression(field.callee)) {
        return [];
      }

      const bindees = scanNonListNodeForBinding(field.callee);

      return bindees.flatMap((bindee) =>
        bindee.variables.flatMap((b) => this.compiler.nodeReferee(b).getErrors()),
      );
    });
  }
}
