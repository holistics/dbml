import {
  partition,
} from 'lodash-es';
import Compiler from '@/compiler';
import {
  CompileError,
} from '@/core/types/errors';
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
  ElementKind,
} from '../../types';
import {
  scanNonListNodeForBinding,
} from '../utils';

export default class RefBinder {
  private compiler: Compiler;
  private declarationNode: ElementDeclarationNode & { type: SyntaxToken };

  constructor (compiler: Compiler, declarationNode: ElementDeclarationNode & { type: SyntaxToken }) {
    this.compiler = compiler;
    this.declarationNode = declarationNode;
  }

  bind (): CompileError[] {
    if (!(this.declarationNode.parent instanceof ProgramNode) && !this.declarationNode.parent?.isKind(ElementKind.Project)) {
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
        let columnBindees = bindee.tupleElements.length ? bindee.tupleElements : bindee.variables.pop();
        const tableBindee = bindee.variables.pop();
        if (!columnBindees || !tableBindee) {
          return [];
        }
        if (!Array.isArray(columnBindees)) {
          columnBindees = [
            columnBindees,
          ];
        }

        const schemaBindees = bindee.variables;

        return [
          ...schemaBindees,
          tableBindee,
          ...columnBindees,
        ].flatMap((b) => this.compiler.nodeReferee(b).getErrors());
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
