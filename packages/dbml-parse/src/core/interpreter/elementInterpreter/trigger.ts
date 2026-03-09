import { extractQuotedStringToken, extractVariableFromExpression } from '@/core/analyzer/utils';
import { CompileError, CompileErrorCode } from '@/core/errors';
import {
  BlockExpressionNode,
  ElementDeclarationNode,
  FunctionApplicationNode,
  FunctionExpressionNode,
  ListExpressionNode,
  IdentiferStreamNode,
} from '@/core/parser/nodes';
import { ElementInterpreter, InterpreterDatabase, Trigger } from '@/core/interpreter/types';
import { getTokenPosition } from '@/core/interpreter/utils';
import { extractStringFromIdentifierStream, isExpressionAVariableNode } from '@/core/parser/utils';

export class TriggerInterpreter implements ElementInterpreter {
  private declarationNode: ElementDeclarationNode;
  private env: InterpreterDatabase;
  private trigger: Partial<Trigger>;

  constructor (declarationNode: ElementDeclarationNode, env: InterpreterDatabase) {
    this.declarationNode = declarationNode;
    this.env = env;
    this.trigger = {
      schemaName: 'public',
      event: [],
      updateOf: [],
      condition: null,
      constraint: false,
      deferrable: false,
      timing: null,
    };
  }

  interpret (): CompileError[] {
    this.trigger.token = getTokenPosition(this.declarationNode);
    this.env.triggers.set(this.declarationNode, this.trigger as Trigger);
    const errors = this.interpretBody(this.declarationNode.body as BlockExpressionNode);

    // Validation rules
    errors.push(...this.validate());

    return errors;
  }

  private interpretBody (body: BlockExpressionNode): CompileError[] {
    return body.body.flatMap((_sub) => {
      const sub = _sub as FunctionApplicationNode;
      const fieldName = extractVariableFromExpression(sub.callee).unwrap_or('');

      switch (fieldName.toLowerCase()) {
        case 'name': {
          this.trigger.name = extractQuotedStringToken(sub.args[0]).unwrap();
          return [];
        }
        case 'schema': {
          this.trigger.schemaName = extractVariableFromExpression(sub.args[0]).unwrap_or('public');
          return [];
        }
        case 'table': {
          this.trigger.tableName = extractVariableFromExpression(sub.args[0]).unwrap_or('');
          return [];
        }
        case 'when': {
          this.trigger.when = extractVariableFromExpression(sub.args[0]).unwrap_or('');
          return [];
        }
        case 'event': {
          const arg = sub.args[0];
          if (arg instanceof ListExpressionNode) {
            this.trigger.event = arg.elementList.map((attr) => {
              if (attr.name instanceof IdentiferStreamNode) {
                return extractStringFromIdentifierStream(attr.name).unwrap_or('');
              }
              return '';
            }).filter(Boolean);
          }
          return [];
        }
        case 'update_of': {
          const arg = sub.args[0];
          if (arg instanceof ListExpressionNode) {
            this.trigger.updateOf = arg.elementList.map((attr) => {
              if (attr.name instanceof IdentiferStreamNode) {
                return extractStringFromIdentifierStream(attr.name).unwrap_or('');
              }
              return '';
            }).filter(Boolean);
          }
          return [];
        }
        case 'for_each': {
          this.trigger.forEach = extractVariableFromExpression(sub.args[0]).unwrap_or('');
          return [];
        }
        case 'condition': {
          this.trigger.condition = this.extractExpressionOrNull(sub.args[0]);
          return [];
        }
        case 'function': {
          this.trigger.functionName = extractVariableFromExpression(sub.args[0]).unwrap_or('');
          return [];
        }
        case 'constraint': {
          const val = extractVariableFromExpression(sub.args[0]).unwrap_or('false');
          this.trigger.constraint = val.toLowerCase() === 'true';
          return [];
        }
        case 'deferrable': {
          const val = extractVariableFromExpression(sub.args[0]).unwrap_or('false');
          this.trigger.deferrable = val.toLowerCase() === 'true';
          return [];
        }
        case 'timing': {
          this.trigger.timing = extractVariableFromExpression(sub.args[0]).unwrap_or(null);
          return [];
        }
        default:
          return [];
      }
    });
  }

