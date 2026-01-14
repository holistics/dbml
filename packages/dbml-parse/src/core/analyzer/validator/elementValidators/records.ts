import { partition } from 'lodash-es';
import SymbolFactory from '@/core/analyzer/symbol/factory';
import { CompileError, CompileErrorCode } from '@/core/errors';
import {
  BlockExpressionNode, CallExpressionNode, CommaExpressionNode, ElementDeclarationNode, EmptyNode, FunctionApplicationNode, FunctionExpressionNode, InfixExpressionNode, ListExpressionNode, LiteralNode, PrefixExpressionNode, PrimaryExpressionNode, ProgramNode, SyntaxNode, TupleExpressionNode, VariableNode,
} from '@/core/parser/nodes';
import { SyntaxToken, SyntaxTokenKind } from '@/core/lexer/tokens';
import { ElementValidator } from '@/core/analyzer/validator/types';
import { isExpressionASignedNumberExpression, isSimpleName, isTupleOfVariables, isValidName, pickValidator } from '@/core/analyzer/validator/utils';
import SymbolTable from '@/core/analyzer/symbol/symbolTable';
import { destructureComplexVariable, getElementKind } from '@/core/analyzer/utils';
import { ElementKind } from '@/core/analyzer/types';
import { isAccessExpression, isExpressionAQuotedString, isExpressionAVariableNode } from '@/core/parser/utils';

export default class RecordsValidator implements ElementValidator {
  private declarationNode: ElementDeclarationNode & { type: SyntaxToken };
  private publicSymbolTable: SymbolTable;
  private symbolFactory: SymbolFactory;

  constructor (declarationNode: ElementDeclarationNode & { type: SyntaxToken }, publicSymbolTable: SymbolTable, symbolFactory: SymbolFactory) {
    this.declarationNode = declarationNode;
    this.publicSymbolTable = publicSymbolTable;
    this.symbolFactory = symbolFactory;
  }

  validate (): CompileError[] {
    return [...this.validateContext(), ...this.validateName(this.declarationNode.name), ...this.validateAlias(this.declarationNode.alias), ...this.validateSettingList(this.declarationNode.attributeList), ...this.validateBody(this.declarationNode.body)];
  }

  // Validate that Records can only appear top-level or inside a Table.
  // Valid:
  //   records users(id, name) { ... }        // top-level
  //   table users { records (id, name) { } } // inside a table
  // Invalid:
  //   enum status { records { } }            // inside an enum
  //   indexes { records { } }                // inside indexes
  private validateContext (): CompileError[] {
    const parent = this.declarationNode.parent;
    const isTopLevel = parent instanceof ProgramNode;

    if (isTopLevel) {
      return [];
    }

    // Check if parent is a table
    if (parent instanceof ElementDeclarationNode) {
      const elementKind = getElementKind(parent).unwrap_or(undefined);
      if (elementKind === ElementKind.Table) {
        return [];
      }
    }

    return [new CompileError(
      CompileErrorCode.INVALID_RECORDS_CONTEXT,
      'Records can only appear at top-level or inside a Table',
      this.declarationNode,
    )];
  }

  private validateName (nameNode?: SyntaxNode): CompileError[] {
    const parent = this.declarationNode.parent;
    const isTopLevel = parent instanceof ProgramNode;

    return isTopLevel
      ? this.validateTopLevelName(nameNode)
      : this.validateInsideTableName(nameNode);
  }

  // At top-level - must reference a table with column list:
  //   Valid:   records users(id, name, email) { }
  //   Valid:   records myschema.users(id, name) { }
  //   Invalid: records users { }              // missing column list
  //   Invalid: records { }                    // missing table reference
  private validateTopLevelName (nameNode?: SyntaxNode): CompileError[] {
    if (!(nameNode instanceof CallExpressionNode)) {
      return [new CompileError(
        CompileErrorCode.INVALID_RECORDS_NAME,
        'Records at top-level must have a name in the form of table(col1, col2, ...) or schema.table(col1, col2, ...)',
        nameNode || this.declarationNode.type,
      )];
    }

    const errors: CompileError[] = [];

    // Validate callee is a valid name (simple or complex variable like schema.table)
    if (!nameNode.callee || !isValidName(nameNode.callee)) {
      errors.push(new CompileError(
        CompileErrorCode.INVALID_RECORDS_NAME,
        'Records table reference must be a valid table name',
        nameNode.callee || nameNode,
      ));
    }

    // Validate argument list is a tuple of simple variables
    if (!nameNode.argumentList || !isTupleOfVariables(nameNode.argumentList)) {
      errors.push(new CompileError(
        CompileErrorCode.INVALID_RECORDS_NAME,
        'Records column list must be simple column names',
        nameNode.argumentList || nameNode,
      ));
    }

    return errors;
  }

  // Inside a table - optional column list only:
  //   Valid:   records (id, name) { }
  //   Valid:   records { }                    // all columns
  //   Invalid: records other_table(id) { }   // can't reference another table
  private validateInsideTableName (nameNode?: SyntaxNode): CompileError[] {
    if (nameNode && !isTupleOfVariables(nameNode)) {
      return [new CompileError(
        CompileErrorCode.INVALID_RECORDS_NAME,
        'Records inside a Table can only have a column list like (col1, col2, ...)',
        nameNode,
      )];
    }

    return [];
  }

