import Report from '@/core/report';
import { CompileError, CompileErrorCode } from '@/core/errors';
import { ElementDeclarationNode, ProgramNode } from '@/core/parser/nodes';
import { SchemaSymbol } from '@/core/analyzer/symbol/symbols';
import SymbolFactory from '@/core/analyzer/symbol/factory';
import { pickElementValidator } from '@/core/analyzer/validator/utils';
import SymbolTable from '@/core/analyzer/symbol/symbolTable';
import { SyntaxToken } from '@/core/lexer/tokens';
import { getElementKind } from '@/core/analyzer/utils';
import { ElementKind } from '@/core/analyzer/types';
import { NodeToSymbolMap } from '@/core/analyzer/analyzer';
import UseDeclarationValidator from '@/core/analyzer/validator/validators/use';

export default class Validator {
  private ast: ProgramNode;

  private publicSchemaSymbol: SchemaSymbol;

  private symbolFactory: SymbolFactory;

  private nodeToSymbol: NodeToSymbolMap;

  constructor ({ ast }: { ast: ProgramNode }, symbolFactory: SymbolFactory) {
    this.ast = ast;
    this.symbolFactory = symbolFactory;
    this.nodeToSymbol = new WeakMap();
    this.publicSchemaSymbol = this.symbolFactory.create(SchemaSymbol, {
      symbolTable: new SymbolTable(),
    });

    this.nodeToSymbol.set(this.ast, this.publicSchemaSymbol);
  }

  validate (): Report<NodeToSymbolMap> {
    const errors: CompileError[] = [];

    this.ast.declarations.forEach((decl) => {
      if (decl instanceof ElementDeclarationNode) {
        if (decl.type === undefined) {
          return;
        }
        const Val = pickElementValidator(decl as ElementDeclarationNode & { type: SyntaxToken });
        const validatorObject = new Val(
          {
            declarationNode: decl as ElementDeclarationNode & { type: SyntaxToken },
            publicSymbolTable: this.publicSchemaSymbol.symbolTable,
            nodeToSymbol: this.nodeToSymbol,
          },
          this.symbolFactory,
        );
        errors.push(...validatorObject.validate().errors);
        return;
      }

      errors.push(...new UseDeclarationValidator(decl, this.publicSchemaSymbol.symbolTable, this.nodeToSymbol, this.symbolFactory).validate());
    });

    const projects = this.ast.declarations.filter((e) => getElementKind(e).unwrap_or(undefined) === ElementKind.Project);
    if (projects.length > 1) {
      projects.forEach((project) => errors.push(new CompileError(CompileErrorCode.PROJECT_REDEFINED, 'Only one project can exist', project)));
    }

    return new Report(this.nodeToSymbol, errors);
  }
}
