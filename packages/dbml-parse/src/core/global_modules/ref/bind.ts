import { partition } from 'lodash-es';
import Compiler from '@/compiler';
import { CompileError } from '@/core/types/errors';
import {
  BlockExpressionNode,
  ElementDeclarationNode,
  FunctionApplicationNode,
  ProgramNode,
} from '@/core/types/nodes';
import { SyntaxToken } from '@/core/types/tokens';
import { ElementKind } from '@/core/types/keywords';
import { UNHANDLED } from '@/core/types/module';
import { isElementNode } from '@/core/utils/validate';
import { scanNonListNodeForBinding } from '../utils';
import { refUtils } from './index';

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

    return [
      ...this.checkDuplicateName(),
      ...this.bindBody(this.declarationNode.body),
    ];
  }

  // A Ref has no symbol, so its name is not a schema member: a named top-level Ref must be unique within its file
  private checkDuplicateName (): CompileError[] {
    const program = this.declarationNode.parent;
    if (!(program instanceof ProgramNode)) return [];

    const name = this.compiler.nodeFullname(this.declarationNode).getFiltered(UNHANDLED)?.at(-1);
    if (name === undefined) return [];

    for (const sibling of program.body) {
      if (sibling === this.declarationNode) break;
      if (!isElementNode(sibling, ElementKind.Ref)) continue;
      if (this.compiler.nodeFullname(sibling).getFiltered(UNHANDLED)?.at(-1) !== name) continue;

      return [
        refUtils.getDuplicateError(name, 'public', this.declarationNode.name ?? this.declarationNode),
      ];
    }
    return [];
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
