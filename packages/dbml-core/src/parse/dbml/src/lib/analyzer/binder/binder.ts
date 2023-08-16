import { CompileError, CompileErrorCode } from '../../errors';
import { ElementDeclarationNode, ProgramNode, SyntaxNode } from '../../parser/nodes';
import { SchemaSymbol } from '../symbol/symbols';
import { UnresolvedName, UnresolvedQualifiedName, UnresolvedUnqualifiedName } from '../types';
import Report from '../../report';
import { destructureId } from '../symbol/symbolIndex';

export default class Binder {
  private ast: ProgramNode;

  private publicSchemaSymbol: SchemaSymbol;

  private unresolvedNames: UnresolvedName[];

  private errors: CompileError[];

  constructor(
    ast: ProgramNode,
    publicSchemaSymbol: SchemaSymbol,
    unresolvedNames: UnresolvedName[],
  ) {
    this.ast = ast;
    this.publicSchemaSymbol = publicSchemaSymbol;
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

  private resolveName(name: UnresolvedName) {
    return name.qualifiers ? this.resolveQualifiedName(name) : this.resolveUnqualifiedName(name);
  }

  private resolveQualifiedName({ id, qualifiers, referrer }: UnresolvedQualifiedName) {
    let { symbolTable } = this.publicSchemaSymbol;
    let curtype = '';
    const accessedName = [];

    // eslint-disable-next-line no-restricted-syntax
    for (const qualifier of qualifiers) {
      const symbol = symbolTable.get(qualifier);
      const { name, type } = destructureId(qualifier);

      if (!symbol) {
        this.logError(
          referrer,
          `There's no ${type} "${name}" in ${curtype} "${accessedName.join('.')}"`,
        );

        return;
      }

      curtype = type;
      accessedName.push(name);

      if (!symbol.symbolTable) {
        throw new Error('Unreachable - A symbol returned by a qualifier must have a symbol table');
      }

      symbolTable = symbol.symbolTable;
    }

    const { name, type } = destructureId(id);
    if (!symbolTable.has(id)) {
      this.logError(
        referrer,
        `There's no ${type} "${name}" in ${curtype} "${accessedName.join('.')}"`,
      );

      return;
    }

    // eslint-disable-next-line no-param-reassign
    referrer.symbol = symbolTable.get(id);
  }

  private resolveUnqualifiedName({ id, ownerElement, referrer }: UnresolvedUnqualifiedName) {
    let curElement: ElementDeclarationNode | undefined = ownerElement;
    while (curElement && !curElement?.symbol?.symbolTable) {
      curElement = curElement.parentElement;
    }

    if (!curElement) {
      throw new Error("Unreachable - Couldn't find a symbol table for an unqualified name");
    }

    const { symbolTable } = curElement.symbol as any;
    const { name, type } = destructureId(id);
    if (!symbolTable.has(id)) {
      this.logError(
        referrer,
        `There's no ${type} ${name} in the enclosing ${curElement.symbol!.kind}`,
      );

      return;
    }

    // eslint-disable-next-line no-param-reassign
    referrer.symbol = symbolTable.get(id);
  }

  protected logError(node: SyntaxNode, message: string) {
    this.errors.push(new CompileError(CompileErrorCode.BINDING_ERROR, message, node));
  }
}
