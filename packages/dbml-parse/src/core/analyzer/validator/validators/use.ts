import { CompileError, CompileErrorCode } from '@/core/errors';
import { ElementDeclarationNode, UseDeclarationNode, UseSpecifierNode, type SyntaxNode } from '@/core/parser/nodes';
import SymbolTable from '@/core/analyzer/symbol/symbolTable';
import { isValidName, registerSchemaStack } from '@/core/analyzer/validator/utils';
import { ExternalSymbol, type NodeSymbol } from '@/core/analyzer/symbol/symbols';
import { createNodeSymbolIndex, SymbolKind } from '@/core/analyzer/symbol/symbolIndex';
import { destructureComplexVariable } from '@/core/analyzer/utils';
import SymbolFactory from '@/core/analyzer/symbol/factory';

const VALID_USE_SPECIFIER_KINDS = new Set<string>([
  SymbolKind.Table,
  SymbolKind.TablePartial,
  SymbolKind.TableGroup,
  SymbolKind.Enum,
]);

export default class UseDeclarationValidator {
  private node: UseDeclarationNode;

  private publicSymbolTable: SymbolTable;

  private declarations: WeakMap<SyntaxNode, NodeSymbol>;

  private symbolFactory: SymbolFactory;

  constructor (node: UseDeclarationNode, publicSymbolTable: SymbolTable, declarations: WeakMap<SyntaxNode, NodeSymbol>, symbolFactory: SymbolFactory) {
    this.node = node;
    this.publicSymbolTable = publicSymbolTable;
    this.declarations = declarations;
    this.symbolFactory = symbolFactory;
  }

  validate (): CompileError[] {
    return [
      ...this.validateContext(),
      ...this.validateSpecifiers(),
    ];
  }

  private validateContext (): CompileError[] {
    if (this.node.parent instanceof ElementDeclarationNode) {
      return [new CompileError(CompileErrorCode.INVALID_TABLE_CONTEXT, '\'use\' must appear at the top level', this.node)];
    }
    return [];
  }

  private validateSpecifiers (): CompileError[] {
    if (!this.node.specifiers) {
      return [];
    }
    return this.node.specifiers.specifiers.flatMap((specifier) => this.validateSpecifier(specifier));
  }

  private validateSpecifier (specifier: UseSpecifierNode): CompileError[] {
    const errors: CompileError[] = [];

    const kindValue = specifier.elementKind?.value;

    let symbolKind;
    switch (kindValue?.toLowerCase()) {
      case 'table':
        symbolKind = SymbolKind.Table;
        break;
      case 'tablegroup':
        symbolKind = SymbolKind.TableGroup;
        break;
      case 'tablepartial':
        symbolKind = SymbolKind.TablePartial;
        break;
      case 'enum':
        symbolKind = SymbolKind.Enum;
        break;
    }

    if (specifier.elementKind === undefined) {
      errors.push(new CompileError(CompileErrorCode.INVALID_USE_SPECIFIER_KIND, 'A use specifier must have a type (e.g. table, enum)', specifier));
    } else if (!VALID_USE_SPECIFIER_KINDS.has(symbolKind ?? '')) {
      errors.push(new CompileError(CompileErrorCode.INVALID_USE_SPECIFIER_KIND, `'${specifier.elementKind.value}' is not a valid specifier type`, specifier.elementKind));
    }

    if (specifier.name === undefined) {
      errors.push(new CompileError(CompileErrorCode.INVALID_USE_SPECIFIER_NAME, 'A use specifier must have a name', specifier));
    } else if (!isValidName(specifier.name)) {
      errors.push(new CompileError(CompileErrorCode.INVALID_USE_SPECIFIER_NAME, 'A use specifier name must be a simple or schema-qualified name', specifier.name));
    }

    if (symbolKind !== undefined && specifier.name !== undefined && isValidName(specifier.name)) {
      errors.push(...this.validateSpecifierName(specifier, symbolKind));
    }

    return errors;
  }

  private validateSpecifierName (specifier: UseSpecifierNode, symbolKind: SymbolKind): CompileError[] {
    const nameFragments = [...destructureComplexVariable(specifier.name).unwrap()];

    switch (symbolKind) {
      case SymbolKind.TableGroup:
        if (nameFragments.length > 1) {
          return [new CompileError(CompileErrorCode.INVALID_USE_SPECIFIER_NAME, 'A TableGroup name must be a simple name', specifier.name!)];
        }
        break;
      default:
        break;
    }

    const itemName = nameFragments.pop()!;
    const symbolTable = registerSchemaStack(nameFragments, this.publicSymbolTable, this.symbolFactory);
    const symbolId = createNodeSymbolIndex(itemName, symbolKind);

    if (symbolTable.has(symbolId)) {
      return [new CompileError(CompileErrorCode.DUPLICATE_NAME, `'${itemName}' is already defined`, specifier.name!)];
    }

    const symbol = this.symbolFactory.create(ExternalSymbol, { declaration: specifier, kind: symbolKind, name: itemName });
    this.declarations.set(specifier, symbol);
    symbolTable.set(symbolId, symbol);

    return [];
  }
}
