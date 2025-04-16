import _ from 'lodash';
import { isTupleOfVariables } from '../../validator/utils';
import {
  BlockExpressionNode,
  ElementDeclarationNode,
  FunctionApplicationNode,
  InfixExpressionNode,
  ListExpressionNode,
  PartialInjectionNode,
  PostfixExpressionNode,
  PrefixExpressionNode,
  PrimaryExpressionNode,
  SyntaxNode,
  TupleExpressionNode,
  VariableNode,
} from '../../../parser/nodes';
import {
  extractStringFromIdentifierStream,
  isAccessExpression,
  isExpressionAVariableNode,
} from '../../../parser/utils';
import { ArgumentBinderRule, BinderRule, InjectionBinderRule, SettingListBinderRule } from '../types';
import {
  destructureMemberAccessExpression,
  extractVarNameFromPrimaryVariable,
  findSymbol,
} from '../../utils';
import { SyntaxToken } from '../../../lexer/tokens';
import { NodeSymbolIndex, createNodeSymbolIndex, destructureIndex, getInjectorIndex, isInjectionIndex } from '../../symbol/symbolIndex';
import { CompileError, CompileErrorCode } from '../../../errors';
import { pickBinder } from '../utils';
import SymbolFactory from '../../symbol/factory';
import { NodeSymbol, NodeSymbolId, TablePartialInjectedColumnSymbol } from '../../symbol/symbols';

export default abstract class ElementBinder {
  protected abstract subfield: {
    arg: ArgumentBinderRule;
    injection?: InjectionBinderRule;
    settingList: SettingListBinderRule;
  };
  protected abstract settingList: SettingListBinderRule;

  private errors: CompileError[];
  private declarationNode: ElementDeclarationNode;

  constructor(declarationNode: ElementDeclarationNode, errors: CompileError[]) {
    this.declarationNode = declarationNode;
    this.errors = errors;
  }

  bind() {
    this.bindSettingList(this.declarationNode.attributeList, this.settingList);
    this.bindBody();
  }

  private bindSettingList(
    settingList: ListExpressionNode | undefined,
    binderRule: SettingListBinderRule,
  ) {
    if (!settingList) {
      return;
    }

    // eslint-disable-next-line no-restricted-syntax
    for (const attribute of settingList.elementList) {
      if (attribute.name instanceof PrimaryExpressionNode) {
        continue;
      }

      const name = extractStringFromIdentifierStream(attribute.name).unwrap_or(undefined);
      if (!name) {
        continue;
      }
      const rule = binderRule[name.toLowerCase()];
      if (rule?.shouldBind) {
        this.scanAndBind(attribute.value, rule);
      }
    }
  }

  private bindBody() {
    const node = this.declarationNode;
    if (!node.body) {
      return;
    }
    const { body: nodeBody } = node;

    if (nodeBody instanceof BlockExpressionNode) {
      // eslint-disable-next-line no-restricted-syntax
      for (const sub of nodeBody.body) {
        if (sub instanceof ElementDeclarationNode) {
          if (!sub.type) {
            continue;
          }
          const Binder = pickBinder(sub as ElementDeclarationNode & { type: SyntaxToken });
          const binder = new Binder(sub, this.errors);
          binder.bind();
        } else if (sub instanceof FunctionApplicationNode) {
          // if (sub.callee instanceof PrefixExpressionNode) this.bindPartialInjection(sub.callee);
          this.bindSubfield(sub);
        } else {
          this.bindPartialInjection(sub);
        }
      }
    } else {
      this.bindSubfield(nodeBody);
    }
  }

  private bindSubfield(sub: FunctionApplicationNode) {
    const args = [sub.callee, ...sub.args];
    const maybeSettingList = _.last(args);
    if (maybeSettingList instanceof ListExpressionNode) {
      args.pop();
      this.bindSettingList(maybeSettingList, this.subfield.settingList);
    }
    const { argBinderRules } = this.subfield.arg;
    for (let i = 0; i < Math.min(args.length, argBinderRules.length); i += 1) {
      if (argBinderRules[i].shouldBind) {
        this.scanAndBind(args[i], argBinderRules[i] as BinderRule & { shouldBind: true });
      }
    }
  }

