import Compiler from '@/compiler';
import {
  CompileError,
} from '@/core/types/errors';
import {
  BlockExpressionNode, ElementDeclarationNode, FunctionApplicationNode, SyntaxNode,
} from '@/core/types/nodes';
import Report from '@/core/types/report';
import type {
  Enum, Project, Ref, Table, TableGroup, TablePartial,
} from '@/core/types/schemaJson';
import {
  extractQuotedStringToken,
} from '@/core/utils/expression';
import {
  extractElementName, getTokenPosition, normalizeNoteContent,
} from '../utils';

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

  private interpretBody (body: BlockExpressionNode): CompileError[] {
    return body.body.flatMap((_sub) => {
      const sub = _sub as ElementDeclarationNode;
      switch (sub.type?.value.toLowerCase()) {
        case 'table': {
          const report = this.compiler.interpretNode(sub);
          const errors = report.getErrors();
          this.project.tables!.push(report.getValue() as Table);

          return errors;
        }
        case 'ref': {
          const report = this.compiler.interpretNode(sub);
          const errors = report.getErrors();
          this.project.refs!.push(report.getValue() as Ref);

          return errors;
        }
        case 'tablegroup': {
          const report = this.compiler.interpretNode(sub);
          const errors = report.getErrors();
          this.project.tableGroups!.push(report.getValue() as TableGroup);

          return errors;
        }
        case 'enum': {
          const report = this.compiler.interpretNode(sub);
          const errors = report.getErrors();
          this.project.enums!.push(report.getValue() as Enum);

          return errors;
        }
        case 'note': {
          this.project.note = {
            value: normalizeNoteContent(extractQuotedStringToken(
              sub.body instanceof BlockExpressionNode
                ? (sub.body.body[0] as FunctionApplicationNode).callee
                : sub.body!.callee,
            )!),
            token: getTokenPosition(sub),
          };
          return [];
        }
        case 'tablepartial': {
          const report = this.compiler.interpretNode(sub);
          const errors = report.getErrors();
          this.project.tablePartials!.push(report.getValue() as TablePartial);
          return errors;
        }
        default: {
          (this.project as Record<string, unknown>)[sub.type!.value.toLowerCase()] = extractQuotedStringToken((sub.body as FunctionApplicationNode).callee);

          return [];
        }
      }
    });
  }
}
