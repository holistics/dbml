import { destructureComplexVariable } from "../../analyzer/utils";
import { CompileError, CompileErrorCode } from "../../errors";
import { BlockExpressionNode, ElementDeclarationNode } from "../../parser/nodes";
import { ElementInterpreter, InterpreterDatabase, TableGroup } from "../types";
import { extractElementName, getTokenPosition } from "../utils";

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

    const { name, schemaName } = extractElementName(this.declarationNode.name!);
    if (schemaName.length >= 2) {
      this.tableGroup.name = name;
      this.tableGroup.schemaName = schemaName.join('.');
      errors.push(new CompileError(CompileErrorCode.UNSUPPORTED, 'Nested schema is not supported', this.declarationNode.name!));
    }
    this.tableGroup.name = name;
    this.tableGroup.schemaName = schemaName[0] || null;
    
    this.tableGroup.tables = (this.declarationNode.body as BlockExpressionNode).body.map((field) => {
      const fragments = destructureComplexVariable(field).unwrap();

      if (fragments.length > 2) {
        errors.push(new CompileError(CompileErrorCode.UNSUPPORTED, 'Nested schema is not supported', field));
      }

      return {
        name: fragments.pop()!,
        schemaName: fragments.join('.'),
      };
    });

    this.env.tableGroups.set(this.declarationNode, this.tableGroup as TableGroup);

    return errors;
  }
}