import { partition } from 'lodash-es';
import SymbolFactory from '@/core/analyzer/symbol/factory';
import { CompileError, CompileErrorCode } from '@/core/errors';
import {
  BlockExpressionNode,
  ElementDeclarationNode,
  FunctionApplicationNode,
  FunctionExpressionNode,
  IdentiferStreamNode,
  ListExpressionNode,
} from '@/core/parser/nodes';
import { SyntaxToken } from '@/core/lexer/tokens';
import { ElementValidator } from '@/core/analyzer/validator/types';
import SymbolTable from '@/core/analyzer/symbol/symbolTable';
import { extractVariableFromExpression } from '@/core/analyzer/utils';

const VALID_ARG_TYPES = new Set([
  'integer', 'bool', 'bytea', 'date', 'double_precision',
  'float4', 'float8', 'int2', 'int4', 'int8', 'json', 'jsonb',
  'numeric', 'text', 'time', 'timestamp', 'timestamptz', 'timetz',
  'uuid', 'varchar', 'vector',
]);

const VALID_RETURN_TYPES = new Set([
  'void', 'record', 'trigger',
  ...VALID_ARG_TYPES,
]);

const VALID_LANGUAGES = new Set(['plpgsql', 'sql', 'c', 'internal']);
const VALID_BEHAVIORS = new Set(['volatile', 'immutable', 'stable']);
const VALID_SECURITIES = new Set(['invoker', 'definer']);

const SINGLE_OCCURRENCE_FIELDS = new Set(['schema', 'returns', 'args', 'body', 'language', 'behavior', 'security']);

export default class FunctionValidator implements ElementValidator {
  private declarationNode: ElementDeclarationNode & { type: SyntaxToken };
  private publicSymbolTable: SymbolTable;
  private symbolFactory: SymbolFactory;

  constructor (declarationNode: ElementDeclarationNode & { type: SyntaxToken }, publicSymbolTable: SymbolTable, symbolFactory: SymbolFactory) {
    this.declarationNode = declarationNode;
    this.publicSymbolTable = publicSymbolTable;
    this.symbolFactory = symbolFactory;
  }

  validate (): CompileError[] {
    return [
      ...this.validateContext(),
      ...this.validateAlias(this.declarationNode.alias),
      ...this.validateSettingList(this.declarationNode.attributeList),
      ...this.validateBody(this.declarationNode.body),
    ];
  }

  private validateContext (): CompileError[] {
    if (this.declarationNode.parent instanceof ElementDeclarationNode) {
      return [new CompileError(CompileErrorCode.INVALID_FUNCTION_CONTEXT, 'A Function can only appear top-level', this.declarationNode)];
    }

    return [];
  }

  private validateAlias (aliasNode?: any): CompileError[] {
    if (aliasNode) {
      return [new CompileError(CompileErrorCode.UNEXPECTED_ALIAS, 'A Function shouldn\'t have an alias', aliasNode)];
    }

    return [];
  }

  private validateSettingList (settingList?: ListExpressionNode): CompileError[] {
    if (settingList) {
      return [new CompileError(CompileErrorCode.UNEXPECTED_SETTINGS, 'A Function shouldn\'t have a setting list', settingList)];
    }

    return [];
  }

  private validateBody (body?: FunctionApplicationNode | BlockExpressionNode): CompileError[] {
    if (!body) {
      return [];
    }
    if (body instanceof FunctionApplicationNode) {
      return [new CompileError(CompileErrorCode.UNEXPECTED_SIMPLE_BODY, 'A Function\'s body must be a block', body)];
    }

    const [fields] = partition(body.body, (e) => e instanceof FunctionApplicationNode);
    return this.validateFields(fields as FunctionApplicationNode[]);
  }

  private validateFields (fields: FunctionApplicationNode[]): CompileError[] {
    const seen = new Set<string>();
    return fields.flatMap((field) => {
      if (!field.callee) return [];

      const fieldName = extractVariableFromExpression(field.callee).unwrap_or('').toLowerCase();
      const errors: CompileError[] = [];

      if (SINGLE_OCCURRENCE_FIELDS.has(fieldName)) {
        if (seen.has(fieldName)) {
          errors.push(new CompileError(CompileErrorCode.DUPLICATE_FUNCTION_FIELD, `'${fieldName}' can only appear once`, field));
        }
        seen.add(fieldName);
      }

      switch (fieldName) {
        case 'schema':
          break;
        case 'returns': {
          const value = extractVariableFromExpression(field.args[0]).unwrap_or('');
          if (!VALID_RETURN_TYPES.has(value.toLowerCase())) {
            errors.push(new CompileError(
              CompileErrorCode.INVALID_FUNCTION_FIELD_VALUE,
              `'returns' must be a valid return type (e.g. void, integer, text, ...)`,
              field.args[0] || field,
            ));
          }
          break;
        }
        case 'args': {
          const arg = field.args[0];
          if (arg instanceof ListExpressionNode) {
            arg.elementList.forEach((attr) => {
              const argType = extractVariableFromExpression(attr.value as any).unwrap_or('');
              if (argType && !VALID_ARG_TYPES.has(argType.toLowerCase())) {
                errors.push(new CompileError(
                  CompileErrorCode.INVALID_FUNCTION_FIELD_VALUE,
                  `Argument type '${argType}' is not valid`,
                  attr.value || attr,
                ));
              }
            });
          }
          break;
        }
        case 'body':
          if (field.args[0] && !(field.args[0] instanceof FunctionExpressionNode)) {
            const value = extractVariableFromExpression(field.args[0]).unwrap_or('');
            if (!value) {
              errors.push(new CompileError(
                CompileErrorCode.INVALID_FUNCTION_FIELD_VALUE,
                '\'body\' must be an expression or a backtick string',
                field.args[0],
              ));
            }
          }
          break;
        case 'language': {
          const value = extractVariableFromExpression(field.args[0]).unwrap_or('');
          if (!VALID_LANGUAGES.has(value.toLowerCase())) {
            errors.push(new CompileError(
              CompileErrorCode.INVALID_FUNCTION_FIELD_VALUE,
              `'language' must be one of: ${[...VALID_LANGUAGES].join(', ')}`,
              field.args[0] || field,
            ));
          }
          break;
        }
        case 'behavior': {
          const value = extractVariableFromExpression(field.args[0]).unwrap_or('');
          if (!VALID_BEHAVIORS.has(value.toLowerCase())) {
            errors.push(new CompileError(
              CompileErrorCode.INVALID_FUNCTION_FIELD_VALUE,
              `'behavior' must be one of: ${[...VALID_BEHAVIORS].join(', ')}`,
              field.args[0] || field,
            ));
          }
          break;
        }
        case 'security': {
          const value = extractVariableFromExpression(field.args[0]).unwrap_or('');
          if (!VALID_SECURITIES.has(value.toLowerCase())) {
            errors.push(new CompileError(
              CompileErrorCode.INVALID_FUNCTION_FIELD_VALUE,
              `'security' must be one of: ${[...VALID_SECURITIES].join(', ')}`,
              field.args[0] || field,
            ));
          }
          break;
        }
        default:
          errors.push(new CompileError(
            CompileErrorCode.UNKNOWN_FUNCTION_FIELD,
            `Unknown Function field '${fieldName}'`,
            field,
          ));
      }

      return errors;
    });
  }
}
