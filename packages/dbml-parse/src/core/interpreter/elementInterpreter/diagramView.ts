import { ElementInterpreter, InterpreterDatabase, DiagramView } from '@/core/interpreter/types';
import {
  BlockExpressionNode, ElementDeclarationNode, FunctionApplicationNode, SyntaxNode,
  VariableNode, PrimaryExpressionNode,
} from '@/core/parser/nodes';
import {
  extractElementName, getTokenPosition,
} from '@/core/interpreter/utils';
import { CompileError } from '@/core/errors';
import { destructureComplexVariable } from '@/core/analyzer/utils';

export class DiagramViewInterpreter implements ElementInterpreter {
  private declarationNode: ElementDeclarationNode;
  private env: InterpreterDatabase;
  private diagramView: Partial<DiagramView>;

  constructor(declarationNode: ElementDeclarationNode, env: InterpreterDatabase) {
    this.declarationNode = declarationNode;
    this.env = env;
    this.diagramView = {
      name: undefined,
      token: undefined,
      visibleEntities: {
        tables: null,
        schemas: null,
        tableGroups: null,
        stickyNotes: null,
      },
    };
  }

  interpret(): CompileError[] {
    const errors: CompileError[] = [];
    this.diagramView.token = getTokenPosition(this.declarationNode);
    this.env.diagramViews.set(this.declarationNode, this.diagramView as DiagramView);

    errors.push(
      ...this.interpretName(this.declarationNode.name!),
      ...this.interpretBody(this.declarationNode.body),
    );

    return errors;
  }

  private interpretName(nameNode: SyntaxNode): CompileError[] {
    const { name } = extractElementName(nameNode);
    this.diagramView.name = name;
    return [];
  }

  private interpretBody(body: BlockExpressionNode | FunctionApplicationNode | undefined): CompileError[] {
    // No body — all categories [] (show nothing)
    if (!body) {
      this.diagramView.visibleEntities!.tables = [];
      this.diagramView.visibleEntities!.schemas = [];
      this.diagramView.visibleEntities!.tableGroups = [];
      this.diagramView.visibleEntities!.stickyNotes = [];
      return [];
    }

    // Only BlockExpressionNode is valid now (no top-level colon syntax)
    if (!(body instanceof BlockExpressionNode)) {
      return [];
    }

    // Empty block — all categories [] (show nothing)
    if (!body.body || body.body.length === 0) {
      this.diagramView.visibleEntities!.tables = [];
      this.diagramView.visibleEntities!.schemas = [];
      this.diagramView.visibleEntities!.tableGroups = [];
      this.diagramView.visibleEntities!.stickyNotes = [];
      return [];
    }

    // Check for top-level * — show all for every category
    const hasGlobalStar = body.body.some((element) => {
      if (element instanceof FunctionApplicationNode) {
        const callee = element.callee;
        if (callee instanceof PrimaryExpressionNode && callee.expression instanceof VariableNode) {
          return callee.expression.variable?.value === '*';
        }
        if (callee instanceof VariableNode) {
          return callee.variable?.value === '*';
        }
      }
      return false;
    });

    if (hasGlobalStar) {
      this.diagramView.visibleEntities!.tables = null;
      this.diagramView.visibleEntities!.schemas = null;
      this.diagramView.visibleEntities!.tableGroups = null;
      this.diagramView.visibleEntities!.stickyNotes = null;
      return [];
    }

    // Initialize all categories to [] (show nothing)
    this.diagramView.visibleEntities!.tables = [];
    this.diagramView.visibleEntities!.schemas = [];
    this.diagramView.visibleEntities!.tableGroups = [];
    this.diagramView.visibleEntities!.stickyNotes = [];

    const errors: CompileError[] = [];

    for (const element of body.body) {
      if (!(element instanceof ElementDeclarationNode)) continue;

      const type = element.type?.value.toLowerCase();

      // Check for {*} syntax: Tables: {*}
      // Parsed as ElementDeclarationNode with body = FunctionApplicationNode
      // whose callee is a BlockExpressionNode containing a * variable
      if (element.body instanceof FunctionApplicationNode) {
        const callee = element.body.callee;
        if (callee instanceof BlockExpressionNode) {
          const isStarBlock = callee.body?.length === 1 && (() => {
            const first = callee.body![0];
            if (first instanceof FunctionApplicationNode) {
              const innerCallee = first.callee;
              if (innerCallee instanceof PrimaryExpressionNode && innerCallee.expression instanceof VariableNode) {
                return innerCallee.expression.variable?.value === '*';
              }
              if (innerCallee instanceof VariableNode) {
                return innerCallee.variable?.value === '*';
              }
            }
            return false;
          })();

          if (isStarBlock && type) {
            this.setCategoryToAll(type);
            continue;
          }
        }
      }

      // Block syntax: Tables { users \n posts }
      const subBody = element.body as BlockExpressionNode | undefined;

      switch (type) {
        case 'tables':
          errors.push(...this.interpretTableList(subBody));
          break;
        case 'notes':
        case 'sticky_notes':
          errors.push(...this.interpretNoteList(subBody));
          break;
        case 'tablegroups':
        case 'table_groups':
          errors.push(...this.interpretTableGroupList(subBody));
          break;
        case 'schemas':
          errors.push(...this.interpretSchemaList(subBody));
          break;
        default:
          break;
      }
    }

    return errors;
  }

