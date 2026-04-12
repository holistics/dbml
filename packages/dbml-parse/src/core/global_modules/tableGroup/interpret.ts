import { partition } from 'lodash-es';
import {
  extractQuotedStringToken, destructureComplexVariable,
} from '@/core/utils/expression';
import {
  CompileError, CompileErrorCode,
} from '@/core/types/errors';
import {
  BlockExpressionNode, ElementDeclarationNode, FunctionApplicationNode, SyntaxNode, ListExpressionNode,
} from '@/core/types/nodes';
import type {
  TableGroup, TableGroupField,
} from '@/core/types/schemaJson';
import {
  extractElementName, getTokenPosition, normalizeNoteContent, extractColor, getSymbolSchemaAndName,
} from '../utils';
import { aggregateSettingList } from '@/core/utils/validate';
import Compiler from '@/compiler';
import Report from '@/core/types/report';
import { UNHANDLED } from '@/constants';
import { SymbolKind } from '@/core/types/symbol';

export class TableGroupInterpreter {
  private declarationNode: ElementDeclarationNode;
  private compiler: Compiler;
  private tableGroup: Partial<TableGroup>;

  constructor (compiler: Compiler, declarationNode: ElementDeclarationNode) {
    this.declarationNode = declarationNode;
    this.compiler = compiler;
    this.tableGroup = { tables: [] };
  }

  interpret (): Report<TableGroup> {
    const errors: CompileError[] = [];
    this.tableGroup.token = getTokenPosition(this.declarationNode);

    errors.push(
      ...this.interpretName(this.declarationNode.name!),
      ...this.interpretSettingList(this.declarationNode.attributeList),
      ...this.interpretBody(this.declarationNode.body as BlockExpressionNode),
    );

    return new Report(this.tableGroup as TableGroup, errors);
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
    const [fields, subs] = partition(body.body, (e) => e instanceof FunctionApplicationNode);
    return [...this.interpretFields(fields as FunctionApplicationNode[]), ...this.interpretSubElements(subs as ElementDeclarationNode[])];
  }

  private interpretSubElements (subs: ElementDeclarationNode[]): CompileError[] {
    return subs.flatMap((sub) => {
      switch (sub.type?.value.toLowerCase()) {
        case 'note':
          this.tableGroup.note = {
            value: normalizeNoteContent(extractQuotedStringToken(
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
    this.tableGroup.tables = fields.flatMap((field) => {
      const result = this.compiler.nodeReferee(field.callee!);
      if (result.hasValue(UNHANDLED)) return [];
      const tableSymbol = result.getValue();
      if (!tableSymbol || !tableSymbol.isKind(SymbolKind.Table)) return [];

      const {
        schemaName, name,
      } = getSymbolSchemaAndName(this.compiler, tableSymbol);

      return [
        {
          name,
          schemaName,
        },
      ];
    });

    return errors;
  }

  private interpretSettingList (settings?: ListExpressionNode): CompileError[] {
    const settingMap = aggregateSettingList(settings).getValue();

    this.tableGroup.color = settingMap.color?.length
      ? extractColor(settingMap.color?.at(0)?.value)
      : undefined;

    const [noteNode] = settingMap.note || [];
    this.tableGroup.note = noteNode && {
      value: normalizeNoteContent(extractQuotedStringToken(noteNode?.value)!),
      token: getTokenPosition(noteNode),
    };

    return [];
  }
}
