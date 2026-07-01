import {
  destructureComplexVariable,
  extractNumericLiteral,
  extractQuotedStringToken,
  extractStringFromIdentifierStream,
  extractVariableFromExpression,
} from '@/core/utils/expression';
import { aggregateSettingList } from '@/core/utils/validate';
import { CompileError, CompileErrorCode } from '@/core/types/errors';
import {
  AttributeNode,
  ElementDeclarationNode,
  FunctionApplicationNode,
  IdentifierStreamNode,
  ListExpressionNode,
} from '@/core/types/nodes';
import type { Dep, DepEdge } from '@/core/types/schemaJson';
import { DepMetadata, type Filepath } from '@/core/types';
import type Compiler from '@/compiler';
import { extractColor, getTokenPosition } from '@/core/utils/interpret';
import Report from '@/core/types/report';

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
    const upstreamTbls = this.metadata.upstreamTables(this.compiler);
    const downstreamTbls = this.metadata.downstreamTables(this.compiler);

    const edges: DepEdge[] = [];
    const count = Math.max(upstreamTbls.length, downstreamTbls.length);
    for (let i = 0; i < count; i++) {
      const upTbl = upstreamTbls[i];
      const downTbl = downstreamTbls[i];
      const upCols = upstreamColsList[i] ?? [];
      const downCols = downstreamColsList[i] ?? [];

      const upTblName = upTbl?.interpretedName(this.compiler, this.filepath);
      const downTblName = downTbl?.interpretedName(this.compiler, this.filepath);

      edges.push({
        upstream: {
          schemaName: upTblName?.schema ?? null,
          tableName: upTblName?.name ?? '',
          fieldNames: upCols.map((c) => c.name ?? ''),
          token: this.dep.token!,
        },
        downstream: {
          schemaName: downTblName?.schema ?? null,
          tableName: downTblName?.name ?? '',
          fieldNames: downCols.map((c) => c.name ?? ''),
          token: this.dep.token!,
        },
        token: this.dep.token!,
      });
    }
    this.dep.edges = edges;
    return [];
  }

  /**
   * Read settings into `dep.note` and `dep.custom`.
   *
   * Settings come from THREE sources, in this order:
   *   1. The top-level attribute list on the Dep header
   *      (e.g. `Dep my_block [color: 'blue'] { ... }`).
   *   2. Per-field setting lists inside the body
   *      (e.g. `Dep { a -> b [note: 'x'] }`).
   *   3. Sub-element declarations inside the body
   *      (e.g. `Dep { a -> b; note: 'x'; materialized: 'view' }`).
   *
   * All three sources write into the same `custom` object (with `note`
   * routed to the typed slot instead). Precedence is last-write-wins by
   * virtue of plain object assignment — settings later in the source
   * file overwrite earlier ones with the same key.
   */
  private interpretSettings (): CompileError[] {
    const custom: Record<string, string | number | boolean | null> = {};

    if (this.declarationNode instanceof ElementDeclarationNode) {
      if (this.declarationNode.attributeList) {
        this.consumeSettings(this.declarationNode.attributeList, custom);
      }
      const body = this.declarationNode.body;
      if (body) {
        const fields = body instanceof FunctionApplicationNode
          ? [body]
          : body.body.filter((e): e is FunctionApplicationNode => e instanceof FunctionApplicationNode);
        for (const field of fields) {
          const settingsList = field.args.find((arg) => arg instanceof ListExpressionNode) as ListExpressionNode | undefined;
          if (settingsList) {
            this.consumeSettings(settingsList, custom);
          }
        }
        if (!(body instanceof FunctionApplicationNode)) {
          const subs = body.body.filter((e): e is ElementDeclarationNode => e instanceof ElementDeclarationNode);
          for (const sub of subs) {
            const key = sub.type?.value;
            if (!key) continue;
            const subBody = sub.body;
            if (!(subBody instanceof FunctionApplicationNode)) continue;
            if (key === 'color') {
              const color = extractColor(subBody.callee);
              if (color !== undefined) this.dep.color = color;
              continue;
            }
            const rawValue = this.extractAttrValue(subBody.callee);
            if (rawValue === undefined) continue;
            if (key === 'note') {
              this.dep.note = { value: String(rawValue), token: getTokenPosition(sub) };
            } else {
              custom[key] = rawValue;
            }
          }
        }
      }
    }

    if (Object.keys(custom).length > 0) {
      this.dep.custom = custom;
    }
    return [];
  }

  private consumeSettings (settings: ListExpressionNode, custom: Record<string, string | number | boolean | null>): void {
    const settingMap = aggregateSettingList(settings).getValue();
    for (const [name, attrs] of Object.entries(settingMap)) {
      const attr = attrs[0];
      if (!attr) continue;

      if (name === 'color') {
        const color = extractColor(attr.value);
        if (color !== undefined) this.dep.color = color;
        continue;
      }

      const rawValue = this.extractAttrValue(attr.value);
      if (rawValue === undefined) continue;

      if (name === 'note') {
        this.dep.note = { value: String(rawValue), token: getTokenPosition(attr) };
      } else {
        custom[name] = rawValue;
      }
    }
  }

  private extractAttrValue (value: unknown): string | number | null | undefined {
    if (value instanceof IdentifierStreamNode) {
      return extractStringFromIdentifierStream(value);
    }
    const numericValue = extractNumericLiteral(value as any);
    if (numericValue !== null) return numericValue;
    const stringValue = extractQuotedStringToken(value as any);
    if (stringValue !== undefined) return stringValue;
    return extractVariableFromExpression(value as any);
  }
}
