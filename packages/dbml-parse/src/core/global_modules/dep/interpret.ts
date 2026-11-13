import { destructureComplexVariable } from '@/core/utils/expression';
import { aggregateSettingList } from '@/core/utils/validate';
import { CompileError, CompileErrorCode } from '@/core/types/errors';
import { ElementKind, SettingName } from '@/core/types/keywords';
import {
  AttributeNode,
  BlockExpressionNode,
  ElementDeclarationNode,
  FunctionApplicationNode,
  ListExpressionNode,
  type SyntaxNode,
} from '@/core/types/nodes';
import type {
  CustomMetadata, Dep, DepEdge, TokenPosition,
} from '@/core/types/schemaJson';
import { DepMetadata, type Filepath } from '@/core/types';
import type Compiler from '@/compiler';
import { extractMetadataValue, getTokenPosition } from '@/core/utils/interpret';
import Report from '@/core/types/report';
import { attachCustomMetadata } from '../metadata/utils';
import { DEP_METADATA_FIELDS } from '../metadata/registries';

export class DepInterpreter {
  private compiler: Compiler;
  private metadata: DepMetadata;
  private declarationNode: ElementDeclarationNode | AttributeNode;
  private filepath: Filepath;
  private dep: Partial<Dep>;

  constructor (compiler: Compiler, metadata: DepMetadata, filepath: Filepath) {
    this.compiler = compiler;
    this.filepath = filepath;
    this.metadata = metadata;
    this.declarationNode = metadata.declaration;
    this.dep = {};
  }

  interpret (): Report<Dep> {
    this.dep.token = getTokenPosition(this.declarationNode);
    const errors = [
      ...this.interpretName(),
      ...this.interpretEdges(),
      ...this.interpretSettings(),
    ];

    // Only named top-level deps can be targeted by Metadata blocks
    if (this.metadata.name(this.compiler) !== undefined) {
      attachCustomMetadata(this.compiler, this.dep, this.metadata, DEP_METADATA_FIELDS, this.filepath);
    }
    return Report.create(this.dep as Dep, errors);
  }

  private interpretName (): CompileError[] {
    if (!(this.declarationNode instanceof ElementDeclarationNode)) {
      this.dep.name = null;
      this.dep.schemaName = null;
      return [];
    }
    const errors: CompileError[] = [];
    const fragments = this.declarationNode.name ? destructureComplexVariable(this.declarationNode.name) ?? [] : [];
    this.dep.name = fragments.pop() || null;
    if (fragments.length > 1) {
      errors.push(new CompileError(CompileErrorCode.UNSUPPORTED, 'Nested schema is not supported', this.declarationNode.name!));
    }
    this.dep.schemaName = fragments.join('.') || null;
    return errors;
  }

  private interpretEdges (): CompileError[] {
    const upstreamColsList = this.metadata.upstreamColumns(this.compiler);
    const downstreamColsList = this.metadata.downstreamColumns(this.compiler);
    const upstreamTables = this.metadata.upstreamTables(this.compiler);
    const downstreamTables = this.metadata.downstreamTables(this.compiler);

    const edges: DepEdge[] = [];
    const errors: CompileError[] = [];
    const count = Math.max(upstreamTables.length, downstreamTables.length);
    for (let i = 0; i < count; i++) {
      const upTable = upstreamTables[i];
      const downTable = downstreamTables[i];
      const upColumns = upstreamColsList[i] ?? [];
      const downColumns = downstreamColsList[i] ?? [];

      const upTableName = upTable?.interpretedName(this.compiler, this.filepath);
      const downTableName = downTable?.interpretedName(this.compiler, this.filepath);

      const upSchema = upTableName?.schema ?? null;
      const downSchema = downTableName?.schema ?? null;

      edges.push({
        upstream: {
          schemaName: upTableName?.schema ?? null,
          tableName: upTableName?.name ?? '',
          fieldNames: upColumns.map((c) => c.name ?? ''),
          token: this.dep.token!,
        },
        downstream: {
          schemaName: downTableName?.schema ?? null,
          tableName: downTableName?.name ?? '',
          fieldNames: downColumns.map((c) => c.name ?? ''),
          token: this.dep.token!,
        },
        token: this.dep.token!,
      });
    }
    this.dep.edges = edges;
    return errors;
  }

  private interpretSettings (): CompileError[] {
    if (!(this.declarationNode instanceof ElementDeclarationNode)) return [];

    const metadata: CustomMetadata = {};

    // Header `[...]`, then the `[...]` of each edge
    const body = this.declarationNode.body;
    const fields = body instanceof FunctionApplicationNode
      ? [
          body,
        ]
      : (body?.body ?? []).filter((e): e is FunctionApplicationNode => e instanceof FunctionApplicationNode);
    const settingsLists = [
      this.declarationNode.attributeList,
      ...fields.map((field) => field.args.find((arg): arg is ListExpressionNode => arg instanceof ListExpressionNode)),
    ];
    for (const settingsList of settingsLists) {
      if (!settingsList) continue;
      for (const [name, attrs] of Object.entries(aggregateSettingList(settingsList).getValue())) {
        this.consumeSetting(name, attrs[0].value, getTokenPosition(attrs[0]), metadata);
      }
    }

    // Block-body `key: value` fields, and the `Note { 'text' }` block form
    if (body instanceof BlockExpressionNode) {
      const subs = body.body.filter((e): e is ElementDeclarationNode => e instanceof ElementDeclarationNode);
      for (const sub of subs) {
        const name = sub.type?.value;
        if (!name) continue;
        const subBody = sub.body;
        if (subBody instanceof FunctionApplicationNode) {
          this.consumeSetting(name, subBody.callee, getTokenPosition(sub), metadata);
        } else if (sub.isKind(ElementKind.Note) && subBody instanceof BlockExpressionNode && subBody.body[0] instanceof FunctionApplicationNode) {
          this.consumeSetting(SettingName.Note, subBody.body[0].callee, getTokenPosition(sub), metadata);
        }
      }
    }

    this.dep.metadata = metadata;
    return [];
  }

  // Builtin fields (color, note) are assigned onto the dep, every other key is custom metadata. Invalid values are skipped (reported at validate phase)
  private consumeSetting (name: string, valueNode: SyntaxNode | undefined, token: TokenPosition, metadata: CustomMetadata): void {
    const field = DEP_METADATA_FIELDS[name.toLowerCase() as keyof typeof DEP_METADATA_FIELDS];
    if (field) {
      const value = field.parse(valueNode);
      if (value !== undefined) field.assign(this.dep, value as never, token);
      return;
    }

    const value = extractMetadataValue(valueNode);
    if (value !== undefined) metadata[name] = { ...value, token };
  }
}
