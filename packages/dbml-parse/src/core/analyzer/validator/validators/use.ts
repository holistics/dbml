import { CompileError, CompileErrorCode } from '@/core/errors';
import { ElementDeclarationNode, UseDeclarationNode, UseSpecifierNode } from '@/core/parser/nodes';
import { isValidName } from '@/core/analyzer/validator/utils';
import { SymbolKind } from '@/core/analyzer/symbol/symbolIndex';
import { destructureComplexVariable } from '@/core/analyzer/utils';
import { Filepath } from '@/compiler/projectLayout';
import { DBML_EXT } from '@/compiler/constants';
import type { SelectiveUseInfo, WildcardUseInfo } from '@/compiler/queries/pipeline/analyze';

export enum ImportKind {
  Table = 'table',
  Enum = 'enum',
  TableGroup = 'tableGroup',
  TablePartial = 'tablePartial',
  Note = 'note',
}

export const SYMBOL_KIND_TO_IMPORT_KIND: Partial<Record<SymbolKind, ImportKind>> = {
  [SymbolKind.Table]: ImportKind.Table,
  [SymbolKind.Enum]: ImportKind.Enum,
  [SymbolKind.TableGroup]: ImportKind.TableGroup,
  [SymbolKind.TablePartial]: ImportKind.TablePartial,
  [SymbolKind.Note]: ImportKind.Note,
};

const VALID_USE_SPECIFIER_KINDS = new Set<SymbolKind>([
  SymbolKind.Schema,
  SymbolKind.Table,
  SymbolKind.TablePartial,
  SymbolKind.TableGroup,
  SymbolKind.Enum,
  SymbolKind.Note,
]);

export type UseValidationResult = {
  errors: CompileError[];
  selectiveUses: SelectiveUseInfo[];
  wildcardUses: WildcardUseInfo[];
};

export default class UseDeclarationValidator {
  private node: UseDeclarationNode;

  private filepath: Filepath;

  constructor (
    { node, filepath }: {
      node: UseDeclarationNode;
      filepath: Filepath;
    },
  ) {
    this.node = node;
    this.filepath = filepath;
  }

  private resolveExternalFilepath (): Filepath | undefined {
    if (!this.node.path) return undefined;
    const resolved = Filepath.resolve(this.filepath.dirname, this.node.path.value);
    if (resolved.absolute.endsWith(DBML_EXT)) return resolved;
    return Filepath.from(resolved.absolute + DBML_EXT);
  }

  validate (): UseValidationResult {
    const contextErrors = this.validateContext();
    if (contextErrors.length > 0) {
      return { errors: contextErrors, selectiveUses: [], wildcardUses: [] };
    }
    return this.validateBody();
  }

  private validateContext (): CompileError[] {
    if (this.node.parent instanceof ElementDeclarationNode) {
      return [new CompileError(CompileErrorCode.INVALID_TABLE_CONTEXT, '\'use\' must appear at the top level', this.node)];
    }
    return [];
  }

  private validateBody (): UseValidationResult {
    const errors: CompileError[] = [];
    const selectiveUses: SelectiveUseInfo[] = [];
    const wildcardUses: WildcardUseInfo[] = [];

    if (this.node.path && !Filepath.isRelative(this.node.path.value)) {
      errors.push(new CompileError(CompileErrorCode.INVALID_USE_SPECIFIER_NAME, 'Import path must be a relative path (starting with \'./\' or \'../\')', this.node.path));
      return { errors, selectiveUses, wildcardUses };
    }

    if (!this.node.specifiers) {
      const resolved = this.resolveExternalFilepath();
      if (resolved) {
        wildcardUses.push({
          filepath: resolved,
          reexport: this.node.isReuse,
          declaration: this.node,
        });
      }
      return { errors, selectiveUses, wildcardUses };
    }

    for (const specifier of this.node.specifiers.specifiers) {
      const result = this.validateSpecifier(specifier);
      errors.push(...result.errors);
      if (result.info) {
        selectiveUses.push(result.info);
      }
    }

    return { errors, selectiveUses, wildcardUses };
  }

  private validateSpecifier (specifier: UseSpecifierNode): { errors: CompileError[]; info?: SelectiveUseInfo } {
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
    } else if (!symbolKind || !VALID_USE_SPECIFIER_KINDS.has(symbolKind)) {
      errors.push(new CompileError(CompileErrorCode.INVALID_USE_SPECIFIER_KIND, `'${specifier.elementKind.value}' is not a valid specifier type`, specifier.elementKind));
    }

    if (specifier.name === undefined) {
      errors.push(new CompileError(CompileErrorCode.INVALID_USE_SPECIFIER_NAME, 'A use specifier must have a name', specifier));
    } else if (!isValidName(specifier.name)) {
      errors.push(new CompileError(CompileErrorCode.INVALID_USE_SPECIFIER_NAME, 'A use specifier name must be a simple or schema-qualified name', specifier.name));
    }

    if (specifier.alias !== undefined && !isValidName(specifier.alias)) {
      errors.push(new CompileError(CompileErrorCode.INVALID_USE_SPECIFIER_NAME, 'A use specifier alias must be a simple name', specifier.alias));
    } else if (specifier.alias !== undefined) {
      const aliasFragments = [...destructureComplexVariable(specifier.alias).unwrap()];
      if (aliasFragments.length > 1) {
        errors.push(new CompileError(CompileErrorCode.INVALID_USE_SPECIFIER_NAME, 'A use specifier alias must be a simple name (not schema-qualified)', specifier.alias));
      }
    }

    if (errors.length > 0) return { errors };

    if (symbolKind === undefined || specifier.name === undefined || !isValidName(specifier.name)) {
      return { errors };
    }

    const resolved = this.resolveExternalFilepath();
    if (!resolved) {
      errors.push(new CompileError(CompileErrorCode.INVALID_USE_SPECIFIER_NAME, 'A use specifier requires a \'from\' path', specifier));
      return { errors };
    }

    const nameFragments = [...destructureComplexVariable(specifier.name).unwrap()];

    switch (symbolKind) {
      case SymbolKind.TableGroup:
        if (nameFragments.length > 1) {
          return { errors: [new CompileError(CompileErrorCode.INVALID_USE_SPECIFIER_NAME, 'A TableGroup name must be a simple name', specifier.name!)] };
        }
        break;
      case SymbolKind.Note:
        if (nameFragments.length > 1) {
          return { errors: [new CompileError(CompileErrorCode.INVALID_USE_SPECIFIER_NAME, 'A Sticky Note name must be a simple name', specifier.name!)] };
        }
        break;
      case SymbolKind.Schema:
        if (nameFragments.length > 1) {
          return { errors: [new CompileError(CompileErrorCode.INVALID_USE_SPECIFIER_NAME, 'A Schema name must be a simple name', specifier.name!)] };
        }
        break;
      default:
        break;
    }

    const itemName = nameFragments.pop()!;
    const schemaPath = nameFragments;

    let localName: string;
    if (specifier.alias) {
      const aliasFragments = [...destructureComplexVariable(specifier.alias).unwrap()];
      localName = aliasFragments[0];
    } else {
      localName = itemName;
    }

    return {
      errors: [],
      info: {
        kind: symbolKind,
        name: itemName,
        localName,
        filepath: resolved,
        reexport: this.node.isReuse,
        declaration: specifier,
        schemaPath,
      },
    };
  }
}
