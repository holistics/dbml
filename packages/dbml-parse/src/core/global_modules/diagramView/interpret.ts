import {
  BlockExpressionNode,
  ElementDeclarationNode,
  FunctionApplicationNode,
  SyntaxNode,
  WildcardNode,
} from '@/core/types/nodes';
import type { DiagramView, FilterConfig } from '@/core/types/schemaJson';
import { extractElementName, getTokenPosition } from '../utils';
import { extractVarNameFromPrimaryVariable } from '@/core/utils/expression';
import { DEFAULT_SCHEMA_NAME } from '@/constants';
import { ElementKind } from '@/core/types/keywords';
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
    const { name, schemaName } = extractElementName(this.node.name!);
    const body = this.node.body as BlockExpressionNode;

    // Body-level wildcard: DiagramView v { * } → all dims = []
    if (this.blockHasWildcard(body)) {
      return new Report(
        {
          name,
          schemaName: schemaName[0] || null,
          visibleEntities: { tables: [], stickyNotes: [], tableGroups: [], schemas: [] },
          token,
        },
        errors,
      );
    }

    // Find sub-element blocks
    const subBlocks = body.body.filter((n) => n instanceof ElementDeclarationNode) as ElementDeclarationNode[];
    const findSub = (kind: string) => subBlocks.find((b) => b.type?.value.toLowerCase() === kind);

    const tablesBlock = findSub('tables');
    const notesBlock = findSub('notes');
    const tableGroupsBlock = findSub('tablegroups');
    const schemasBlock = findSub('schemas');

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

    const visibleEntities: FilterConfig = { tables, stickyNotes, tableGroups, schemas };

    return new Report({ name, schemaName: schemaName[0] || null, visibleEntities, token }, errors);
  }

  private blockHasWildcard (block: BlockExpressionNode): boolean {
    return block.body.some(
      (n) => n instanceof FunctionApplicationNode && n.callee instanceof WildcardNode,
    );
  }

  private interpretTableBlock (
    block?: ElementDeclarationNode,
  ): Array<{ name: string; schemaName: string }> | null {
    if (!block) return null;
    const body = block.body as BlockExpressionNode;
    if (body.body.length === 0) return null;
    if (this.blockHasWildcard(body)) return [];

    return body.body
      .filter((n): n is FunctionApplicationNode => n instanceof FunctionApplicationNode)
      .map((field) => {
        const rawName = extractVarNameFromPrimaryVariable(field.callee as any) ?? '';
        return this.resolveTableAlias(rawName);
      });
  }

  private interpretSimpleBlock (block?: ElementDeclarationNode): Array<{ name: string }> | null {
    if (!block) return null;
    const body = block.body as BlockExpressionNode;
    if (body.body.length === 0) return null;
    if (this.blockHasWildcard(body)) return [];

    return body.body
      .filter((n): n is FunctionApplicationNode => n instanceof FunctionApplicationNode)
      .map((field) => ({
        name: extractVarNameFromPrimaryVariable(field.callee as any) ?? '',
      }));
  }

  private resolveTableAlias (nameOrAlias: string): { name: string; schemaName: string } {
    const programNode = this.compiler.parseFile(this.node.filepath).getValue().ast;
    for (const n of programNode.body) {
      if (!(n instanceof ElementDeclarationNode) || !n.isKind(ElementKind.Table)) continue;
      // Check alias match
      if (n.alias) {
        const alias = extractVarNameFromPrimaryVariable(n.alias as any);
        if (alias === nameOrAlias) {
          const { name, schemaName } = extractElementName(n.name!);
          return { name, schemaName: schemaName[0] || DEFAULT_SCHEMA_NAME };
        }
      }
      // Check real name match
      const { name, schemaName } = extractElementName(n.name!);
      if (name === nameOrAlias) {
        return { name, schemaName: schemaName[0] || DEFAULT_SCHEMA_NAME };
      }
    }
    return { name: nameOrAlias, schemaName: DEFAULT_SCHEMA_NAME };
  }

  private getAllTableGroupNames (): Array<{ name: string }> {
    const programNode = this.compiler.parseFile(this.node.filepath).getValue().ast;
    const result: Array<{ name: string }> = [];
    for (const n of programNode.body) {
      if (!(n instanceof ElementDeclarationNode) || !n.isKind(ElementKind.TableGroup)) continue;
      const { name } = extractElementName(n.name!);
      result.push({ name });
    }
    return result;
  }
}
