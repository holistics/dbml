import { CompileError, CompileErrorCode } from '@/core/errors';
import { ElementDeclarationNode, UseDeclarationNode, UseSpecifierNode, type SyntaxNode } from '@/core/parser/nodes';
import SymbolTable from '@/core/validator/symbol/symbolTable';
import { isValidName, registerSchemaStack } from '@/core/validator/utils';
import { ExternalSymbol, type NodeSymbol } from '@/core/validator/symbol/symbols';
import { createNodeSymbolIndex, SymbolKind } from '@/core/validator/symbol/symbolIndex';
import { destructureComplexVariable } from '@/core/utils';
import SymbolFactory from '@/core/validator/symbol/factory';
import { Filepath, type FilepathKey } from '@/compiler/projectLayout';

const VALID_USE_SPECIFIER_KINDS = new Set<string>([
  SymbolKind.Schema,
  SymbolKind.Table,
  SymbolKind.TablePartial,
  SymbolKind.TableGroup,
  SymbolKind.Enum,
  SymbolKind.Note,
]);

export default class UseDeclarationValidator {
  private node: UseDeclarationNode;

  private filepath: Filepath;

  private publicSymbolTable: SymbolTable;

  private declarations: WeakMap<SyntaxNode, NodeSymbol>;

  private symbolFactory: SymbolFactory;

  private externalFilepaths: Map<FilepathKey, SyntaxNode>;

  constructor (
    { node, filepath, publicSymbolTable, declarations }: {
      node: UseDeclarationNode;
      filepath: Filepath;
      publicSymbolTable: SymbolTable;
      declarations: WeakMap<SyntaxNode, NodeSymbol>;
    },
    symbolFactory: SymbolFactory,
    externalFilepaths: Map<FilepathKey, SyntaxNode>,
  ) {
    this.node = node;
    this.filepath = filepath;
    this.publicSymbolTable = publicSymbolTable;
    this.declarations = declarations;
    this.symbolFactory = symbolFactory;
    this.externalFilepaths = externalFilepaths;
  }

  private resolveExternalFilepath (): Filepath | undefined {
    if (!this.node.path) return undefined;
    return Filepath.resolve(this.filepath.dirname, this.node.path.value);
  }

  validate (): CompileError[] {
    return [
      ...this.validateContext(),
      ...this.validateBody(),
    ];
  }

  private validateContext (): CompileError[] {
    if (this.node.parent instanceof ElementDeclarationNode) {
      return [new CompileError(CompileErrorCode.INVALID_TABLE_CONTEXT, '\'use\' must appear at the top level', this.node)];
    }
    return [];
  }

  private validateBody (): CompileError[] {
    // Entire-file use: use './path.dbml'
    if (!this.node.specifiers) {
      return this.registerWholeFileUse();
    }
    return this.node.specifiers.specifiers.flatMap((specifier) => this.validateSpecifier(specifier));
  }

  private registerWholeFileUse (): CompileError[] {
    const resolved = this.resolveExternalFilepath();
    if (!resolved) return [];

    if (this.externalFilepaths.has(resolved.key)) {
      return [new CompileError(CompileErrorCode.DUPLICATE_NAME, `'${resolved.absolute}' is already imported`, this.node)];
    }

    this.externalFilepaths.set(resolved.key, this.node);
    return [];
  }

  private registerExternalFilepath (resolved: Filepath): CompileError[] {
    // A selective use from a filepath that's already whole-file imported is an error
    if (this.externalFilepaths.has(resolved.key)) {
      return [new CompileError(CompileErrorCode.DUPLICATE_NAME, `'${resolved.absolute}' is already imported as a whole file`, this.node)];
    }
    return [];
  }

  private validateSpecifier (specifier: UseSpecifierNode): CompileError[] {
    const errors: CompileError[] = [];

    const kindValue = specifier.elementKind?.value;

    let symbolKind: SymbolKind | undefined;
    switch (kindValue?.toLowerCase()) {
      case 'table': symbolKind = SymbolKind.Table; break;
      case 'tablegroup': symbolKind = SymbolKind.TableGroup; break;
      case 'tablepartial': symbolKind = SymbolKind.TablePartial; break;
      case 'enum': symbolKind = SymbolKind.Enum; break;
      case 'note': symbolKind = SymbolKind.Note; break;
      case 'schema': symbolKind = SymbolKind.Schema; break;
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

    if (errors.length > 0) return errors;

    if (symbolKind !== undefined && specifier.name !== undefined && isValidName(specifier.name)) {
      const resolved = this.resolveExternalFilepath();
      if (resolved) {
        errors.push(...this.registerExternalFilepath(resolved));
        if (errors.length > 0) return errors;
      }
      errors.push(...this.registerSpecifierSymbol(specifier, symbolKind, resolved?.absolute));
    }

    return errors;
  }

  private registerSpecifierSymbol (specifier: UseSpecifierNode, symbolKind: SymbolKind, externalFilepath?: string): CompileError[] {
    const nameFragments = [...destructureComplexVariable(specifier.name).unwrap()];

    switch (symbolKind) {
      case SymbolKind.TableGroup:
        if (nameFragments.length > 1) {
          return [new CompileError(CompileErrorCode.INVALID_USE_SPECIFIER_NAME, 'A TableGroup name must be a simple name', specifier.name!)];
        }
        break;
      case SymbolKind.Note:
        if (nameFragments.length > 1) {
          return [new CompileError(CompileErrorCode.INVALID_USE_SPECIFIER_NAME, 'A Sticky Note name must be a simple name', specifier.name!)];
        }
        break;
      case SymbolKind.Schema:
        if (nameFragments.length > 1) {
          return [new CompileError(CompileErrorCode.INVALID_USE_SPECIFIER_NAME, 'A Schema name must be a simple name', specifier.name!)];
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

    const symbol = this.symbolFactory.create(ExternalSymbol, {
      declaration: specifier,
      kind: symbolKind,
      name: itemName,
      externalFilepath: externalFilepath ?? '',
    });
    this.declarations.set(specifier, symbol);
    symbolTable.set(symbolId, symbol);

    return [];
  }
}
