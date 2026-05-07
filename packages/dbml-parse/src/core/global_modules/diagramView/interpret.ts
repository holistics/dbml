import {
  partition,
} from 'lodash-es';
import {
  DEFAULT_SCHEMA_NAME,
} from '@/constants';
import {
  destructureComplexVariable, extractReferee,
} from '@/core/utils/expression';
import {
  DiagramView, InterpreterDatabase,
} from '@/core/global_modules/types';
import {
  getTokenPosition,
} from '@/core/global_modules/utils';
import {
  isWildcardExpression,
} from '@/core/utils/validate';
import {
  CompileError,
} from '@/core/types/errors';
import {
  BlockExpressionNode, ElementDeclarationNode, FunctionApplicationNode, SyntaxNode,
} from '@/core/types/nodes';

export class DiagramViewInterpreter {
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

    this.env.diagramViews.set(this.declarationNode, this.diagramView as DiagramView);
    this.env.diagramViewWildcards.set(this.diagramView as DiagramView, new Set());
    this.env.diagramViewExplicitlySet.set(this.diagramView as DiagramView, new Set());

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
    const fragments = destructureComplexVariable(nameNode) ?? [];
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
        this.diagramView.visibleEntities = {
          tables: [],
          stickyNotes: [],
          tableGroups: [],
          schemas: [],
        };
        this.env.diagramViewWildcards.set(this.diagramView as DiagramView, new Set([
          'tables',
          'stickyNotes',
          'tableGroups',
          'schemas',
        ]));
        this.env.diagramViewExplicitlySet.set(this.diagramView as DiagramView, new Set([
          'tables',
          'stickyNotes',
          'tableGroups',
          'schemas',
        ]));
        return [];
      }
    }

    const [
      subs,
    ] = partition(body.body, (e) => e instanceof ElementDeclarationNode);
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
      (explicitlySet.has('tables') && ve.tables !== null)
      || (explicitlySet.has('tablegroups') && ve.tableGroups !== null)
      || (explicitlySet.has('schemas') && ve.schemas !== null);

    if (trinityHasNonNull) {
      if (!explicitlySet.has('tables')) ve.tables = [];
      if (!explicitlySet.has('tablegroups')) ve.tableGroups = [];
      if (!explicitlySet.has('schemas')) ve.schemas = [];
    }

    // Store which dims were explicitly declared (normalize block type names to FilterConfig keys)
    const envExplicitlySet = this.env.diagramViewExplicitlySet.get(this.diagramView as DiagramView)!;
    if (explicitlySet.has('tables')) envExplicitlySet.add('tables');
    if (explicitlySet.has('tablegroups')) envExplicitlySet.add('tableGroups');
    if (explicitlySet.has('schemas')) envExplicitlySet.add('schemas');
    if (explicitlySet.has('notes')) envExplicitlySet.add('stickyNotes');

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
      const envWildcards = this.env.diagramViewWildcards.get(this.diagramView as DiagramView)!;
      switch (blockType) {
        case 'tables':
          this.diagramView.visibleEntities!.tables = [];
          envWildcards.add('tables');
          break;
        case 'notes':
          this.diagramView.visibleEntities!.stickyNotes = [];
          envWildcards.add('stickyNotes');
          break;
        case 'tablegroups':
          this.diagramView.visibleEntities!.tableGroups = [];
          envWildcards.add('tableGroups');
          break;
        case 'schemas':
          this.diagramView.visibleEntities!.schemas = [];
          envWildcards.add('schemas');
          break;
      }
      return;
    }

    // Empty block = hide all (null is already default)
    if (body.body.length === 0) {
      return;
    }

    // Specific items
    const items: Array<{ name: string;
      schemaName: string; }> = [];
    for (const field of body.body) {
      if (!(field instanceof FunctionApplicationNode)) continue;

      // If the field was bound to a symbol (e.g., alias "U" → Table "users"),
      // resolve the real name from the referee's declaration
      const referee = extractReferee(field.callee);
      if (referee?.declaration instanceof ElementDeclarationNode) {
        const realFragments = destructureComplexVariable(referee.declaration.name) ?? [];
        if (realFragments.length > 0) {
          const name = realFragments[realFragments.length - 1];
          const schemaName = realFragments.length > 1 ? realFragments.slice(0, -1).join('.') : DEFAULT_SCHEMA_NAME;
          items.push({
            name,
            schemaName,
          });
          continue;
        }
      }

      // Fallback: use the literal text (for unbound references or non-table blocks)
      const fragments = destructureComplexVariable(field.callee) ?? [];
      if (fragments.length === 0) continue;

      const name = fragments[fragments.length - 1];
      const schemaName = fragments.length > 1 ? fragments[0] : DEFAULT_SCHEMA_NAME;

      items.push({
        name,
        schemaName,
      });
    }

    switch (blockType) {
      case 'tables':
        this.diagramView.visibleEntities!.tables = items.length > 0 ? items : null;
        break;
      case 'notes':
        this.diagramView.visibleEntities!.stickyNotes = items.length > 0
          ? items.map((i) => ({
              name: i.name,
            }))
          : null;
        break;
      case 'tablegroups':
        this.diagramView.visibleEntities!.tableGroups = items.length > 0
          ? items.map((i) => ({
              name: i.name,
            }))
          : null;
        break;
      case 'schemas':
        this.diagramView.visibleEntities!.schemas = items.length > 0
          ? items.map((i) => ({
              name: i.name,
            }))
          : null;
        break;
    }
  }
}
