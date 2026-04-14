import {
  partition,
} from 'lodash-es';
import {
  destructureComplexVariable, destructureMemberAccessExpression, extractQuotedStringToken,
} from '@/core/analyzer/utils';
import {
  aggregateSettingList,
} from '@/core/analyzer/validator/utils';
import {
  extractColor, extractElementName, getTokenPosition, normalizeNoteContent,
} from '@/core/interpreter/utils';
import {
  CompileError, CompileErrorCode,
} from '@/core/types/errors';
import {
  BlockExpressionNode, ElementDeclarationNode, FunctionApplicationNode, ListExpressionNode, SyntaxNode,
} from '@/core/types/nodes';
import {
  TableGroup,
} from '@/core/types/schemaJson';
import {
  ElementInterpreter, InterpreterDatabase,
} from '../types';

export class TableGroupInterpreter implements ElementInterpreter {
  private declarationNode: ElementDeclarationNode;
  private env: InterpreterDatabase;
  private tableGroup: Partial<TableGroup>;

  constructor (declarationNode: ElementDeclarationNode, env: InterpreterDatabase) {
    this.declarationNode = declarationNode;
    this.env = env;
    this.tableGroup = {
      tables: [],
    };
  }

  interpret (): CompileError[] {
    const errors: CompileError[] = [];
    this.tableGroup.token = getTokenPosition(this.declarationNode);
    this.env.tableGroups.set(this.declarationNode, this.tableGroup as TableGroup);

    errors.push(
      ...this.interpretName(this.declarationNode.name!),
      ...this.interpretSettingList(this.declarationNode.attributeList),
      ...this.interpretBody(this.declarationNode.body as BlockExpressionNode),
    );

    return errors;
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
    this.tableGroup.tables = fields.map((field) => {
      const fragments = destructureComplexVariable((field as FunctionApplicationNode).callee)!;

      if (fragments.length > 2) {
        errors.push(new CompileError(CompileErrorCode.UNSUPPORTED, 'Nested schema is not supported', field));
      }

      const tableid = destructureMemberAccessExpression((field as FunctionApplicationNode).callee!)!.pop()!.referee!.id;
      if (this.env.tableOwnerGroup[tableid]) {
        const tableGroup = this.env.tableOwnerGroup[tableid];
        const {
          schemaName, name,
        } = this.env.tableGroups.get(tableGroup)!;
        const groupName = schemaName ? `${schemaName}.${name}` : name;
        errors.push(new CompileError(CompileErrorCode.TABLE_REAPPEAR_IN_TABLEGROUP, `Table "${fragments.join('.')}" already appears in group "${groupName}"`, field));
      } else {
        this.env.tableOwnerGroup[tableid] = this.declarationNode;
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
      value: normalizeNoteContent(extractQuotedStringToken(noteNode?.value)!),
      token: getTokenPosition(noteNode),
    };

    return [];
  }
}
