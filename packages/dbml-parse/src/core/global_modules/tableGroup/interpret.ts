import {
  partition,
} from 'lodash-es';
import {
  destructureComplexVariable,
  extractQuotedStringToken,
} from '@/core/utils/expression';
import {
  aggregateSettingList,
} from '@/core/utils/validate';
import {
  CompileError,
  CompileErrorCode,
} from '@/core/types/errors';
import {
  BlockExpressionNode,
  type ElementDeclarationNode,
  FunctionApplicationNode,
  type ListExpressionNode,
  type SyntaxNode,
} from '@/core/types/nodes';
import type {
  TableGroup,
} from '@/core/types/schemaJson';
import type Compiler from '@/compiler';
import type {
  Filepath,
  TableGroupSymbol,
} from '@/core/types';
import Report from '@/core/types/report';
import {
  extractColor,
  extractElementName,
  getTokenPosition,
  normalizeNote,
} from '@/core/utils/interpret';

export class TableGroupInterpreter {
  private compiler: Compiler;
  private symbol: TableGroupSymbol;
  private declarationNode: ElementDeclarationNode;
  private filepath: Filepath;

  private tableGroup: Partial<TableGroup>;

  constructor (compiler: Compiler, symbol: TableGroupSymbol, filepath: Filepath) {
    this.compiler = compiler;
    this.symbol = symbol;
    this.declarationNode = symbol.declaration as ElementDeclarationNode;

    this.filepath = filepath;

    this.tableGroup = {
      tables: [],
    };
  }

  interpret (): Report<TableGroup> {
    const errors: CompileError[] = [];
    this.tableGroup.token = getTokenPosition(this.declarationNode);

    errors.push(
      ...this.interpretName(this.declarationNode.name!),
      ...this.interpretSettingList(this.declarationNode.attributeList),
      ...this.interpretBody(this.declarationNode.body as BlockExpressionNode),
    );

    return Report.create(this.tableGroup as TableGroup, errors);
  }

  private interpretName (nameNode: SyntaxNode): CompileError[] {
    const errors: CompileError[] = [];

    const {
      name, schemaName,
    } = extractElementName(nameNode);
    if (schemaName.length >= 2) {
      this.tableGroup.name = name;
      this.tableGroup.schemaName = schemaName.join('.');
      errors.push(new CompileError(CompileErrorCode.UNSUPPORTED, 'Nested schema is not supported', this.declarationNode.name!));
    }
    this.tableGroup.name = name;
    this.tableGroup.schemaName = schemaName[0] || null;

    return errors;
  }

  private interpretBody (body: BlockExpressionNode): CompileError[] {
    const [
      fields,
      subs,
    ] = partition(body.body, (e) => e instanceof FunctionApplicationNode);
    return [
      ...this.interpretFields(fields as FunctionApplicationNode[]),
      ...this.interpretSubElements(subs as ElementDeclarationNode[]),
    ];
  }

  private interpretSubElements (subs: ElementDeclarationNode[]): CompileError[] {
    return subs.flatMap((sub) => {
      switch (sub.type?.value.toLowerCase()) {
        case 'note':
          this.tableGroup.note = {
            value: normalizeNote(extractQuotedStringToken(
              sub.body instanceof BlockExpressionNode
                ? (sub.body.body[0] as FunctionApplicationNode).callee
                : sub.body!.callee,
            )!),
            token: getTokenPosition(sub),
          };
          break;

        default:
          break;
      }

      return [];
    });
  }

  private interpretFields (fields: FunctionApplicationNode[]): CompileError[] {
    const errors: CompileError[] = [];
    this.tableGroup.tables = fields.map((field) => {
      const fragments = destructureComplexVariable((field as FunctionApplicationNode).callee)!;

      if (fragments.length > 2) {
        errors.push(new CompileError(CompileErrorCode.UNSUPPORTED, 'Nested schema is not supported', field));
      }

      return {
        name: fragments.pop()!,
        schemaName: fragments.join('.') || null,
      };
    });

    return errors;
  }

  private interpretSettingList (settings?: ListExpressionNode): CompileError[] {
    const settingMap = aggregateSettingList(settings).getValue();

    this.tableGroup.color = settingMap.color?.length
      ? extractColor(settingMap.color?.at(0)?.value as any)
      : undefined;

    const [
      noteNode,
    ] = settingMap.note || [];
    this.tableGroup.note = noteNode && {
      value: normalizeNote(extractQuotedStringToken(noteNode?.value)!),
      token: getTokenPosition(noteNode),
    };

    return [];
  }
}
