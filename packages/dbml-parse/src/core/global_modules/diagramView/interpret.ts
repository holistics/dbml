import {
  BlockExpressionNode,
  ElementDeclarationNode,
  FunctionApplicationNode,
  SyntaxNode,
  WildcardNode,
} from '@/core/types/nodes';
import type {
  DiagramView, FilterConfig,
} from '@/core/types/schemaJson';
import { ElementKind } from '@/core/types/keywords';
import {
  extractElementName,
  getTokenPosition,
  lookupInDefaultSchema,
  lookupMember,
  scanNonListNodeForBinding,
} from '../utils';
import {
  destructureComplexVariable, extractVarNameFromPrimaryVariable, isWildcardExpression,
} from '@/core/utils/expression';
import {
  DEFAULT_SCHEMA_NAME, UNHANDLED,
} from '@/constants';
import {
  SchemaSymbol, SymbolKind,
} from '@/core/types/symbol';
import Compiler from '@/compiler';
import Report from '@/core/types/report';
import type { CompileError } from '@/core/types/errors';

export class DiagramViewInterpreter {
  private compiler: Compiler;
  private node: ElementDeclarationNode;

  constructor (compiler: Compiler, node: ElementDeclarationNode) {
    this.compiler = compiler;
    this.node = node;
  }

  interpret (): Report<DiagramView> {
    const errors: CompileError[] = [];
    const token = getTokenPosition(this.node);
    const {
      name, schemaName,
    } = extractElementName(this.node.name!);
    const body = this.node.body as BlockExpressionNode;

    // Body-level wildcard: DiagramView v { * } → all dims = []
    if (this.blockHasWildcard(body)) {
      return new Report(
        {
          name,
          schemaName: schemaName[0] || null,
          visibleEntities: {
            tables: [],
            stickyNotes: [],
            tableGroups: [],
            schemas: [],
          },
          token,
        },
        errors,
      );
    }

    // Find sub-element blocks
    const subBlocks = body.body.filter((n) => n instanceof ElementDeclarationNode) as ElementDeclarationNode[];
    const findSub = (kind: ElementKind) => subBlocks.find((b) => b.isKind(kind));

    const tablesBlock = findSub(ElementKind.DiagramViewTables);
    const notesBlock = findSub(ElementKind.DiagramViewNotes);
    const tableGroupsBlock = findSub(ElementKind.DiagramViewTableGroups);
    const schemasBlock = findSub(ElementKind.DiagramViewSchemas);

    // Interpret each block
    const tablesOriginal = this.interpretTableBlock(tablesBlock);
    const tableGroupsOriginal = this.interpretSimpleBlock(tableGroupsBlock);
    const schemasOriginal = this.interpretSimpleBlock(schemasBlock);
    const stickyNotes = this.interpretSimpleBlock(notesBlock);

    const tableGroupsHasWildcard = tableGroupsBlock
      ? this.blockHasWildcard(tableGroupsBlock.body as BlockExpressionNode)
      : false;

    // Trinity rule: if any of {tables, tableGroups, schemas} is non-null, promote the others to []
    let tables = tablesOriginal;
    let tableGroups = tableGroupsOriginal;
    let schemas = schemasOriginal;

    if (tables !== null || tableGroups !== null || schemas !== null) {
      tables = tables ?? [];
      tableGroups = tableGroups ?? [];
      schemas = schemas ?? [];
    }

    // TableGroups wildcard expansion:
    // Only expand when TableGroups had a wildcard AND Tables and Schemas were not explicitly set
    if (tableGroupsHasWildcard && tablesOriginal === null && schemasOriginal === null) {
      tableGroups = this.getAllTableGroupNames();
    }

    const visibleEntities: FilterConfig = {
      tables,
      stickyNotes,
      tableGroups,
      schemas,
    };

    return new Report({
      name,
      schemaName: schemaName[0] || null,
      visibleEntities,
      token,
    }, errors);
  }

  private blockHasWildcard (block: BlockExpressionNode): boolean {
    return block.body.some(
      (n) => n instanceof FunctionApplicationNode && n.callee instanceof WildcardNode,
    );
  }

  private interpretTableBlock (
    block?: ElementDeclarationNode,
  ): Array<{ name: string;
    schemaName: string; }> | null {
    if (!block) return null;
    const body = block.body as BlockExpressionNode;
    if (body.body.length === 0) return null;
    if (this.blockHasWildcard(body)) return [];

    return body.body
      .filter((n): n is FunctionApplicationNode => n instanceof FunctionApplicationNode)
      .filter((field) => !isWildcardExpression(field.callee))
      .map((field) => this.resolveTableRef(field))
      .filter((r): r is { name: string;
        schemaName: string; } => r !== null);
  }

