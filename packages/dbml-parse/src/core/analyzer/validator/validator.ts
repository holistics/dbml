import Report from '@/core/report';
import { CompileError, CompileErrorCode } from '@/core/errors';
import { ElementDeclarationNode, ProgramNode } from '@/core/parser/nodes';
import { SchemaSymbol } from '@/core/analyzer/symbol/symbols';
import SymbolFactory from '@/core/analyzer/symbol/factory';
import { pickValidator } from '@/core/analyzer/validator/utils';
import SymbolTable from '@/core/analyzer/symbol/symbolTable';
import { SyntaxToken } from '@/core/lexer/tokens';
import { getElementKind } from '@/core/analyzer/utils';
import { ElementKind } from '@/core/analyzer/types';

export default class Validator {
  private ast: ProgramNode;

  private publicSchemaSymbol: SchemaSymbol;

  private symbolFactory: SymbolFactory;

  constructor (ast: ProgramNode, symbolFactory: SymbolFactory) {
    this.ast = ast;
    this.symbolFactory = symbolFactory;
    this.publicSchemaSymbol = this.symbolFactory.create(SchemaSymbol, {
      symbolTable: new SymbolTable(),
    });

    this.ast.symbol = this.publicSchemaSymbol;
    this.ast.symbol.declaration = this.ast;
  }

  validate (): Report<ProgramNode> {
    const errors: CompileError[] = [];

    this.ast.body.forEach((element) => {
      element.parent = this.ast;
      if (element.type === undefined) {
        return;
      }

      const Val = pickValidator(element as ElementDeclarationNode & { type: SyntaxToken });
      const validatorObject = new Val(
        element as ElementDeclarationNode & { type: SyntaxToken },
        this.publicSchemaSymbol.symbolTable,
        this.symbolFactory,
      );
      errors.push(...validatorObject.validate());
    });

    const projects = this.ast.body.filter((e) => getElementKind(e).unwrap_or(undefined) === ElementKind.Project);
    if (projects.length > 1) {
      projects.forEach((project) => errors.push(new CompileError(CompileErrorCode.PROJECT_REDEFINED, 'Only one project can exist', project)));
    }

    return new Report(this.ast, errors);
  }
}
