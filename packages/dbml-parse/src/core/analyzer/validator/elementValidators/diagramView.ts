import { CompileError, CompileErrorCode } from '@/core/errors';
import {
  BlockExpressionNode, ElementDeclarationNode, FunctionApplicationNode, ListExpressionNode, ProgramNode, SyntaxNode,
} from '@/core/parser/nodes';
import SymbolFactory from '@/core/analyzer/symbol/factory';
import { SyntaxToken } from '@/core/lexer/tokens';
import { ElementValidator } from '@/core/analyzer/validator/types';
import SymbolTable from '@/core/analyzer/symbol/symbolTable';
import { getElementKind } from '@/core/analyzer/utils';
import { ElementKind } from '@/core/analyzer/types';
import { extractElementName } from '@/core/interpreter/utils';
import { DEFAULT_SCHEMA_NAME } from '@/constants';
import { destructureComplexVariable, getElementKind as getElementKindUtil } from '@/core/analyzer/utils';
import { createTableSymbolIndex, createSchemaSymbolIndex } from '@/core/analyzer/symbol/symbolIndex';

export default class DiagramViewValidator implements ElementValidator {
  private declarationNode: ElementDeclarationNode & { type: SyntaxToken };
  private publicSymbolTable: SymbolTable;
  private symbolFactory: SymbolFactory;

  constructor (declarationNode: ElementDeclarationNode & { type: SyntaxToken }, publicSymbolTable: SymbolTable, symbolFactory: SymbolFactory) {
    this.declarationNode = declarationNode;
    this.publicSymbolTable = publicSymbolTable;
    this.symbolFactory = symbolFactory;
  }

  validate (): CompileError[] {
    const errors: CompileError[] = [];

    // Get the DiagramView name
    if (this.declarationNode.name) {
      const { name: viewName } = extractElementName(this.declarationNode.name);

      // Check for duplicate DiagramView names in the program
      const program = this.declarationNode.parent;
      if (program instanceof ProgramNode) {
        const diagramViews = program.body.filter(
          (elem) => elem !== this.declarationNode
            && getElementKind(elem).unwrap_or(undefined) === ElementKind.DiagramView
            && elem.name,
        );

        for (const otherView of diagramViews) {
          const { name: otherName } = extractElementName(otherView.name!);
          if (viewName === otherName) {
            errors.push(
              new CompileError(
                CompileErrorCode.DUPLICATE_NAME,
                `DiagramView name '${viewName}' already exists`,
                this.declarationNode.name,
              ),
            );
            break;
          }
        }

        // Validate table, note, and tableGroup references
        errors.push(...this.validateTableReferences(program));
        errors.push(...this.validateNoteReferences(program));
        errors.push(...this.validateTableGroupReferences(program));
      }
    }

    return errors;
  }

  private validateTableReferences (program: ProgramNode): CompileError[] {
    const errors: CompileError[] = [];
    const body = this.declarationNode.body;

    if (!body || body instanceof FunctionApplicationNode) {
      return errors;
    }

    // Find the 'tables' block
    const tablesBlock = body.body?.find(
      (elem) => elem instanceof ElementDeclarationNode
        && elem.type?.value.toLowerCase() === 'tables',
    ) as ElementDeclarationNode | undefined;

    if (!tablesBlock?.body || tablesBlock.body instanceof FunctionApplicationNode) {
      return errors;
    }

    // Get all tables from the program
    const tables = program.body.filter(
      (elem) => getElementKindUtil(elem).unwrap_or(undefined) === ElementKind.Table,
    );

    // Get the public schema symbol table
    const publicSchemaId = createSchemaSymbolIndex(DEFAULT_SCHEMA_NAME);
    const publicSchemaTable = this.publicSymbolTable.has(publicSchemaId)
      ? this.publicSymbolTable.get(publicSchemaId)?.symbolTable
      : undefined;

    // Validate each table reference
    for (const element of tablesBlock.body.body) {
      if (element instanceof FunctionApplicationNode && element.callee) {
        const nameFragments = destructureComplexVariable(element.callee).unwrap_or([]);
        const tableName = nameFragments.pop();
        const schemaNames = nameFragments;

        if (!tableName) continue;

        if (schemaNames.length > 0) {
          // Table has schema qualifier - check if it exists in that schema
          const schemaName = schemaNames[0];
          const schemaId = createSchemaSymbolIndex(schemaName);

          if (!this.publicSymbolTable.has(schemaId)) {
            errors.push(
              new CompileError(
                CompileErrorCode.UNKNOWN_SYMBOL,
                `Schema '${schemaName}' does not exist`,
                element.callee,
              ),
            );
            continue;
          }

          const schemaTable = this.publicSymbolTable.get(schemaId)?.symbolTable;
          const tableId = createTableSymbolIndex(tableName);
          if (!schemaTable?.has(tableId)) {
            errors.push(
              new CompileError(
                CompileErrorCode.UNKNOWN_SYMBOL,
                `Table '${schemaName}.${tableName}' does not exist`,
                element.callee,
              ),
            );
          }
        } else {
          // Table has no schema qualifier - check if it exists in the default schema (public)
          const tableId = createTableSymbolIndex(tableName);
          const existsInPublicSchema = publicSchemaTable?.has(tableId);

          if (!existsInPublicSchema) {
            // Also check if the table exists in any other schema (for better error message)
            let foundInSchema: string | undefined;
            for (const [key, symbol] of this.publicSymbolTable.entries()) {
              if (key.startsWith('Schema:')) {
                const schemaName = key.replace('Schema:', '');
                const schemaTable = symbol?.symbolTable;
                if (schemaTable?.has(tableId)) {
                  foundInSchema = schemaName;
                  break;
                }
              }
            }

            if (foundInSchema) {
              errors.push(
                new CompileError(
                  CompileErrorCode.UNKNOWN_SYMBOL,
                  `Table '${tableName}' not found in default schema '${DEFAULT_SCHEMA_NAME}'. Did you mean '${foundInSchema}.${tableName}'?`,
                  element.callee,
                ),
              );
            } else if (tables.length === 0) {
              errors.push(
                new CompileError(
                  CompileErrorCode.UNKNOWN_SYMBOL,
                  `Table '${tableName}' does not exist`,
                  element.callee,
                ),
              );
            }
          }
        }
      }
    }

    return errors;
  }

