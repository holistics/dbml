import _ from 'lodash';
import { destructureComplexVariable, destructureMemberAccessExpression } from '../../analyzer/utils';
import { CompileError, CompileErrorCode } from '../../errors';
import {
 BlockExpressionNode, ElementDeclarationNode, FunctionApplicationNode, SyntaxNode,
} from '../../parser/nodes';
import { ElementInterpreter, InterpreterDatabase, TableGroup } from '../types';
import { extractElementName, getTokenPosition } from '../utils';

export class TableGroupInterpreter implements ElementInterpreter {
  private declarationNode: ElementDeclarationNode;
  private env: InterpreterDatabase;
  private tableGroup: Partial<TableGroup>;

  constructor(declarationNode: ElementDeclarationNode, env: InterpreterDatabase) {
    this.declarationNode = declarationNode;
    this.env = env;
    this.tableGroup = { tables: [] };
  }

  interpret(): CompileError[] {
    const errors: CompileError[] = [];
    this.tableGroup.token = getTokenPosition(this.declarationNode);
    this.env.tableGroups.set(this.declarationNode, this.tableGroup as TableGroup);

    errors.push(
      ...this.interpretName(this.declarationNode.name!),
      ...this.interpretBody(this.declarationNode.body as BlockExpressionNode),
    );

    return errors;
  }

  private interpretName(nameNode: SyntaxNode): CompileError[] {
    const errors: CompileError[] = [];

    const { name, schemaName } = extractElementName(nameNode);
    if (schemaName.length >= 2) {
      this.tableGroup.name = name;
      this.tableGroup.schemaName = schemaName.join('.');
      errors.push(new CompileError(CompileErrorCode.UNSUPPORTED, 'Nested schema is not supported', this.declarationNode.name!));
    }
    this.tableGroup.name = name;
    this.tableGroup.schemaName = schemaName[0] || null;

    return errors;
  }

  private interpretBody(body: BlockExpressionNode): CompileError[] {
    const errors: CompileError[] = [];

    this.tableGroup.tables = (this.declarationNode.body as BlockExpressionNode).body.map((field) => {
      const fragments = destructureComplexVariable((field as FunctionApplicationNode).callee).unwrap();

      if (fragments.length > 2) {
        errors.push(new CompileError(CompileErrorCode.UNSUPPORTED, 'Nested schema is not supported', field));
      }

      const tableid = destructureMemberAccessExpression((field as FunctionApplicationNode).callee!).unwrap().pop()!.referee!.id;
      if (this.env.tableOwnerGroup[tableid]) {
        const tableGroup = this.env.tableOwnerGroup[tableid];
        const { schemaName, name } = this.env.tableGroups.get(tableGroup)!;
        const groupName = schemaName ? `${schemaName}.${name}` : name;
        errors.push(new CompileError(CompileErrorCode.TABLE_REAPPEAR_IN_TABLEGROUP, `Table "${fragments.join('.')}" already appears in group "${groupName}"`, field));
      } else {
        this.env.tableOwnerGroup[tableid] = this.declarationNode;
      }

      return {
        name: fragments.pop()!,
        schemaName: fragments.join('.'),
      };
    });

    return errors;
  }
}
