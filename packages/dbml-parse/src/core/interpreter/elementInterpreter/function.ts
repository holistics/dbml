import { extractVariableFromExpression } from '@/core/analyzer/utils';
import { CompileError } from '@/core/errors';
import {
  BlockExpressionNode,
  ElementDeclarationNode,
  FunctionApplicationNode,
  FunctionExpressionNode,
  ListExpressionNode,
  IdentiferStreamNode,
} from '@/core/parser/nodes';
import { ElementInterpreter, Function, FunctionArg, InterpreterDatabase } from '@/core/interpreter/types';
import { extractElementName, getTokenPosition } from '@/core/interpreter/utils';
import { extractStringFromIdentifierStream } from '@/core/parser/utils';

export class FunctionInterpreter implements ElementInterpreter {
  private declarationNode: ElementDeclarationNode;
  private env: InterpreterDatabase;
  private func: Partial<Function>;

  constructor (declarationNode: ElementDeclarationNode, env: InterpreterDatabase) {
    this.declarationNode = declarationNode;
    this.env = env;
    this.func = {
      schemaName: 'public',
      returns: 'void',
      args: [],
      body: '',
      language: 'plpgsql',
      behavior: 'volatile',
      security: 'invoker',
    };
  }

  interpret (): CompileError[] {
    this.func.token = getTokenPosition(this.declarationNode);
    this.env.functions.set(this.declarationNode, this.func as Function);

    const errors = [
      ...this.interpretName(this.declarationNode.name!),
      ...this.interpretBody(this.declarationNode.body as BlockExpressionNode),
    ];

    return errors;
  }

  private interpretName (nameNode: any): CompileError[] {
    if (!nameNode) return [];
    const { name, schemaName } = extractElementName(nameNode);
    this.func.name = name;
    if (schemaName.length > 0) {
      this.func.schemaName = schemaName[0];
    }
    return [];
  }

  private interpretBody (body: BlockExpressionNode): CompileError[] {
    return body.body.flatMap((_sub) => {
      const sub = _sub as FunctionApplicationNode;
      const fieldName = extractVariableFromExpression(sub.callee).unwrap_or('');

      switch (fieldName.toLowerCase()) {
        case 'schema': {
          this.func.schemaName = extractVariableFromExpression(sub.args[0]).unwrap_or('public');
          return [];
        }
        case 'returns': {
          this.func.returns = extractVariableFromExpression(sub.args[0]).unwrap_or('void');
          return [];
        }
        case 'args': {
          const arg = sub.args[0];
          if (arg instanceof ListExpressionNode) {
            this.func.args = arg.elementList.map((attr): FunctionArg => {
              const argName = attr.name instanceof IdentiferStreamNode
                ? extractStringFromIdentifierStream(attr.name).unwrap_or('')
                : '';
              const argType = extractVariableFromExpression(attr.value as any).unwrap_or('');
              return { name: argName, type: argType };
            }).filter((a) => a.name && a.type);
          }
          return [];
        }
        case 'body': {
          const arg = sub.args[0];
          if (arg instanceof FunctionExpressionNode && arg.value) {
            this.func.body = arg.value.value;
          } else {
            this.func.body = extractVariableFromExpression(arg).unwrap_or('');
          }
          return [];
        }
        case 'language': {
          this.func.language = extractVariableFromExpression(sub.args[0]).unwrap_or('plpgsql');
          return [];
        }
        case 'behavior': {
          this.func.behavior = extractVariableFromExpression(sub.args[0]).unwrap_or('volatile');
          return [];
        }
        case 'security': {
          this.func.security = extractVariableFromExpression(sub.args[0]).unwrap_or('invoker');
          return [];
        }
        default:
          return [];
      }
    });
  }
}
