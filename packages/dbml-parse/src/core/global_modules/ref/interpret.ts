import Compiler from '@/compiler';
import {
  DEFAULT_SCHEMA_NAME,
} from '@/constants';
import type {
  Filepath,
} from '@/core/types/filepath';
import {
  CompileError, CompileErrorCode,
} from '@/core/types/errors';
import {
  ElementKind,
} from '@/core/types/keywords';
import {
  UNHANDLED,
} from '@/core/types/module';
import {
  BlockExpressionNode, ElementDeclarationNode, FunctionApplicationNode, IdentifierStreamNode, InfixExpressionNode, ListExpressionNode, SyntaxNode,
} from '@/core/types/nodes';
import Report from '@/core/types/report';
import type {
  Ref, RefEndpoint, RelationCardinality, TokenPosition,
} from '@/core/types/schemaJson';
import {
  destructureComplexVariable, extractVariableFromExpression,
} from '@/core/utils/expression';
import {
  extractStringFromIdentifierStream,
} from '@/core/utils/expression';
import {
  type NodeSymbol,
} from '@/core/types/symbol/symbols';
import {
  aggregateSettingList,
} from '@/core/utils/validate';
import {
  parseColor, getTokenPosition,
} from '@/core/utils/interpret';
import {
  extractNamesFromRefOperand, getMultiplicities,
} from '../utils';

function buildRefEndpoint (
  names: {
    schemaName: string | null;
    tableName: string;
    fieldNames: string[];
  },
  relation: RelationCardinality,
  token: TokenPosition,
): RefEndpoint {
  return {
    schemaName: names.schemaName === DEFAULT_SCHEMA_NAME ? null : names.schemaName,
    tableName: names.tableName,
    fieldNames: names.fieldNames,
    relation,
    token,
  };
}

export function extractRefSettings (field: FunctionApplicationNode): {
  onDelete?: string;
  onUpdate?: string;
  color?: string;
} {
  if (!(field.args[0] instanceof ListExpressionNode)) return {};
  const settingMap = aggregateSettingList(field.args[0]).getValue();

  const deleteValue = settingMap.delete?.at(0)?.value;
  const onDelete = deleteValue instanceof IdentifierStreamNode
    ? extractStringFromIdentifierStream(deleteValue) ?? undefined
    : extractVariableFromExpression(deleteValue) ?? undefined;

  const updateValue = settingMap.update?.at(0)?.value;
  const onUpdate = updateValue instanceof IdentifierStreamNode
    ? extractStringFromIdentifierStream(updateValue) ?? undefined
    : extractVariableFromExpression(updateValue) ?? undefined;

  const color = settingMap.color?.length
    ? parseColor(settingMap.color?.at(0)?.value as any)
    : undefined;

  return { onDelete, onUpdate, color };
}

export class RefInterpreter {
  private declarationNode: ElementDeclarationNode;
  private compiler: Compiler;
  private filepath?: Filepath;
  private tableSymbols?: { left: NodeSymbol; right: NodeSymbol };
  private ref: Partial<Ref>;
  private ownerTable?: string;
  private ownerSchema?: string | null;

  constructor (
    compiler: Compiler,
    declarationNode: ElementDeclarationNode,
    filepath?: Filepath,
    tableSymbols?: { left: NodeSymbol; right: NodeSymbol },
  ) {
    this.compiler = compiler;
    this.declarationNode = declarationNode;
    this.filepath = filepath;
    this.tableSymbols = tableSymbols;
    this.ref = {};
    const parent = this.declarationNode.parent;
    if (parent instanceof ElementDeclarationNode && parent.isKind(ElementKind.Table)) {
      const segments = compiler.nodeFullname(parent).getFiltered(UNHANDLED);
      if (segments && segments.length > 0) {
        const tableName = segments[segments.length - 1];
        const rawSchema = segments.length > 1 ? segments.slice(0, -1).join('.') : null;
        const schemaName = rawSchema === DEFAULT_SCHEMA_NAME ? null : rawSchema;
        this.ownerTable = tableName;
        this.ownerSchema = schemaName;
      }
    }
  }

  interpret (): Report<Ref> {
    this.ref.token = getTokenPosition(this.declarationNode);
    const errors = [
      ...this.interpretName(this.declarationNode.name!),
      ...this.interpretBody(this.declarationNode.body!),
    ];
    return new Report(this.ref as Ref, errors);
  }

  private interpretName (_nameNode: SyntaxNode): CompileError[] {
    const errors: CompileError[] = [];

    const fragments = destructureComplexVariable(this.declarationNode.name!) ?? [];
    this.ref.name = fragments.pop() || null;
    if (fragments.length > 1) {
      errors.push(new CompileError(CompileErrorCode.UNSUPPORTED, 'Nested schema is not supported', this.declarationNode.name!));
    }
    this.ref.schemaName = fragments.join('.') || null;

    return errors;
  }

  private interpretBody (body: FunctionApplicationNode | BlockExpressionNode): CompileError[] {
    if (body instanceof FunctionApplicationNode) {
      return this.interpretField(body);
    }

    return this.interpretField(body.body[0] as FunctionApplicationNode);
  }

  private interpretField (field: FunctionApplicationNode): CompileError[] {
    const op = (field.callee as InfixExpressionNode).op!.value;
    const {
      leftExpression, rightExpression,
    } = field.callee as InfixExpressionNode;

    const settings = extractRefSettings(field);
    this.ref.onDelete = settings.onDelete;
    this.ref.onUpdate = settings.onUpdate;
    this.ref.color = settings.color;

    const multiplicities = getMultiplicities(op);
    if (!multiplicities) return [];

    const leftNames = extractNamesFromRefOperand(leftExpression!, this.ownerSchema, this.ownerTable);
    const rightNames = extractNamesFromRefOperand(rightExpression!, this.ownerSchema, this.ownerTable);
    this.ref.endpoints = [
      buildRefEndpoint(leftNames, multiplicities[0], getTokenPosition(leftExpression!)),
      buildRefEndpoint(rightNames, multiplicities[1], getTokenPosition(rightExpression!)),
    ];

    // When interpreting for a consumer file with known table symbols,
    // rewrite endpoint table names via canonicalName.
    if (this.filepath && this.tableSymbols) {
      const symbols = [this.tableSymbols.left, this.tableSymbols.right];
      for (let i = 0; i < this.ref.endpoints.length; i++) {
        const canonical = this.compiler.canonicalName(this.filepath, symbols[i]).getValue();
        if (canonical) {
          this.ref.endpoints[i].tableName = canonical.name;
          this.ref.endpoints[i].schemaName = canonical.schema === DEFAULT_SCHEMA_NAME ? null : canonical.schema;
        }
      }
    }

    return [];
  }
}
