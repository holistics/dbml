import { partition } from 'lodash-es';
import {
  BlockExpressionNode, ElementDeclarationNode, FunctionApplicationNode, ProgramNode,
} from '@/core/types/nodes';
import { isWildcardExpression } from '../../../parser/utils';
import { ElementBinder } from '../types';
import { SyntaxToken } from '@/core/types/tokens';
import { CompileError } from '@/core/types/errors';
import { lookupAndBindInScope, pickBinder, scanNonListNodeForBinding } from '../utils';
import { SymbolKind } from '@/core/types/symbol/symbolIndex';
import SymbolFactory from '@/core/types/symbol/factory';

export default class DiagramViewBinder implements ElementBinder {
  private symbolFactory: SymbolFactory;
  private declarationNode: ElementDeclarationNode & { type: SyntaxToken };
  private ast: ProgramNode;

  constructor (declarationNode: ElementDeclarationNode & { type: SyntaxToken }, ast: ProgramNode, symbolFactory: SymbolFactory) {
    this.declarationNode = declarationNode;
    this.ast = ast;
    this.symbolFactory = symbolFactory;
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

      const blockType = sub.type.value.toLowerCase();

      // Only bind sub-blocks with body
      if (!(sub.body instanceof BlockExpressionNode)) {
        return [];
      }

      // Bind fields based on block type
      const errors: CompileError[] = [];

      switch (blockType) {
        case 'tables':
          errors.push(...this.bindTableReferences(sub.body));
          break;
        case 'notes':
          errors.push(...this.bindNoteReferences(sub.body));
          break;
        case 'tablegroups':
          errors.push(...this.bindTableGroupReferences(sub.body));
          break;
        case 'schemas':
          errors.push(...this.bindSchemaReferences(sub.body));
          break;
        default:
          // Unknown block type - will be caught by validator
          break;
      }

      return errors;
    });
  }

  private bindTableReferences (body: BlockExpressionNode): CompileError[] {
    const [fields] = partition(body.body, (e) => e instanceof FunctionApplicationNode);

    return (fields as FunctionApplicationNode[]).flatMap((field) => {
      if (!field.callee) {
        return [];
      }

      // Skip wildcard
      if (isWildcardExpression(field.callee)) {
        return [];
      }

      const args = [field.callee, ...field.args];
      const bindees = args.flatMap(scanNonListNodeForBinding);

      return bindees.flatMap((bindee) => {
        const tableBindee = bindee.variables.pop();
        if (!tableBindee) {
          return [];
        }
        const schemaBindees = bindee.variables;

        return lookupAndBindInScope(this.ast, [
          ...schemaBindees.map((b) => ({ node: b, kind: SymbolKind.Schema })),
          { node: tableBindee, kind: SymbolKind.Table },
        ]);
      });
    });
  }

  private bindNoteReferences (body: BlockExpressionNode): CompileError[] {
    const [fields] = partition(body.body, (e) => e instanceof FunctionApplicationNode);

    return (fields as FunctionApplicationNode[]).flatMap((field) => {
      if (!field.callee) {
        return [];
      }

      // Skip wildcard
      if (isWildcardExpression(field.callee)) {
        return [];
      }

      const bindees = scanNonListNodeForBinding(field.callee);

      return bindees.flatMap((bindee) => {
        const noteBindee = bindee.variables.pop();
        if (!noteBindee) {
          return [];
        }

        return lookupAndBindInScope(this.ast, [
          { node: noteBindee, kind: SymbolKind.Note },
        ]);
      });
    });
  }

  private bindTableGroupReferences (body: BlockExpressionNode): CompileError[] {
    const [fields] = partition(body.body, (e) => e instanceof FunctionApplicationNode);

    return (fields as FunctionApplicationNode[]).flatMap((field) => {
      if (!field.callee) {
        return [];
      }

      // Skip wildcard
      if (isWildcardExpression(field.callee)) {
        return [];
      }

      const bindees = scanNonListNodeForBinding(field.callee);

      return bindees.flatMap((bindee) => {
        const tableGroupBindee = bindee.variables.pop();
        if (!tableGroupBindee) {
          return [];
        }
        const schemaBindees = bindee.variables;

        return lookupAndBindInScope(this.ast, [
          ...schemaBindees.map((b) => ({ node: b, kind: SymbolKind.Schema })),
          { node: tableGroupBindee, kind: SymbolKind.TableGroup },
        ]);
      });
    });
  }

  private bindSchemaReferences (body: BlockExpressionNode): CompileError[] {
    const [fields] = partition(body.body, (e) => e instanceof FunctionApplicationNode);

    return (fields as FunctionApplicationNode[]).flatMap((field) => {
      if (!field.callee) {
        return [];
      }

      // Skip wildcard
      if (isWildcardExpression(field.callee)) {
        return [];
      }

      const bindees = scanNonListNodeForBinding(field.callee);

      return bindees.flatMap((bindee) => {
        return lookupAndBindInScope(this.ast, bindee.variables.map((b) => ({ node: b, kind: SymbolKind.Schema })));
      });
    });
  }
}