  private validateAlias (aliasNode?: SyntaxNode): CompileError[] {
    if (aliasNode) {
      return [new CompileError(CompileErrorCode.UNEXPECTED_ALIAS, 'Records cannot have an alias', aliasNode)];
    }
    return [];
  }

  private validateSettingList (settingList?: ListExpressionNode): CompileError[] {
    if (settingList) {
      return [new CompileError(CompileErrorCode.UNEXPECTED_SETTINGS, 'Records cannot have a setting list', settingList)];
    }
    return [];
  }

  // Validate that records body contains only simple values (one comma-separated row per line).
  // Valid values:
  //   1, 2, 3                      // numbers
  //   -5, +10                      // signed numbers
  //   'hello', "world"            // quoted strings
  //   `backtick string`           // function expression (backtick string)
  //   true, false, TRUE, FALSE    // booleans
  //   null, NULL                  // null
  //   ,, ,                        // empty values (consecutive commas)
  //   status.active               // enum field reference
  //   myschema.status.pending     // schema.enum.field reference
  // Invalid values:
  //   2 + 1, 3 * 2                // arithmetic expressions
  //   func()                      // function calls
  //   (1, 2)                      // nested tuples
  validateBody (body?: FunctionApplicationNode | BlockExpressionNode): CompileError[] {
    if (!body) {
      return [];
    }
    if (body instanceof FunctionApplicationNode) {
      return this.validateDataRow(body);
    }

    const [fields, subs] = partition(body.body, (e) => e instanceof FunctionApplicationNode);
    return [
      ...this.validateDataRows(fields as FunctionApplicationNode[]),
      ...this.validateSubElements(subs as ElementDeclarationNode[]),
    ];
  }

  private validateDataRows (rows: FunctionApplicationNode[]): CompileError[] {
    return rows.flatMap((row) => this.validateDataRow(row));
  }

  // Validate a single data row. Structure should be:
  //   row.callee = CommaExpressionNode (e.g., 1, 'hello', true) or single value (e.g., 1)
  //   row.args = [] (empty)
  private validateDataRow (row: FunctionApplicationNode): CompileError[] {
    const errors: CompileError[] = [];

    // Callee must exist & Args should be empty - all values should be in callee as a comma expression
    if (!row.callee || row.args.length > 0) {
      errors.push(new CompileError(
        CompileErrorCode.INVALID_RECORDS_FIELD,
        'Invalid record row structure',
        row,
      ));
      return errors;
    }

    // Callee should be either a CommaExpressionNode or a single valid value
    if (row.callee instanceof CommaExpressionNode) {
      // Validate each element in the comma expression
      for (const value of row.callee.elementList) {
        if (!this.isValidRecordValue(value)) {
          errors.push(new CompileError(
            CompileErrorCode.INVALID_RECORDS_FIELD,
            'Records can only contain simple values (literals, null, true, false, or enum references). Complex expressions are not allowed.',
            value,
          ));
        }
      }
    } else {
      // Single value (no comma)
      if (!this.isValidRecordValue(row.callee)) {
        errors.push(new CompileError(
          CompileErrorCode.INVALID_RECORDS_FIELD,
          'Records can only contain simple values (literals, null, true, false, or enum references). Complex expressions are not allowed.',
          row.callee,
        ));
      }
    }

    return errors;
  }

  // Check if a value is valid for a record field.
  private isValidRecordValue (value: SyntaxNode): boolean {
    // Empty values from consecutive commas: 1,,3 or ,1,2
    if (value instanceof EmptyNode) {
      return true;
    }

    // Signed numbers: -2, +5, 42, 3.14
    if (isExpressionASignedNumberExpression(value)) {
      return true;
    }

    // Quoted strings: 'single', "double"
    if (isExpressionAQuotedString(value)) {
      return true;
    }

    // Backtick strings: `hello world`
    if (value instanceof FunctionExpressionNode) {
      return true;
    }

    // Simple identifiers: true, false, null, NULL, TRUE, FALSE
    if (isExpressionAVariableNode(value)) {
      return true;
    }

    // Member access for enum field references: status.active, myschema.status.pending
    if (isAccessExpression(value)) {
      const fragments = destructureComplexVariable(value).unwrap_or(undefined);
      return fragments !== undefined && fragments.length > 0;
    }

    return false;
  }

  private validateSubElements (subs: ElementDeclarationNode[]): CompileError[] {
    return subs.flatMap((sub) => {
      sub.parent = this.declarationNode;
      if (!sub.type) {
        return [];
      }
      const _Validator = pickValidator(sub as ElementDeclarationNode & { type: SyntaxToken });
      const validator = new _Validator(sub as ElementDeclarationNode & { type: SyntaxToken }, this.publicSymbolTable, this.symbolFactory);
      return validator.validate();
    });
  }
}
