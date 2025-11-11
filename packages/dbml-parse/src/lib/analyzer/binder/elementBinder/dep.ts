import { ElementDeclarationNode, ProgramNode, SyntaxToken } from '../../../..';
import { CompileError } from '../../../errors';
import { BlockExpressionNode, ExpressionNode, FunctionApplicationNode } from '../../../parser/nodes';
import SymbolFactory from '../../symbol/factory';
import { SymbolKind } from '../../symbol/symbolIndex';
import { extractVariableFromExpression, isValidDependency } from '../../utils';
import { ElementBinder } from '../types';
import { lookupAndBindInScope, scanNonListNodeForBinding } from '../utils';

export default class DepBinder implements ElementBinder {
  private symbolFactory: SymbolFactory;
  private declarationNode: ElementDeclarationNode & { type: SyntaxToken; };
  private ast: ProgramNode;

  constructor (declarationNode: ElementDeclarationNode & { type: SyntaxToken }, ast: ProgramNode, symbolFactory: SymbolFactory) {
    this.declarationNode = declarationNode;
    this.ast = ast;
    this.symbolFactory = symbolFactory;
  }

  bind (): CompileError[] {
    if (!(this.declarationNode.body instanceof FunctionApplicationNode)) return [];
    return this.bindBody(this.declarationNode.body as FunctionApplicationNode);
  }

  private bindBody (body?: FunctionApplicationNode): CompileError[] {
    const tableDep = body?.callee;
    let fieldDeps: FunctionApplicationNode[] = [];
    if (body?.args[0] instanceof BlockExpressionNode) {
      fieldDeps = body?.args[0].body.filter((d) => d instanceof FunctionApplicationNode) as FunctionApplicationNode[];
    } else if (body?.args[1] instanceof BlockExpressionNode) {
      fieldDeps = body?.args[1].body.filter((d) => d instanceof FunctionApplicationNode) as FunctionApplicationNode[];
    }
    return [
      ...this.bindTableDep(tableDep),
      ...fieldDeps.flatMap((fieldDep) => this.bindFieldDep(fieldDep)),
    ];
  }

  private bindTableDep (tableDep?: ExpressionNode): CompileError[] {
    if (!tableDep) return [];
    if (!isValidDependency(tableDep)) return [];
    const bindees = scanNonListNodeForBinding(tableDep);

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
  }

  private bindFieldDep (_fieldDep: FunctionApplicationNode): CompileError[] {
    const fieldDep = _fieldDep.callee;
    if (!isValidDependency(fieldDep)) return [];
    const bindees = scanNonListNodeForBinding(fieldDep);

    return bindees.flatMap((bindee) => {
      const columnBindee = bindee.variables.pop();
      const tableBindee = bindee.variables.pop();
      if (!columnBindee || !tableBindee) {
        return [];
      }

      const schemaBindees = bindee.variables;

      return lookupAndBindInScope(this.ast, [
        ...schemaBindees.map((b) => ({ node: b, kind: SymbolKind.Schema })),
        { node: tableBindee, kind: SymbolKind.Table },
        { node: columnBindee, kind: SymbolKind.Column },
      ]);
    });
  }
}
