import { partition } from 'lodash-es';
import { destructureComplexVariable } from '@/core/analyzer/utils';
import { CompileError } from '@/core/errors';
import { BlockExpressionNode, ElementDeclarationNode, FunctionApplicationNode, PrimaryExpressionNode, SyntaxNode, VariableNode } from '@/core/parser/nodes';
import { ElementInterpreter, InterpreterDatabase, DiagramView, FilterConfig } from '@/core/interpreter/types';
import { getTokenPosition } from '@/core/interpreter/utils';
import { DEFAULT_SCHEMA_NAME } from '@/constants';

/**
 * Check if a node is a wildcard expression (*)
 */
function isWildcardExpression (node: SyntaxNode | undefined): boolean {
  if (!node) return false;
  if (node instanceof PrimaryExpressionNode && node.expression instanceof VariableNode) {
    return node.expression.variable?.value === '*';
  }
  return false;
}

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

    // Initialize diagramViews map if not exists
    if (!this.env.diagramViews) {
      this.env.diagramViews = new Map();
    }
    this.env.diagramViews.set(this.declarationNode, this.diagramView as DiagramView);

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
    const fragments = destructureComplexVariable(nameNode).unwrap_or([]);
    if (fragments.length > 0) {
      this.diagramView.name = fragments[fragments.length - 1];
      if (fragments.length > 1) {
        this.diagramView.schemaName = fragments.slice(0, -1).join('.');
      }
    }
    return [];
  }

  private interpretBody (body: BlockExpressionNode): CompileError[] {
    // Body-level {*} shorthand: show all entities including Notes
    if (body.body.length === 1) {
      const first = body.body[0];
      if (first instanceof FunctionApplicationNode && isWildcardExpression(first.callee)) {
        this.diagramView.visibleEntities = { tables: [], stickyNotes: [], tableGroups: [], schemas: [] };
        return [];
      }
    }

    const [, subs] = partition(body.body, (e) => e instanceof FunctionApplicationNode);
    const explicitlySet = new Set<string>();

    for (const sub of subs as ElementDeclarationNode[]) {
      const blockType = sub.type?.value.toLowerCase();
      if (blockType) explicitlySet.add(blockType);
      if (sub.body instanceof BlockExpressionNode) {
        this.interpretSubBlock(sub.body, blockType);
      }
    }

    // Trinity omit rule: if any Trinity dim was explicitly set with a non-null value,
    // promote omitted Trinity dims from null → [] (show all)
    const ve = this.diagramView.visibleEntities!;
    const trinityHasNonNull =
      (explicitlySet.has('tables') && ve.tables !== null) ||
      (explicitlySet.has('tablegroups') && ve.tableGroups !== null) ||
      (explicitlySet.has('schemas') && ve.schemas !== null);

    if (trinityHasNonNull) {
      if (!explicitlySet.has('tables')) ve.tables = [];
      if (!explicitlySet.has('tablegroups')) ve.tableGroups = [];
      if (!explicitlySet.has('schemas')) ve.schemas = [];
    }

    return [];
  }

  private interpretSubBlock (body: BlockExpressionNode, blockType: string | undefined): void {
    if (!blockType) return;

    // Check for wildcard
    const hasWildcard = body.body.some(
      (e) => e instanceof FunctionApplicationNode && isWildcardExpression(e.callee),
    );

    if (hasWildcard) {
      // Show all for this entity type
      switch (blockType) {
        case 'tables':
          this.diagramView.visibleEntities!.tables = [];
          break;
        case 'notes':
          this.diagramView.visibleEntities!.stickyNotes = [];
          break;
        case 'tablegroups':
          this.diagramView.visibleEntities!.tableGroups = [];
          break;
        case 'schemas':
          this.diagramView.visibleEntities!.schemas = [];
          break;
      }
      return;
    }

    // Empty block = hide all (null is already default)
    if (body.body.length === 0) {
      return;
    }

    // Specific items
    const items: Array<{ name: string; schemaName: string }> = [];
    for (const field of body.body) {
      if (!(field instanceof FunctionApplicationNode)) continue;

      const fragments = destructureComplexVariable(field.callee).unwrap_or([]);
      if (fragments.length === 0) continue;

      const name = fragments[fragments.length - 1];
      const schemaName = fragments.length > 1 ? fragments[0] : DEFAULT_SCHEMA_NAME;

      items.push({ name, schemaName });
    }

    switch (blockType) {
      case 'tables':
        this.diagramView.visibleEntities!.tables = items.length > 0 ? items : null;
        break;
      case 'notes':
        this.diagramView.visibleEntities!.stickyNotes = items.length > 0 ? items.map((i) => ({ name: i.name })) : null;
        break;
      case 'tablegroups':
        this.diagramView.visibleEntities!.tableGroups = items.length > 0 ? items.map((i) => ({ name: i.name })) : null;
        break;
      case 'schemas':
        this.diagramView.visibleEntities!.schemas = items.length > 0 ? items.map((i) => ({ name: i.name })) : null;
        break;
    }
  }
}
