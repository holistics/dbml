import {
  destructureComplexVariable,
  extractNumericLiteral,
  extractQuotedStringToken,
  extractStringFromIdentifierStream,
  extractVariableFromExpression,
} from '@/core/utils/expression';
import { aggregateSettingList } from '@/core/utils/validate';
import { CompileError, CompileErrorCode } from '@/core/types/errors';
import { DEFAULT_SCHEMA_NAME } from '@/constants';
import { ElementKind, SettingName } from '@/core/types/keywords';
import {
  AttributeNode,
  BlockExpressionNode,
  ElementDeclarationNode,
  FunctionApplicationNode,
  IdentifierStreamNode,
  ListExpressionNode,
} from '@/core/types/nodes';
import type { Dep, DepEdge } from '@/core/types/schemaJson';
import { DepMetadata, type Filepath } from '@/core/types';
import type Compiler from '@/compiler';
import { extractColor, getTokenPosition, normalizeNote } from '@/core/utils/interpret';
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
    const metadata: Record<string, string | number | boolean | null> = {};

    if (this.declarationNode instanceof ElementDeclarationNode) {
      if (this.declarationNode.attributeList) {
        this.consumeSettings(this.declarationNode.attributeList, metadata);
      }

      const body = this.declarationNode.body;
      if (body) {
        const fields = body instanceof FunctionApplicationNode
          ? [
              body,
            ]
          : body.body.filter((e): e is FunctionApplicationNode => e instanceof FunctionApplicationNode);
        for (const field of fields) {
          const settingsList = field.args.find((arg): arg is ListExpressionNode => arg instanceof ListExpressionNode);
          if (settingsList) {
            this.consumeSettings(settingsList, metadata);
          }
        }

        if (!(body instanceof FunctionApplicationNode)) {
          const subs = body.body.filter((e): e is ElementDeclarationNode => e instanceof ElementDeclarationNode);
          for (const sub of subs) {
            const key = sub.type?.value?.toLowerCase();
            if (!key) continue;
            const subBody = sub.body;
            // Note { 'text' } block form - extract from the inner FunctionApplicationNode
            if (sub.isKind(ElementKind.Note) && subBody instanceof BlockExpressionNode) {
              const inner = subBody.body[0];
              if (inner instanceof FunctionApplicationNode && inner.callee) {
                const rawValue = this.extractAttrValue(inner.callee);
                if (rawValue !== undefined) {
                  this.dep.note = { value: normalizeNote(String(rawValue)), token: getTokenPosition(sub) };
                }
              }
              continue;
            }
            if (!(subBody instanceof FunctionApplicationNode)) continue;
            if (key === SettingName.Color) {
              const color = extractColor(subBody.callee);
              if (color !== undefined) this.dep.color = color;
              continue;
            }
            const rawValue = this.extractAttrValue(subBody.callee);
            if (rawValue === undefined) continue;
            if (sub.isKind(ElementKind.Note)) {
              this.dep.note = { value: normalizeNote(String(rawValue)), token: getTokenPosition(sub) };
            } else {
              metadata[key] = rawValue;
            }
          }
        }
      }
    }

    if (Object.keys(metadata).length > 0) {
      this.dep.metadata = metadata;
    }
    return [];
  }

  private consumeSettings (settings: ListExpressionNode, metadata: Record<string, string | number | boolean | null>): void {
    const settingMap = aggregateSettingList(settings).getValue();
    for (const [
      name,
      attrs,
    ] of Object.entries(settingMap)) {
      const attr = attrs[0];
      if (!attr) continue;

      if (name === SettingName.Color) {
        const color = extractColor(attr.value);
        if (color !== undefined) this.dep.color = color;
        continue;
      }

      const rawValue = this.extractAttrValue(attr.value);
      if (rawValue === undefined) continue;

      if (name === SettingName.Note) {
        this.dep.note = { value: normalizeNote(String(rawValue)), token: getTokenPosition(attr) };
      } else {
        metadata[name] = rawValue;
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