  private bindPartialInjection (node: PartialInjectionNode) {
    if (this.subfield.injection?.injectionBinderRule.shouldBind) this.scanAndBind(node, this.subfield.injection.injectionBinderRule as BinderRule & { shouldBind: true });
  }

  // Scan for variable node and member access expression in the node to bind
  private scanAndBind(node: SyntaxNode | undefined, rule: BinderRule & { shouldBind: true }) {
    if (!node) {
      return;
    }

    if (node instanceof PrimaryExpressionNode) {
      if (
        node.expression instanceof VariableNode &&
        rule.keywords?.includes(node.expression.variable?.value.toLowerCase() as any)
      ) {
        return;
      }
      this.bindFragments([node], rule);
    } else if (node instanceof InfixExpressionNode) {
      if (isAccessExpression(node)) {
        this.bindFragments(destructureMemberAccessExpression(node).unwrap_or([]), rule);
      } else {
        this.scanAndBind(node.leftExpression, rule);
        this.scanAndBind(node.rightExpression, rule);
      }
    } else if (node instanceof PrefixExpressionNode) {
      this.scanAndBind(node.expression, rule);
    } else if (node instanceof PostfixExpressionNode) {
      this.scanAndBind(node.expression, rule);
    } else if (node instanceof TupleExpressionNode) {
      node.elementList.forEach((e) => this.scanAndBind(e, rule));
    } else if (node instanceof PartialInjectionNode) {
      this.bindFragments([node], rule);
    }

    // The other cases are not supported as practically they shouldn't arise
  }

  // Bind the fragments of a member access expression
  // which can be a simple expression like v1.User,
  // or a complex tuple like v1.User.(id, name)
  private bindFragments(rawFragments: SyntaxNode[], rule: BinderRule & { shouldBind: true }) {
    if (rawFragments.length === 0) {
      return;
    }

    const topSubnamesSymbolKind = [...rule.topSubnamesSymbolKind!];
    const { remainingSubnamesSymbolKind } = rule;

    // Handle cases of binding an incomplete member access expression

    // The first index of the first fragment that is not a variable
    const invalidIndex = rawFragments.findIndex((f) => !isExpressionAVariableNode(f));

    // If the fragments are of a complex tuple, the first non-variable fragment must be a tuple
    const isComplexTuple = invalidIndex !== -1 && isTupleOfVariables(rawFragments[invalidIndex]);

    // In case of a complex tuple expression, both `tuple` and `tupleVarSymbolKind` will not be `undefined`
    const tuple = isComplexTuple ? (rawFragments[invalidIndex] as TupleExpressionNode) : undefined;
    const tupleVarSymbolKind = invalidIndex >= 0 ? topSubnamesSymbolKind.pop() : undefined;

    const fragments = rawFragments.slice(
      0,
      invalidIndex === -1 ? undefined : invalidIndex,
    ) as (PrimaryExpressionNode & { expression: VariableNode })[];
    if (fragments.length === 0) {
      return;
    }

    const subnameStack: {
      index: NodeSymbolIndex;
      referrer: SyntaxNode;
    }[] = [];
    while (topSubnamesSymbolKind.length && fragments.length) {
      const symbolKind = topSubnamesSymbolKind.pop()!;
      const fragment = fragments.pop()!;
      const varname = extractVarNameFromPrimaryVariable(fragment).unwrap();
      subnameStack.unshift({
        index: createNodeSymbolIndex(varname, symbolKind),
        referrer: fragment,
      });
    }

    while (fragments.length) {
      const fragment = fragments.pop()!;
      const varname = extractVarNameFromPrimaryVariable(fragment).unwrap();
      subnameStack.unshift({
        index: createNodeSymbolIndex(varname, remainingSubnamesSymbolKind!),
        referrer: fragment,
      });
    }

    return tuple ?
      tuple.elementList.forEach((e) =>
          this.resolveIndexStack(
            [
              ...subnameStack,
              {
                index: createNodeSymbolIndex(
                  extractVarNameFromPrimaryVariable(e as any).unwrap(),
                  tupleVarSymbolKind!,
                ),
                referrer: e,
              },
            ],
            rule.ignoreNameNotFound,
          ),
        ) :
      this.resolveIndexStack(subnameStack, rule.ignoreNameNotFound);
  }

