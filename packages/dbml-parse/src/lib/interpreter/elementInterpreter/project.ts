import { extractQuotedStringToken } from '../../analyzer/utils';
import { CompileError } from '../../errors';
import {
 BlockExpressionNode, ElementDeclarationNode, FunctionApplicationNode, SyntaxNode,
} from '../../parser/nodes';
import { ElementInterpreter, InterpreterDatabase, Project } from '../types';
import { extractElementName, getTokenPosition } from '../utils';
import { EnumInterpreter } from './enum';
import { RefInterpreter } from './ref';
import { TableInterpreter } from './table';
import { TableGroupInterpreter } from './tableGroup';

export class ProjectInterpreter implements ElementInterpreter {
  private declarationNode: ElementDeclarationNode;
  private env: InterpreterDatabase;
  private project: Partial<Project>;

  constructor(declarationNode: ElementDeclarationNode, env: InterpreterDatabase) {
    this.declarationNode = declarationNode;
    this.env = env;
    this.project = {
 enums: [], refs: [], tableGroups: [], tables: [],
};
  }

  interpret(): CompileError[] {
    this.env.project.set(this.declarationNode, this.project as Project);
    const errors = [...this.interpretName(this.declarationNode.name), ...this.interpretBody(this.declarationNode.body as BlockExpressionNode)];

    return errors;
  }

  private interpretName(nameNode?: SyntaxNode): CompileError[] {
    if (!nameNode) {
      this.project.name = null;

    return [];
    }

    const { name } = extractElementName(nameNode);
    this.project.name = name;

    return [];
  }

  private interpretBody(body: BlockExpressionNode): CompileError[] {
    return body.body.flatMap((_sub) => {
      const sub = _sub as ElementDeclarationNode;
      switch (sub.type?.value.toLowerCase()) {
        case 'table': {
          const errors = (new TableInterpreter(sub, this.env)).interpret();
          this.project.tables!.push(this.env.tables.get(sub)!);

    return errors;
        }
        case 'ref': {
          const errors = (new RefInterpreter(sub, this.env)).interpret();
          this.project.refs!.push(this.env.ref.get(sub)!);

    return errors;
        }
        case 'tablegroup': {
          const errors = (new TableGroupInterpreter(sub, this.env)).interpret();
          this.project.tableGroups!.push(this.env.tableGroups.get(sub)!);

    return errors;
        }
        case 'enum': {
          const errors = (new EnumInterpreter(sub, this.env)).interpret();
          this.project.enums!.push(this.env.enums.get(sub)!);

    return errors;
        }
        case 'note': {
          this.project.note = {
            value: extractQuotedStringToken(sub.body instanceof BlockExpressionNode ? (sub.body.body[0] as FunctionApplicationNode).callee : sub.body!.callee).unwrap(),
            token: getTokenPosition(sub),
          };

    return [];
        }
        default: {
          (this.project as any)[sub.type!.value.toLowerCase()] = extractQuotedStringToken((sub.body as FunctionApplicationNode).callee).unwrap();

    return [];
        }
      }
    });
  }
}
