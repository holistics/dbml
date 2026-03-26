import { CompileError, CompileErrorCode } from '@/core/errors';
import { ElementDeclarationNode, UseDeclarationNode, UseSpecifierNode, type SyntaxNode } from '@/core/parser/nodes';
import SymbolTable from '@/core/analyzer/validator/symbol/symbolTable';
import { isValidName, registerSchemaStack } from '@/core/analyzer/validator/utils';
import { ExternalSymbol, SchemaSymbol, type NodeSymbol } from '@/core/analyzer/validator/symbol/symbols';
import { createNodeSymbolIndex, SymbolKind } from '@/core/analyzer/validator/symbol/symbolIndex';
import { destructureComplexVariable } from '@/core/utils';
import SymbolFactory from '@/core/analyzer/validator/symbol/factory';
import { Filepath, type FilepathId } from '@/compiler/projectLayout';
import { DBML_EXT } from '@/compiler/constants';

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

  private externalFilepaths: Map<FilepathId, UseDeclarationNode>;

  constructor (
    { node, filepath, publicSymbolTable, declarations }: {
      node: UseDeclarationNode;
      filepath: Filepath;
      publicSymbolTable: SymbolTable;
      declarations: WeakMap<SyntaxNode, NodeSymbol>;
    },
    symbolFactory: SymbolFactory,
    externalFilepaths: Map<FilepathId, UseDeclarationNode>,
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
    const resolved = Filepath.resolve(this.filepath.dirname, this.node.path.value);
    if (resolved.absolute.endsWith(DBML_EXT)) return resolved;
    return Filepath.from(resolved.absolute + DBML_EXT);
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
    if (this.node.path && !Filepath.isRelative(this.node.path.value)) {
      return [new CompileError(CompileErrorCode.INVALID_USE_SPECIFIER_NAME, 'Import path must be a relative path (starting with \'./\' or \'../\')', this.node.path)];
    }

    if (!this.node.specifiers) {
      return this.registerWholeFileUse();
    }
    return this.node.specifiers.specifiers.flatMap((specifier) => this.validateSpecifier(specifier));
  }

  private registerWholeFileUse (): CompileError[] {
    const resolved = this.resolveExternalFilepath();
    if (!resolved) return [];
    return this.registerExternalFilepath(resolved);
  }

  private registerExternalFilepath (resolved: Filepath): CompileError[] {
    if (!this.externalFilepaths.has(resolved.intern())) {
      this.externalFilepaths.set(resolved.intern(), this.node);
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
      } else {
        errors.push(new CompileError(CompileErrorCode.INVALID_USE_SPECIFIER_NAME, 'A use specifier requires a \'from\' path', specifier));
        return errors;
      }
      errors.push(...this.registerSpecifierSymbol(specifier, symbolKind, resolved));
    }

    return errors;
  }

  private registerSpecifierSymbol (specifier: UseSpecifierNode, symbolKind: SymbolKind, externalFilepath: Filepath): CompileError[] {
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

    const existingSymbol = symbolTable.get(symbolId);
    if (existingSymbol) {
      // Schema symbols from external files should be merged, not treated as conflicts
      if (symbolKind === SymbolKind.Schema && existingSymbol instanceof SchemaSymbol) {
        if (!existingSymbol.externalFilepaths.some((fp) => fp.intern() === externalFilepath.intern())) {
          existingSymbol.externalFilepaths.push(externalFilepath);
        }
        return [];
      }
      // Duplicate use of the same symbol from the same file is allowed
      const existingSource = existingSymbol instanceof ExternalSymbol
        ? existingSymbol.externalFilepath.intern()
        : existingSymbol.filepath.intern();
      if (existingSource === externalFilepath.intern()) {
        return [];
      }
      return [new CompileError(CompileErrorCode.DUPLICATE_NAME, `'${itemName}' is already defined`, specifier.name!)];
    }

    const symbol = this.symbolFactory.create(ExternalSymbol, {
      declaration: specifier,
      kind: symbolKind,
      name: itemName,
      externalFilepath,
    });
    this.declarations.set(specifier, symbol);
    symbolTable.set(symbolId, symbol);

    return [];
  }
}