  // Looking up the indexes in the subname stack from the current declaration node
  // Each time the index resolves to a symbol, the referrer's symbol is bound to it
  private resolveIndexStack(
    subnameStack: { index: NodeSymbolIndex; referrer: SyntaxNode }[],
    ignoreNameNotFound: boolean,
  ) {
    if (subnameStack.length === 0) {
      throw new Error('Unreachable - An unresolved name must have at least one name component');
    }
    const [accessSubname, ...remainingSubnames] = subnameStack;
    const accessSymbol = findSymbol(accessSubname.index, this.declarationNode);
    if (accessSymbol === undefined) {
      const { kind, name } = destructureIndex(accessSubname.index).unwrap();
      this.logError(accessSubname.referrer, `Can not find ${kind} '${name}'`, ignoreNameNotFound);

      return;
    }

    accessSymbol.references.push(accessSubname.referrer);
    accessSubname.referrer.referee = accessSymbol;

    let prevScope = accessSymbol.symbolTable!;
    let { kind: prevKind, name: prevName } = destructureIndex(accessSubname.index).unwrap();
    // eslint-disable-next-line no-restricted-syntax
    for (const subname of remainingSubnames) {
      const { kind: curKind, name: curName } = destructureIndex(subname.index).unwrap();
      const curSymbol = prevScope.get(subname.index);

      if (!curSymbol) {
        this.logError(
          subname.referrer,
          `${prevKind} '${prevName}' does not have ${curKind} '${curName}'`,
          ignoreNameNotFound,
        );

        return;
      }

      prevKind = curKind;
      prevName = curName;
      subname.referrer.referee = curSymbol;
      curSymbol.references.push(subname.referrer);
      if (!curSymbol.symbolTable) {
        break;
      }
      prevScope = curSymbol.symbolTable;
    }
  }

  protected logError(node: SyntaxNode, message: string, ignoreError: boolean) {
    if (!ignoreError) {
      this.errors.push(new CompileError(CompileErrorCode.BINDING_ERROR, message, node));
    }
  }

  resolveInjections (symbolFactory: SymbolFactory) {
    const symbolTable = this.declarationNode.symbol?.symbolTable;
    if (!symbolTable) return;

    const injectedSymbols = new Map<NodeSymbolIndex, NodeSymbol>();

    symbolTable.forEach((_, nodeSymbolIndex) => {
      console.log(isInjectionIndex(nodeSymbolIndex), nodeSymbolIndex);
      if (isInjectionIndex(nodeSymbolIndex)) {
        const nodeSymbol = findSymbol(getInjectorIndex(nodeSymbolIndex)!, this.declarationNode);
        nodeSymbol?.declaration?.symbol?.symbolTable?.forEach((injectedSymbol, injectedIndex) => {
          console.log(injectedIndex, injectedSymbol);
          if (symbolTable.has(injectedIndex)) return;
          injectedSymbols.set(injectedIndex, injectedSymbol);
        });
      }
    });

    injectedSymbols.forEach((injectedSymbol, injectedIndex) => {
      const resInjectedSymbol = symbolFactory.create(TablePartialInjectedColumnSymbol, { injectorId: injectedSymbol.id });
      symbolTable.set(injectedIndex, resInjectedSymbol);
    });
  }
}
