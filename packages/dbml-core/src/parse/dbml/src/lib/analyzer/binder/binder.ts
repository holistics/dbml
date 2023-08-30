import { CompileError, CompileErrorCode } from '../../errors';
import { ProgramNode, SyntaxNode } from '../../parser/nodes';
import { UnresolvedName } from '../types';
import Report from '../../report';
import { destructureIndex } from '../symbol/symbolIndex';
import { findSymbol } from '../utils';

export default class Binder {
  private ast: ProgramNode;

  private unresolvedNames: UnresolvedName[];

  private errors: CompileError[];

  constructor(ast: ProgramNode, unresolvedNames: UnresolvedName[]) {
    this.ast = ast;
    this.unresolvedNames = unresolvedNames;
    this.errors = [];
  }

  resolve(): Report<ProgramNode, CompileError> {
    // eslint-disable-next-line no-restricted-syntax
    for (const name of this.unresolvedNames) {
      this.resolveName(name);
    }

    return new Report(this.ast, this.errors);
  }

  private resolveName({ ids, ownerElement, referrer }: UnresolvedName) {
    if (ids.length === 0) {
      throw new Error('Unreachable - An unresolved name must have at least one name component');
    }
    const [accessId, ...remainingIds] = ids;
    const accessSymbol = findSymbol(accessId, ownerElement);
    if (accessSymbol === undefined) {
      const { type, name } = destructureIndex(accessId);
      this.logError(referrer, `Can not find ${type} '${name}'`);

      return;
    }

    if (remainingIds.length === 0) {
      accessSymbol.references.push(referrer);
      // eslint-disable-next-line no-param-reassign
      referrer.referee = accessSymbol;

      return;
    }

    const elementId = remainingIds.pop()!;

    let { type: prevType, name: prevName } = destructureIndex(accessId);
    let prevScope = accessSymbol.symbolTable!;
    // eslint-disable-next-line no-restricted-syntax
    for (const qualifierId of remainingIds) {
      const { type: curType, name: curName } = destructureIndex(qualifierId);
      const curSymbol = prevScope.get(qualifierId);

      if (!curSymbol) {
        this.logError(referrer, `${prevType} '${prevName}' does not have ${curType} '${curName}'`);

        return;
      }

      if (!curSymbol.symbolTable) {
        throw new Error('Unreachable - a symbol accessed by a qualifier must have a symbol table');
      }

      prevType = curType;
      prevName = curName;
      prevScope = curSymbol.symbolTable;
    }

    if (!prevScope.has(elementId)) {
      const { type, name } = destructureIndex(elementId);
      this.logError(referrer, `${prevType} '${prevName}' does not have ${type} '${name}'`);

      return;
    }

    const elementSymbol = prevScope.get(elementId)!;
    elementSymbol.references.push(referrer);
    // eslint-disable-next-line no-param-reassign
    referrer.referee = elementSymbol;
  }

  protected logError(node: SyntaxNode, message: string) {
    this.errors.push(new CompileError(CompileErrorCode.BINDING_ERROR, message, node));
  }
}
