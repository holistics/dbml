import { ElementInterpreter, InterpreterDatabase, DiagramView } from '@/core/interpreter/types';
import {
  BlockExpressionNode, ElementDeclarationNode, FunctionApplicationNode, SyntaxNode,
  ListExpressionNode, VariableNode, PrimaryExpressionNode, AttributeNode, IdentiferStreamNode,
  InfixExpressionNode,
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
    // No body at all - all categories null (show everything)
    if (!body) {
      return [];
    }

    const errors: CompileError[] = [];

    // Handle block syntax: DiagramView name { ... }
    if (body instanceof BlockExpressionNode) {
      // Empty block body - all categories [] (show nothing)
      if (!body.body || body.body.length === 0) {
        this.diagramView.visibleEntities!.tables = [];
        this.diagramView.visibleEntities!.schemas = [];
        this.diagramView.visibleEntities!.tableGroups = [];
        this.diagramView.visibleEntities!.stickyNotes = [];
        return [];
      }

      const bodyElements = body.body || [];

      // Initialize all categories to [] (show nothing) before processing.
      // Only the `all` keyword will set a category to null (show all).
      // This ensures unspecified categories default to "show nothing".
      this.diagramView.visibleEntities!.tables = [];
      this.diagramView.visibleEntities!.schemas = [];
      this.diagramView.visibleEntities!.tableGroups = [];
      this.diagramView.visibleEntities!.stickyNotes = [];

      // Group body elements by type
      for (const element of bodyElements) {
        if (element instanceof ElementDeclarationNode) {
          const type = element.type?.value.toLowerCase();

          // Check if this element uses colon syntax (FunctionApplicationNode body)
          // e.g., Tables: [users, posts] or Tables: all
          if (element.body && element.body instanceof FunctionApplicationNode) {
            errors.push(...this.interpretColonSyntaxElement(element));
            continue;
          }

          // Otherwise it's brace syntax: Tables { users \n posts }
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
        } else if (element instanceof FunctionApplicationNode) {
          // Could be colon syntax like "Tables: [users, orders]" at top level of block
          errors.push(...this.interpretColonSyntaxTopLevel(element));
        }
      }
    } else if (body instanceof FunctionApplicationNode) {
      // Handle top-level colon syntax: DiagramView name: [users, orders] or DiagramView name: all
      errors.push(...this.interpretColonSyntax(body));
    }

    return errors;
  }

  /**
   * Interpret colon syntax at the top level of DiagramView body
   * e.g., DiagramView name: [users, orders] or DiagramView name: all
   */
  private interpretColonSyntax(body: FunctionApplicationNode): CompileError[] {
    const errors: CompileError[] = [];

    // The body structure depends on what follows the colon:
    // 1. DiagramView name: all -> body is FunctionApplicationNode with callee = PrimaryExpressionNode(VariableNode 'all'), args = []
    // 2. DiagramView name: [users, orders] -> body is FunctionApplicationNode with callee = ListExpressionNode, args = []

    const callee = body.callee;

    if (!callee) {
      return errors;
    }

    // Case 1: "all" keyword - DiagramView name: all
    // callee is PrimaryExpressionNode containing VariableNode with value 'all'
    if (callee instanceof PrimaryExpressionNode && callee.expression instanceof VariableNode) {
      const varValue = callee.expression.variable?.value;
      if (varValue && varValue.toLowerCase() === 'all') {
        // DiagramView name: all - set all categories to null (show everything)
        this.diagramView.visibleEntities!.tables = null;
        this.diagramView.visibleEntities!.schemas = null;
        this.diagramView.visibleEntities!.tableGroups = null;
        this.diagramView.visibleEntities!.stickyNotes = null;
        return errors;
      }
    }

    // Case 2: List expression - DiagramView name: [users, orders]
    // callee is ListExpressionNode
    if (callee instanceof ListExpressionNode) {
      // The entire list is the value for the default category (tables)
      // DiagramView name: [users, orders] means tables: [users, orders]
      this.interpretCategoryList('tables', callee);
      return errors;
    }

    // Case 3: Variable expression - could be category: value or just 'all'
    // callee is VariableNode or PrimaryExpressionNode(VariableNode)
    if (callee instanceof VariableNode) {
      const categoryName = callee.variable?.value.toLowerCase();
      if (categoryName) {
        // No args means show all for this category
        if (body.args.length === 0) {
          this.setCategoryToAll(categoryName);
        } else {
          // Has args - parse them
          const valueNode = body.args[0];
          this.interpretValueForCategory(categoryName, valueNode);
        }
      }
    } else if (callee instanceof PrimaryExpressionNode && callee.expression instanceof VariableNode) {
      const categoryName = callee.expression.variable?.value.toLowerCase();
      if (categoryName) {
        // No args means show all for this category
        if (body.args.length === 0) {
          this.setCategoryToAll(categoryName);
        } else {
          // Has args - parse them
          const valueNode = body.args[0];
          this.interpretValueForCategory(categoryName, valueNode);
        }
      }
    }

    return errors;
  }

  /**
   * Interpret the value for a specific category
   */
  private interpretValueForCategory(categoryName: string, valueNode: SyntaxNode | undefined): void {
    if (!valueNode) {
      this.setCategoryToAll(categoryName);
      return;
    }

    // Check if it's 'all' keyword
    if (valueNode instanceof PrimaryExpressionNode && valueNode.expression instanceof VariableNode) {
      const value = valueNode.expression.variable?.value;
      if (value?.toLowerCase() === 'all') {
        this.setCategoryToAll(categoryName);
        return;
      }
    }

    // Check if it's a list expression: [users, orders]
    if (valueNode instanceof ListExpressionNode) {
      this.interpretCategoryList(categoryName, valueNode);
      return;
    }

    // Check if it's a single variable: users (not in list)
    if (valueNode instanceof PrimaryExpressionNode && valueNode.expression instanceof VariableNode) {
      const value = valueNode.expression.variable?.value;
      if (value) {
        // Single item - treat as list with one item
        this.interpretSingleItem(categoryName, value);
        return;
      }
    }

    // Check if it's a VariableNode directly
    if (valueNode instanceof VariableNode) {
      const value = valueNode.variable?.value;
      if (value) {
        this.interpretSingleItem(categoryName, value);
        return;
      }
    }

    // Default: show all for this category
    this.setCategoryToAll(categoryName);
  }

  /**
   * Handle colon syntax within block body where the element type is the category name
   * e.g., DiagramView name { Tables: [users, orders] } or { Tables: all }
   */
  private interpretColonSyntaxElement(element: ElementDeclarationNode): CompileError[] {
    const errors: CompileError[] = [];
    const categoryName = element.type?.value.toLowerCase();

    if (!categoryName) return errors;

    const body = element.body as FunctionApplicationNode;
    const callee = body.callee;

    if (!callee) {
      // No value after colon — treat as empty: Tables: -> tables = []
      this.setCategoryToEmpty(categoryName);
      return errors;
    }

    // Check for 'all' keyword: Tables: all
    if (callee instanceof PrimaryExpressionNode && callee.expression instanceof VariableNode) {
      const varValue = callee.expression.variable?.value;
      if (varValue && varValue.toLowerCase() === 'all') {
        this.setCategoryToAll(categoryName);
        return errors;
      }
    }

    // Check for list expression: Tables: [users, orders]
    if (callee instanceof ListExpressionNode) {
      this.interpretCategoryList(categoryName, callee);
      return errors;
    }

    return errors;
  }

  /**
   * Handle colon syntax at top level of block body (FunctionApplicationNode directly in block)
   */
  private interpretColonSyntaxTopLevel(element: FunctionApplicationNode): CompileError[] {
    // This could be like "Tables: [users, orders]" directly in the block
    return this.interpretColonSyntax(element);
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

  /**
   * Interpret a list expression for a category
   */
  private interpretCategoryList(categoryName: string, listNode: ListExpressionNode): void {
    const items = this.extractListItems(listNode);

    switch (categoryName) {
      case 'tables':
        this.diagramView.visibleEntities!.tables = items.map((name) => {
          const parts = name.split('.');
          const tableName = parts.pop()!;
          const schemaName = parts.length > 0 ? parts.join('.') : null;
          return { name: tableName, schemaName };
        });
        break;
      case 'notes':
      case 'sticky_notes':
      case 'note':
        this.diagramView.visibleEntities!.stickyNotes = items.map((name) => ({ name }));
        break;
      case 'tablegroups':
      case 'table_groups':
      case 'tablegroup':
        this.diagramView.visibleEntities!.tableGroups = items.map((name) => ({ name }));
        break;
      case 'schemas':
      case 'schema':
        this.diagramView.visibleEntities!.schemas = items.map((name) => ({ name }));
        break;
      default:
        // Unknown category, ignore
        break;
    }
  }

  /**
   * Interpret a single item (not a list) for a category
   */
  private interpretSingleItem(categoryName: string, name: string): void {
    switch (categoryName) {
      case 'tables':
        this.diagramView.visibleEntities!.tables = [{
          name,
          schemaName: null,
        }];
        break;
      case 'notes':
      case 'sticky_notes':
      case 'note':
        this.diagramView.visibleEntities!.stickyNotes = [{ name }];
        break;
      case 'tablegroups':
      case 'table_groups':
      case 'tablegroup':
        this.diagramView.visibleEntities!.tableGroups = [{ name }];
        break;
      case 'schemas':
      case 'schema':
        this.diagramView.visibleEntities!.schemas = [{ name }];
        break;
      default:
        // Unknown category, ignore
        break;
    }
  }

  /**
   * Extract items from a ListExpressionNode
   */
  private extractListItems(listNode: ListExpressionNode): string[] {
    const items: string[] = [];

    for (const element of listNode.elementList) {
      // Check if it's an AttributeNode (which wraps items in list expressions)
      if (element instanceof AttributeNode && element.name) {
        if (element.name instanceof IdentiferStreamNode) {
          // Simple identifier like 'users' - join all identifiers with '.'
          const identifiers = element.name.identifiers;
          const name = identifiers.map(id => id.value).join('.');
          items.push(name);
        } else if (element.name instanceof PrimaryExpressionNode) {
          // Could be a PrimaryExpressionNode
          const expr = element.name.expression;
          if (expr instanceof VariableNode && expr.variable) {
            items.push(expr.variable.value);
          }
        } else if (element.name instanceof InfixExpressionNode) {
          // Handle dotted expression like public.users
          const name = this.extractNameFromInfixExpression(element.name);
          if (name) items.push(name);
        }
      }
      // Check if it's a PrimaryExpressionNode containing a VariableNode
      else if (element instanceof PrimaryExpressionNode) {
        const expr = (element as PrimaryExpressionNode).expression;
        if (expr instanceof VariableNode && expr.variable) {
          items.push(expr.variable.value);
        }
      } else if (element instanceof InfixExpressionNode) {
        // Handle dotted expression at top level
        const name = this.extractNameFromInfixExpression(element);
        if (name) items.push(name);
      }
    }

    return items;
  }

  /**
   * Extract name from an InfixExpressionNode (e.g., public.users)
   */
  private extractNameFromInfixExpression(node: InfixExpressionNode): string | null {
    // Handle dotted expression: leftExpression.rightExpression
    // e.g., public.users -> left = public, right = users
    const parts: string[] = [];

    let current: SyntaxNode | undefined = node;
    while (current instanceof InfixExpressionNode && current.op?.value === '.') {
      // Get right side first (table name)
      if (current.rightExpression instanceof PrimaryExpressionNode) {
        const varNode = current.rightExpression.expression;
        if (varNode instanceof VariableNode && varNode.variable) {
          parts.unshift(varNode.variable.value);
        }
      }
      // Move to left side
      current = current.leftExpression;
    }

    // Handle the leftmost identifier
    if (current instanceof PrimaryExpressionNode) {
      const varNode = current.expression;
      if (varNode instanceof VariableNode && varNode.variable) {
        parts.unshift(varNode.variable.value);
      }
    }

    return parts.length > 0 ? parts.join('.') : null;
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
