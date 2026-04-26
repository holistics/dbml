import Compiler from '@/compiler';
import {
  CompileError,
} from '@/core/types/errors';
import {
  UNHANDLED,
} from '@/core/types/module';
import {
  BlockExpressionNode, ElementDeclarationNode, FunctionApplicationNode, SyntaxNode,
} from '@/core/types/nodes';
import Report from '@/core/types/report';
import type {
  Enum, Project, Ref, SchemaElement, Table, TableGroup, TablePartial,
} from '@/core/types/schemaJson';
import {
  extractQuotedStringToken,
} from '@/core/utils/expression';
import {
  parseElementName, tokenPositionOf, normalizeNote,
} from '@/core/utils/interpret';
import {
  RefInterpreter,
} from '../ref/interpret';

export class ProjectInterpreter {
  private compiler: Compiler;
  private declarationNode: ElementDeclarationNode;
  private project: Partial<Project>;

  constructor (compiler: Compiler, declarationNode: ElementDeclarationNode) {
    this.declarationNode = declarationNode;
    this.compiler = compiler;
    this.project = {
      enums: [],
      refs: [],
      tableGroups: [],
      tables: [],
      tablePartials: [],
    };
  }

  interpret (): Report<Project> {
    this.project.token = tokenPositionOf(this.declarationNode);
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
    } = parseElementName(nameNode);
    this.project.name = name;

    return [];
  }

  private interpretSubElement (sub: ElementDeclarationNode): Report<SchemaElement | SchemaElement[] | undefined> {
    const symbol = this.compiler.nodeSymbol(sub).getFiltered(UNHANDLED);
    if (symbol) {
      const result = this.compiler.interpretSymbol(symbol);
      if (!result.hasValue(UNHANDLED)) return result;
    }
    return Report.create(undefined);
  }

  private interpretBody (body: BlockExpressionNode): CompileError[] {
    return body.body.flatMap((_sub) => {
      const sub = _sub as ElementDeclarationNode;
      switch (sub.type?.value.toLowerCase()) {
        case 'table': {
          const report = this.interpretSubElement(sub);
          if (report.getValue()) this.project.tables?.push(report.getValue() as Table);
          return report.getErrors();
        }
        case 'ref': {
          const report = new RefInterpreter(this.compiler, sub).interpret();
          if (report.getValue()) this.project.refs?.push(report.getValue() as Ref);
          return report.getErrors();
        }
        case 'tablegroup': {
          const report = this.interpretSubElement(sub);
          if (report.getValue()) this.project.tableGroups?.push(report.getValue() as TableGroup);
          return report.getErrors();
        }
        case 'enum': {
          const report = this.interpretSubElement(sub);
          if (report.getValue()) this.project.enums?.push(report.getValue() as Enum);
          return report.getErrors();
        }
        case 'note': {
          const noteBody = sub.body instanceof BlockExpressionNode
            ? (sub.body.body[0] as FunctionApplicationNode)?.callee
            : (sub.body as FunctionApplicationNode)?.callee;
          const content = noteBody ? extractQuotedStringToken(noteBody) : undefined;
          if (content) {
            this.project.note = {
              value: normalizeNote(content),
              token: tokenPositionOf(sub),
            };
          }
          return [];
        }
        case 'tablepartial': {
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