  private validate (): CompileError[] {
    const errors: CompileError[] = [];
    const t = this.trigger;
    const node = this.declarationNode;

    // Required fields
    if (!t.name) {
      errors.push(new CompileError(CompileErrorCode.INVALID_TRIGGER_FIELD_VALUE, 'Trigger is missing required field: name', node));
    }
    if (!t.tableName) {
      errors.push(new CompileError(CompileErrorCode.INVALID_TRIGGER_FIELD_VALUE, 'Trigger is missing required field: table', node));
    }
    if (!t.functionName) {
      errors.push(new CompileError(CompileErrorCode.INVALID_TRIGGER_FIELD_VALUE, 'Trigger is missing required field: function', node));
    }
    if (!t.when || !['before', 'after', 'instead_of'].includes(t.when!)) {
      errors.push(new CompileError(CompileErrorCode.INVALID_TRIGGER_FIELD_VALUE, "Trigger 'when' must be one of: before, after, instead_of", node));
    }
    if (!t.event || t.event.length === 0) {
      errors.push(new CompileError(CompileErrorCode.INVALID_TRIGGER_FIELD_VALUE, 'Trigger must specify at least one event', node));
    }
    if (!t.forEach || !['row', 'statement'].includes(t.forEach!)) {
      errors.push(new CompileError(CompileErrorCode.INVALID_TRIGGER_FIELD_VALUE, "Trigger 'for_each' must be one of: row, statement", node));
    }

    // Cross-field validation (only if base fields are valid)
    if (t.when && t.forEach && t.event && t.event.length > 0) {
      if (t.when === 'instead_of' && t.forEach !== 'row') {
        errors.push(new CompileError(CompileErrorCode.INVALID_TRIGGER_FIELD_VALUE, 'INSTEAD OF triggers must be FOR EACH ROW', node));
      }

      if (t.event.includes('truncate') && t.forEach !== 'statement') {
        errors.push(new CompileError(CompileErrorCode.INVALID_TRIGGER_FIELD_VALUE, 'TRUNCATE triggers must be FOR EACH STATEMENT', node));
      }

      if (t.event.includes('truncate') && t.condition) {
        errors.push(new CompileError(CompileErrorCode.INVALID_TRIGGER_FIELD_VALUE, 'TRUNCATE triggers do not support a WHEN condition', node));
      }

      if (t.when === 'instead_of' && t.event.includes('truncate')) {
        errors.push(new CompileError(CompileErrorCode.INVALID_TRIGGER_FIELD_VALUE, 'INSTEAD OF TRUNCATE triggers are not supported by Postgres', node));
      }

      if (t.updateOf && t.updateOf.length > 0 && !t.event.includes('update')) {
        errors.push(new CompileError(CompileErrorCode.INVALID_TRIGGER_FIELD_VALUE, 'update_of column list is only valid when event includes update', node));
      }

      if (t.when === 'instead_of' && t.updateOf && t.updateOf.length > 0) {
        errors.push(new CompileError(CompileErrorCode.INVALID_TRIGGER_FIELD_VALUE, 'INSTEAD OF UPDATE triggers do not support an update_of column list', node));
      }
    }

    // Constraint trigger validation
    if (t.deferrable && !t.constraint) {
      errors.push(new CompileError(CompileErrorCode.INVALID_TRIGGER_FIELD_VALUE, 'deferrable is only valid on CONSTRAINT TRIGGERs', node));
    }

    if (t.timing && !t.deferrable) {
      errors.push(new CompileError(CompileErrorCode.INVALID_TRIGGER_FIELD_VALUE, 'timing is only valid when deferrable is true', node));
    }

    if (t.constraint && (t.when !== 'after' || t.forEach !== 'row')) {
      errors.push(new CompileError(CompileErrorCode.INVALID_TRIGGER_FIELD_VALUE, 'CONSTRAINT TRIGGERs must be AFTER ROW triggers', node));
    }

    return errors;
  }

  private extractExpressionOrNull (arg?: any): string | null {
    if (!arg) return null;

    if (isExpressionAVariableNode(arg) && arg.expression.variable.value.toLowerCase() === 'null') {
      return null;
    }

    if (arg instanceof FunctionExpressionNode && arg.value) {
      return arg.value.value;
    }

    return null;
  }
}
