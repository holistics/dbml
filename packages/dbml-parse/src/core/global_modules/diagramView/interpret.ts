import {
  partition, uniqBy,
} from 'lodash-es';
import {
  DEFAULT_SCHEMA_NAME,
} from '@/constants';
import Compiler from '@/compiler';
import type {
  Filepath,
} from '@/core/types/filepath';
import {
  BlockExpressionNode,
  ElementDeclarationNode,
  FunctionApplicationNode,
} from '@/core/types/nodes';
import {
  CompileError,
  DiagramView,
} from '@/core/types';
import {
  UNHANDLED,
} from '@/core/types/module';
import Report from '@/core/types/report';
import {
  DiagramViewSymbol, SymbolKind,
} from '@/core/types/symbol';
import {
  destructureComplexVariable, isWildcardExpression,
} from '@/core/utils';
import {
  extractReferee,
} from '@/services/utils';

export class DiagramViewInterpreter {
  private compiler: Compiler;
  private declarationNode: ElementDeclarationNode;
  private symbol: DiagramViewSymbol;
  private filepath: Filepath;
  private diagramView: Partial<DiagramView>;
  private diagramViewWildcards: Set<
    'tables'
    | 'stickyNotes'
    | 'tableGroups'
    | 'schemas'
  > = new Set();

  private diagramViewExplicitlySet: Set<
    'tables'
    | 'stickyNotes'
    | 'tableGroups'
    | 'schemas'
  > = new Set();

  constructor (compiler: Compiler, declarationNode: ElementDeclarationNode, symbol: DiagramViewSymbol, filepath?: Filepath) {
    this.compiler = compiler;
    this.declarationNode = declarationNode;
    this.symbol = symbol;
    this.filepath = filepath ?? declarationNode.filepath;
    this.diagramView = {
      visibleEntities: {
        tables: null,
        stickyNotes: null,
        tableGroups: null,
        schemas: null,
      },
    };
  }

  interpret (): Report<DiagramView> {
    const errors: CompileError[] = [];
    this.diagramView.token = this.symbol.token!;

    const {
      name: resolvedName, schema: resolvedSchema,
    } = this.symbol.resolvedName(this.compiler, this.filepath);
    this.diagramView.name = resolvedName;
    this.diagramView.schemaName = resolvedSchema;

    if (this.declarationNode.body instanceof BlockExpressionNode) {
      errors.push(...this.interpretBody(this.declarationNode.body));
    }

    this.expandDiagramViewWildcards();

    return new Report(this.diagramView as DiagramView, errors);
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
        this.diagramViewWildcards = new Set([
          'tables',
          'stickyNotes',
          'tableGroups',
          'schemas',
        ]);
        this.diagramViewExplicitlySet = new Set([
          'tables',
          'stickyNotes',
          'tableGroups',
          'schemas',
        ]);
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

    // Normalize block type names to FilterConfig keys
    if (explicitlySet.has('tables')) this.diagramViewExplicitlySet.add('tables');
    if (explicitlySet.has('tablegroups')) this.diagramViewExplicitlySet.add('tableGroups');
    if (explicitlySet.has('schemas')) this.diagramViewExplicitlySet.add('schemas');
    if (explicitlySet.has('notes')) this.diagramViewExplicitlySet.add('stickyNotes');

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
      const envWildcards = this.diagramViewWildcards;
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
      const referee = extractReferee(this.compiler, field.callee);
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

  /**
   * Expand explicit wildcard ([]) for tableGroups in DiagramView visibleEntities
   * to the concrete list of table group names.
   *
   * Expands when:
   * 1. The user wrote `TableGroups { * }` (tracked via diagramViewWildcards)
   * 2. NOT a body-level `{ * }` — body-level wildcard sets ALL dims to [] simultaneously,
   *    which is a different semantic (show everything) that doesn't need expansion.
   *    We detect body-level by checking if all four dims are in the wildcards set.
   *
   * Why only TableGroups needs expansion:
   * - Tables: * → [] means "show all tables" (every table is a table, no indirection)
   * - Schemas: * → [] means "show all schemas" (every table belongs to a schema)
   * - TableGroups: * needs concrete names because some tables DON'T belong to any group.
   *   The frontend does name-based lookup; [] would produce an empty name map → no groups matched.
   */
  expandDiagramViewWildcards (): void {
    const ve = this.diagramView.visibleEntities;
    const wildcards = this.diagramViewWildcards;
    if (!wildcards || !ve) return;

    // Tables * or Schemas * → union covers everything → all Trinity dims become [] (show all)
    if (wildcards.has('tables') || wildcards.has('schemas')) {
      ve.tables = [];
      ve.tableGroups = [];
      ve.schemas = [];
      return;
    }

    // TableGroups * -> expand to concrete group names (not all tables belong to groups)
    if (wildcards.has('tableGroups') && ve.tableGroups && ve.tableGroups.length === 0) {
      ve.tableGroups = this.getAllTableGroupNames();
    }
  }

  private getAllTableGroupNames (): Array<{ name: string }> {
    const ast = this.compiler.parseFile(this.declarationNode.filepath).getValue().ast;
    const programSymbol = this.compiler.nodeSymbol(ast).getFiltered(UNHANDLED);
    if (!programSymbol) return [];

    const members = this.compiler.symbolMembers(programSymbol).getFiltered(UNHANDLED);
    if (!members) return [];

    return uniqBy(
      members.filter((m) => m.isKind(SymbolKind.TableGroup)),
      (m) => m.originalSymbol.intern(),
    )
      .flatMap((m) => m.name !== undefined
        ? ({
            name: m.name,
          })
        : []);
  }
}