  private validateNoteReferences (program: ProgramNode): CompileError[] {
    const errors: CompileError[] = [];
    const body = this.declarationNode.body;

    if (!body || body instanceof FunctionApplicationNode) {
      return errors;
    }

    // Find the 'notes' block
    const notesBlock = body.body?.find(
      (elem) => elem instanceof ElementDeclarationNode
        && (elem.type?.value.toLowerCase() === 'notes' || elem.type?.value.toLowerCase() === 'sticky_notes'),
    ) as ElementDeclarationNode | undefined;

    if (!notesBlock?.body || notesBlock.body instanceof FunctionApplicationNode) {
      return errors;
    }

    // Get all notes from the program
    const notes = program.body.filter(
      (elem) => getElementKindUtil(elem).unwrap_or(undefined) === ElementKind.Note,
    );

    // Validate each note reference
    for (const element of notesBlock.body.body) {
      if (element instanceof FunctionApplicationNode && element.callee) {
        const nameFragments = destructureComplexVariable(element.callee).unwrap_or([]);
        const noteName = nameFragments.pop();

        if (!noteName) continue;

        // Check if note exists in any schema
        const noteId = `Note:${noteName}`;
        const noteExists = this.publicSymbolTable.has(noteId);

        if (!noteExists && notes.length > 0) {
          errors.push(
            new CompileError(
              CompileErrorCode.UNKNOWN_SYMBOL,
              `Note '${noteName}' does not exist`,
              element.callee,
            ),
          );
        }
      }
    }

    return errors;
  }

  private validateTableGroupReferences (program: ProgramNode): CompileError[] {
    const errors: CompileError[] = [];
    const body = this.declarationNode.body;

    if (!body || body instanceof FunctionApplicationNode) {
      return errors;
    }

    // Find the 'tableGroups' block
    const tableGroupsBlock = body.body?.find(
      (elem) => elem instanceof ElementDeclarationNode
        && (elem.type?.value.toLowerCase() === 'tablegroups' || elem.type?.value.toLowerCase() === 'table_groups'),
    ) as ElementDeclarationNode | undefined;

    if (!tableGroupsBlock?.body || tableGroupsBlock.body instanceof FunctionApplicationNode) {
      return errors;
    }

    // Get all tableGroups from the program
    const tableGroups = program.body.filter(
      (elem) => getElementKindUtil(elem).unwrap_or(undefined) === ElementKind.TableGroup,
    );

    // Validate each tableGroup reference
    for (const element of tableGroupsBlock.body.body) {
      if (element instanceof FunctionApplicationNode && element.callee) {
        const nameFragments = destructureComplexVariable(element.callee).unwrap_or([]);
        const tableGroupName = nameFragments.pop();

        if (!tableGroupName) continue;

        // Check if tableGroup exists
        const tableGroupId = `TableGroup:${tableGroupName}`;
        const tableGroupExists = this.publicSymbolTable.has(tableGroupId);

        if (!tableGroupExists && tableGroups.length > 0) {
          errors.push(
            new CompileError(
              CompileErrorCode.UNKNOWN_SYMBOL,
              `TableGroup '${tableGroupName}' does not exist`,
              element.callee,
            ),
          );
        }
      }
    }

    return errors;
  }
}