  /**
   * Set a category to null (show all)
   */
  private setCategoryToAll(categoryName: string): void {
    switch (categoryName) {
      case 'tables':
        this.diagramView.visibleEntities!.tables = null;
        break;
      case 'notes':
      case 'sticky_notes':
      case 'note':
        this.diagramView.visibleEntities!.stickyNotes = null;
        break;
      case 'tablegroups':
      case 'table_groups':
      case 'tablegroup':
        this.diagramView.visibleEntities!.tableGroups = null;
        break;
      case 'schemas':
      case 'schema':
        this.diagramView.visibleEntities!.schemas = null;
        break;
      default:
        break;
    }
  }

  /**
   * Set a category to empty array (show none)
   */
  private setCategoryToEmpty(categoryName: string): void {
    switch (categoryName) {
      case 'tables':
        this.diagramView.visibleEntities!.tables = [];
        break;
      case 'notes':
      case 'sticky_notes':
      case 'note':
        this.diagramView.visibleEntities!.stickyNotes = [];
        break;
      case 'tablegroups':
      case 'table_groups':
      case 'tablegroup':
        this.diagramView.visibleEntities!.tableGroups = [];
        break;
      case 'schemas':
      case 'schema':
        this.diagramView.visibleEntities!.schemas = [];
        break;
      default:
        break;
    }
  }

  private interpretTableList(body: BlockExpressionNode | undefined): CompileError[] {
    if (!body || !body.body || body.body.length === 0) {
      this.diagramView.visibleEntities!.tables = [];
      return [];
    }

    const errors: CompileError[] = [];
    this.diagramView.visibleEntities!.tables = body.body
      .filter((e): e is FunctionApplicationNode => e instanceof FunctionApplicationNode)
      .map((field) => {
        const fragments = destructureComplexVariable(field.callee).unwrap();
        const tableName = fragments.pop()!;
        const schemaName = fragments.length > 0 ? fragments.join('.') : null;
        return { name: tableName, schemaName };
      });

    return errors;
  }

  private interpretNoteList(body: BlockExpressionNode | undefined): CompileError[] {
    if (!body || !body.body || body.body.length === 0) {
      this.diagramView.visibleEntities!.stickyNotes = [];
      return [];
    }

    this.diagramView.visibleEntities!.stickyNotes = body.body
      .filter((e): e is FunctionApplicationNode => e instanceof FunctionApplicationNode)
      .map((field) => {
        const fragments = destructureComplexVariable(field.callee).unwrap();
        return { name: fragments.join('.') };
      });

    return [];
  }

  private interpretTableGroupList(body: BlockExpressionNode | undefined): CompileError[] {
    if (!body || !body.body || body.body.length === 0) {
      this.diagramView.visibleEntities!.tableGroups = [];
      return [];
    }

    this.diagramView.visibleEntities!.tableGroups = body.body
      .filter((e): e is FunctionApplicationNode => e instanceof FunctionApplicationNode)
      .map((field) => {
        const fragments = destructureComplexVariable(field.callee).unwrap();
        return { name: fragments.join('.') };
      });

    return [];
  }

  private interpretSchemaList(body: BlockExpressionNode | undefined): CompileError[] {
    if (!body || !body.body || body.body.length === 0) {
      this.diagramView.visibleEntities!.schemas = [];
      return [];
    }

    this.diagramView.visibleEntities!.schemas = body.body
      .filter((e): e is FunctionApplicationNode => e instanceof FunctionApplicationNode)
      .map((field) => {
        const fragments = destructureComplexVariable(field.callee).unwrap();
        return { name: fragments.join('.') };
      });

    return [];
  }
}