  private resolveTableRef (
    field: FunctionApplicationNode,
  ): { name: string;
    schemaName: string; } | null {
    if (!field.callee) return null;

    const programNode = this.compiler.parseFile(this.node.filepath).getValue().ast;
    const programSymbol = this.compiler.nodeSymbol(programNode).getFiltered(UNHANDLED);
    if (!programSymbol) return null;

    // scanNonListNodeForBinding splits 'schema.table' into two separate bindees:
    // one for 'schema' and one for 'table'.
    const bindees = scanNonListNodeForBinding(field.callee as SyntaxNode);
    const varNames = bindees
      .flatMap((b) => b.variables)
      .map((v) => extractVarNameFromPrimaryVariable(v))
      .filter((n): n is string => n !== undefined);

    if (varNames.length === 0) return null;

    if (varNames.length >= 2) {
      // Schema-qualified reference, e.g. public.users
      const refSchemaName = varNames[0];
      const tableName = varNames[varNames.length - 1];

      const programMembers = this.compiler.symbolMembers(programSymbol).getFiltered(UNHANDLED);
      const schema = programMembers?.find(
        (m) => m.isKind(SymbolKind.Schema) && (m as SchemaSymbol).name === refSchemaName,
      );

      if (schema) {
        const sym = lookupMember(this.compiler, schema, tableName, {
          kinds: [SymbolKind.Table],
          ignoreNotFound: true,
        }).getValue();
        if (sym) {
          const decl = sym.originalSymbol.declaration;
          if (decl instanceof ElementDeclarationNode && decl.name) {
            const {
              name, schemaName,
            } = extractElementName(decl.name);
            return {
              name,
              schemaName: schemaName[0] || refSchemaName,
            };
          }
        }
      }

      // Fallback: binding failed (error already reported by binder)
      return {
        name: tableName,
        schemaName: refSchemaName,
      };
    }

    // Single name — may be a real name or an alias.
    // lookupInDefaultSchema checks both canonical names and `as` aliases,
    // and resolves through imported symbols.
    const rawName = varNames[0];
    const sym = lookupInDefaultSchema(this.compiler, programSymbol, rawName, {
      kinds: [SymbolKind.Table],
      ignoreNotFound: true,
    }).getValue();

    if (sym) {
      const decl = sym.originalSymbol.declaration;
      if (decl instanceof ElementDeclarationNode && decl.name) {
        const {
          name, schemaName,
        } = extractElementName(decl.name);
        return {
          name,
          schemaName: schemaName[0] || DEFAULT_SCHEMA_NAME,
        };
      }
    }

    // Fallback: binding failed (error already reported by binder)
    return {
      name: rawName,
      schemaName: DEFAULT_SCHEMA_NAME,
    };
  }

  private interpretSimpleBlock (block?: ElementDeclarationNode): Array<{ name: string }> | null {
    if (!block) return null;
    const body = block.body as BlockExpressionNode;
    if (body.body.length === 0) return null;
    if (this.blockHasWildcard(body)) return [];

    return body.body
      .filter((n): n is FunctionApplicationNode => n instanceof FunctionApplicationNode)
      .flatMap((field) => {
        if (!field.callee) return [];
        const fragments = destructureComplexVariable(field.callee) ?? [];
        if (fragments.length === 0) return [];
        return [{ name: fragments[fragments.length - 1] }];
      });
  }

  private getAllTableGroupNames (): Array<{ name: string }> {
    const programNode = this.compiler.parseFile(this.node.filepath).getValue().ast;
    const programSymbol = this.compiler.nodeSymbol(programNode).getFiltered(UNHANDLED);
    if (!programSymbol) return [];

    // TableGroups are always in the public schema (schema-qualified TableGroups are not supported),
    // so searching program-level members (which includes public schema members) is sufficient.
    const programMembers = this.compiler.symbolMembers(programSymbol).getFiltered(UNHANDLED);
    if (!programMembers) return [];

    return programMembers
      .filter((m) => m.isKind(SymbolKind.TableGroup))
      .map((m) => ({ name: this.compiler.symbolName(m) ?? '' }))
      .filter((m) => m.name !== '');
  }
}
