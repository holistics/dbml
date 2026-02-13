import { extractQuotedStringToken, extractVariableFromExpression } from '@/core/analyzer/utils';
import { CompileError } from '@/core/errors';
import {
  BlockExpressionNode,
  ElementDeclarationNode,
  FunctionApplicationNode,
  FunctionExpressionNode,
  ListExpressionNode,
  IdentiferStreamNode,
} from '@/core/parser/nodes';
import { ElementInterpreter, InterpreterDatabase, Policy } from '@/core/interpreter/types';
import { getTokenPosition } from '@/core/interpreter/utils';
import { extractStringFromIdentifierStream, isExpressionAVariableNode } from '@/core/parser/utils';

export class PolicyInterpreter implements ElementInterpreter {
  private declarationNode: ElementDeclarationNode;
  private env: InterpreterDatabase;
  private policy: Partial<Policy>;

  constructor (declarationNode: ElementDeclarationNode, env: InterpreterDatabase) {
    this.declarationNode = declarationNode;
    this.env = env;
    this.policy = {
      schemaName: 'public',
      behavior: 'permissive',
      command: 'all',
      roles: ['public'],
      using: null,
      check: null,
    };
  }

  interpret (): CompileError[] {
    this.policy.token = getTokenPosition(this.declarationNode);
    this.env.policies.set(this.declarationNode, this.policy as Policy);
    const errors = this.interpretBody(this.declarationNode.body as BlockExpressionNode);

    return errors;
  }

  private interpretBody (body: BlockExpressionNode): CompileError[] {
    return body.body.flatMap((_sub) => {
      const sub = _sub as FunctionApplicationNode;
      const fieldName = extractVariableFromExpression(sub.callee).unwrap_or('');

      switch (fieldName.toLowerCase()) {
        case 'name': {
          this.policy.name = extractQuotedStringToken(sub.args[0]).unwrap();
          return [];
        }
        case 'schema': {
          this.policy.schemaName = extractVariableFromExpression(sub.args[0]).unwrap_or('public');
          return [];
        }
        case 'table': {
          this.policy.tableName = extractVariableFromExpression(sub.args[0]).unwrap_or('');
          return [];
        }
        case 'behavior': {
          this.policy.behavior = extractVariableFromExpression(sub.args[0]).unwrap_or('permissive');
          return [];
        }
        case 'command': {
          this.policy.command = extractVariableFromExpression(sub.args[0]).unwrap_or('all');
          return [];
        }
        case 'roles': {
          const arg = sub.args[0];
          if (arg instanceof ListExpressionNode) {
            this.policy.roles = arg.elementList.map((attr) => {
              if (attr.name instanceof IdentiferStreamNode) {
                return extractStringFromIdentifierStream(attr.name).unwrap_or('');
              }
              return '';
            }).filter(Boolean);
          }
          return [];
        }
        case 'using': {
          this.policy.using = this.extractExpressionOrNull(sub.args[0]);
          return [];
        }
        case 'check': {
          this.policy.check = this.extractExpressionOrNull(sub.args[0]);
          return [];
        }
        default:
          return [];
      }
    });
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
