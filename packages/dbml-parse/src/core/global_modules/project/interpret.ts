import type Compiler from '@/compiler';
import type { CompileError } from '@/core/types/errors';
import { UNHANDLED } from '@/core/types/module';
import {
  BlockExpressionNode,
  type ElementDeclarationNode,
  type FunctionApplicationNode,
  type SyntaxNode,
} from '@/core/types/nodes';
import Report from '@/core/types/report';
import type {
  Enum, Project, SchemaElement, Table, TableGroup, TablePartial,
} from '@/core/types/schemaJson';
import type { Filepath } from '@/core/types/filepath';
import { extractQuotedStringToken } from '@/core/utils/expression';
import { extractElementName, getTokenPosition, normalizeNote } from '@/core/utils/interpret';
import { ElementKind } from '@/core/types';

export class ProjectInterpreter {
  private compiler: Compiler;
  private declarationNode: ElementDeclarationNode;
  private filepath: Filepath;
  private project: Partial<Project>;

  constructor (compiler: Compiler, declarationNode: ElementDeclarationNode, filepath: Filepath) {
    this.declarationNode = declarationNode;
    this.compiler = compiler;
    this.filepath = filepath;
    this.project = {
      enums: [],
      refs: [],
      tableGroups: [],
      tables: [],
      tablePartials: [],
    };
  }

  interpret (): Report<Project> {
    this.project.token = getTokenPosition(this.declarationNode);
    const errors = [
      ...this.interpretName(this.declarationNode.name),
      ...this.interpretBody(this.declarationNode.body as BlockExpressionNode),
    ];

    return new Report(this.project as Project, errors);
  }

  private interpretName (nameNode?: SyntaxNode): CompileError[] {
    if (!nameNode) {
      this.project.name = null;

      return [];
    }

    const {
      name,
    } = extractElementName(nameNode);
    this.project.name = name;

    return [];
  }

  private interpretSubElement (sub: ElementDeclarationNode): Report<SchemaElement | SchemaElement[] | undefined> {
    const symbol = this.compiler.nodeSymbol(sub).getFiltered(UNHANDLED);
    if (symbol) {
      const result = this.compiler.interpretSymbol(symbol, this.filepath);
      if (!result.hasValue(UNHANDLED)) return result;
    }
    return Report.create(undefined);
  }

  private interpretBody (body: BlockExpressionNode): CompileError[] {
    return body.body.flatMap((_sub) => {
      const sub = _sub as ElementDeclarationNode;
      switch (sub.getElementKind()) {
        case ElementKind.Table: {
          const report = this.interpretSubElement(sub);
          if (report.getValue()) this.project.tables?.push(report.getValue() as Table);
          return report.getErrors();
        }
        case ElementKind.TableGroup: {
          const report = this.interpretSubElement(sub);
          if (report.getValue()) this.project.tableGroups?.push(report.getValue() as TableGroup);
          return report.getErrors();
        }
        case ElementKind.Enum: {
          const report = this.interpretSubElement(sub);
          if (report.getValue()) this.project.enums?.push(report.getValue() as Enum);
          return report.getErrors();
        }
        case ElementKind.Note: {
          const noteBody = sub.body instanceof BlockExpressionNode
            ? (sub.body.body[0] as FunctionApplicationNode)?.callee
            : (sub.body as FunctionApplicationNode)?.callee;
          const content = noteBody ? extractQuotedStringToken(noteBody) : undefined;
          if (content) {
            this.project.note = {
              value: normalizeNote(content),
              token: getTokenPosition(sub),
            };
          }
          return [];
        }
        case ElementKind.TablePartial: {
          const report = this.interpretSubElement(sub);
          if (report.getValue()) this.project.tablePartials?.push(report.getValue() as TablePartial);
          return report.getErrors();
        }
        default: {
          (this.project as Record<string, unknown>)[sub.type!.value.toLowerCase()] = extractQuotedStringToken((sub.body as FunctionApplicationNode).callee);

          return [];
        }
      }
    });
  }
}
