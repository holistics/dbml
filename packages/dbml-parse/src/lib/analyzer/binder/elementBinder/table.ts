import { last, partition } from 'lodash';
import {
  BlockExpressionNode, ElementDeclarationNode, FunctionApplicationNode, ListExpressionNode, PartialInjectionNode, PrefixExpressionNode, ProgramNode, SyntaxNode,
} from '../../../parser/nodes';
import { ElementBinder } from '../types';
import { SyntaxToken } from '../../../lexer/tokens';
import { CompileError } from '../../../errors';
import { lookupAndBindInScope, pickBinder, scanNonListNodeForBinding } from '../utils';
import { aggregateSettingList, isValidPartialInjection } from '../../validator/utils';
import { SymbolKind, createColumnSymbolIndex } from '../../symbol/symbolIndex';
import { destructureComplexVariableTuple, extractVariableFromExpression } from '../../utils';
import { TablePartialInjectedColumnSymbol, TablePartialSymbol } from '../../symbol/symbols';
import SymbolFactory from '../../symbol/factory';

export default class TableBinder implements ElementBinder {
  private symbolFactory: SymbolFactory;
  private declarationNode: ElementDeclarationNode & { type: SyntaxToken; };
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

  // Must call this before any bind methods of any binder classes
  resolvePartialInjections (): CompileError[] {
    // Prioritize the later injections
    return (this.declarationNode.body as BlockExpressionNode).body.filter((i) => isValidPartialInjection(i)).reverse().flatMap((i: PrefixExpressionNode) => {
      const fragments = destructureComplexVariableTuple(i.expression).unwrap();
      const tablePartialBindee = fragments.variables.pop();
      const schemaBindees = fragments.variables;

      if (!tablePartialBindee) {
        return [];
      }

      const errors = lookupAndBindInScope(this.ast, [
        ...schemaBindees.map((b) => ({ node: b, kind: SymbolKind.Schema })),
        { node: tablePartialBindee, kind: SymbolKind.TablePartial },
      ]);
      if (errors.length) return errors;
      tablePartialBindee.referee?.symbolTable?.forEach((value) => {
        const columnName = extractVariableFromExpression((value.declaration as FunctionApplicationNode).callee).unwrap_or(undefined);
        if (columnName === undefined) return;
        const injectedColumnSymbol = this.symbolFactory.create(
          TablePartialInjectedColumnSymbol,
          { declaration: i, tablePartialSymbol: tablePartialBindee.referee as TablePartialSymbol },
        );
        const columnSymbolId = createColumnSymbolIndex(columnName);
        const symbolTable = this.declarationNode.symbol?.symbolTable;
        if (symbolTable?.has(columnSymbolId)) return;
        symbolTable?.set(columnSymbolId, injectedColumnSymbol);
      });
      return [];
    });
  }

  private bindBody (body?: FunctionApplicationNode | BlockExpressionNode): CompileError[] {
    if (!body) {
      return [];
    }
    if (body instanceof FunctionApplicationNode) {
      return this.bindFields([body]);
    }

    const [fields, subs] = partition(body.body, (e) => e instanceof FunctionApplicationNode);

    return [
      ...this.bindFields(fields as FunctionApplicationNode[]),
      ...this.bindSubElements(subs as ElementDeclarationNode[]),
    ];
  }

  private bindFields (fields: FunctionApplicationNode[]): CompileError[] {
    const columns = fields.filter((f) => !isValidPartialInjection(f));

    const bindColumns = (cs: FunctionApplicationNode[]): CompileError[] => {
      return cs.flatMap((c) => {
        if (!c.callee) {
          return [];
        }

        const errors: CompileError[] = [];

        const args = [c.callee, ...c.args];
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
    };
    return bindColumns(columns);
  }

  private tryToBindColumnType (typeNode: SyntaxNode) {
    const fragments = destructureComplexVariableTuple(typeNode).unwrap_or(undefined);
    if (!fragments) {
      return;
    }

    const enumBindee = fragments.variables.pop();
    const schemaBindees = fragments.variables;

    if (!enumBindee) {
      return;
    }

    lookupAndBindInScope(this.ast, [
      ...schemaBindees.map((b) => ({ node: b, kind: SymbolKind.Schema })),
      { node: enumBindee, kind: SymbolKind.Enum },
    ]);
  }

  private bindInlineRef (ref: SyntaxNode): CompileError[] {
    const bindees = scanNonListNodeForBinding(ref);

    return bindees.flatMap((bindee) => {
      const columnBindee = bindee.variables.pop();
      const tableBindee = bindee.variables.pop();
      if (!columnBindee) {
        return [];
      }
      const schemaBindees = bindee.variables;

      return tableBindee
        ? lookupAndBindInScope(this.ast, [
          ...schemaBindees.map((b) => ({ node: b, kind: SymbolKind.Schema })),
          { node: tableBindee, kind: SymbolKind.Table },
          { node: columnBindee, kind: SymbolKind.Column },
        ])
        : lookupAndBindInScope(this.declarationNode, [
          { node: columnBindee, kind: SymbolKind.Column },
        ]);
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
