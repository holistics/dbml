import { partition } from 'lodash-es';
import { destructureComplexVariable } from '@/core/utils/expression';
import { CompileError, CompileErrorCode } from '@/core/types/errors';
import { BlockExpressionNode, ElementDeclarationNode, FunctionApplicationNode, SyntaxNode } from '@/core/types/nodes';
import { isWildcardExpression } from '@/core/parser/utils';
import { ElementInterpreter, InterpreterDatabase, DiagramView } from '@/core/interpreter/types';
import { getTokenPosition } from '@/core/interpreter/utils';
import { DEFAULT_SCHEMA_NAME } from '@/constants';

export class DiagramViewInterpreter implements ElementInterpreter {
  private declarationNode: ElementDeclarationNode;
  private env: InterpreterDatabase;
  private diagramView: Partial<DiagramView>;

  constructor (declarationNode: ElementDeclarationNode, env: InterpreterDatabase) {
    this.declarationNode = declarationNode;
    this.env = env;
    this.diagramView = {
      visibleEntities: {
        tables: null,
        stickyNotes: null,
        tableGroups: null,
        schemas: null,
      },
    };
  }

  interpret (): CompileError[] {
    const errors: CompileError[] = [];
    this.diagramView.token = getTokenPosition(this.declarationNode);

    // Interpret name
    if (this.declarationNode.name) {
      errors.push(...this.interpretName(this.declarationNode.name));
    }

    // Interpret body
    if (this.declarationNode.body instanceof BlockExpressionNode) {
      errors.push(...this.interpretBody(this.declarationNode.body));
    }

    return errors;
  }

  private interpretName (nameNode: SyntaxNode): CompileError[] {
    const fragments = destructureComplexVariable(nameNode);
    if (fragments && fragments.length > 0) {
      this.diagramView.name = fragments[fragments.length - 1];
      if (fragments.length > 1) {
        this.diagramView.schemaName = fragments.slice(0, -1).join('.');
      }
    }
    return [];
  }

  private interpretBody (body: BlockExpressionNode): CompileError[] {
    const [subs] = partition(body.body, (e) => e instanceof ElementDeclarationNode);

    for (const sub of subs as ElementDeclarationNode[]) {
      const blockType = sub.type?.value.toLowerCase();
      if (blockType && sub.body instanceof BlockExpressionNode) {
        this.interpretSubBlock(sub.body, blockType);
      }
    }

    return [];
  }

  private interpretSubBlock (body: BlockExpressionNode, blockType?: string): void {
    const [fields] = partition(body.body, (e) => e instanceof FunctionApplicationNode);

    const entities: Array<{ name: string; schemaName: string }> = [];

    for (const field of fields as FunctionApplicationNode[]) {
      if (!field.callee) continue;

      // Skip wildcard
      if (isWildcardExpression(field.callee)) {
        // Wildcard means show all - leave as null
        continue;
      }

      // Try to extract name from the field
      const name = this.extractNameFromExpression(field.callee);
      if (name) {
        entities.push({ name, schemaName: DEFAULT_SCHEMA_NAME });
      }
    }

    // Update visible entities based on blockType
    const ve = this.diagramView.visibleEntities!;
    switch (blockType) {
      case 'tables':
        ve.tables = entities;
        break;
      case 'notes':
        ve.stickyNotes = entities;
        break;
      case 'tablegroups':
        ve.tableGroups = entities;
        break;
      case 'schemas':
        ve.schemas = entities;
        break;
    }
  }

  private extractNameFromExpression (expr: any): string | null {
    try {
      if (expr && expr.variable && expr.variable.name) {
        return expr.variable.name;
      }
      if (expr && expr.name) {
        return expr.name;
      }
      if (expr && typeof expr.value === 'string') {
        return expr.value;
      }
    } catch (e) {
      // Ignore errors during name extraction
    }
    return null;
  }
}
