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
import { NodeToSymbolMap } from '@/core/analyzer/analyzer';

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

    this.ast.body.forEach((element) => {
      if (element.type === undefined) {
        return;
      }

      const Val = pickValidator(element as ElementDeclarationNode & { type: SyntaxToken });
      const validatorObject = new Val(
        element as ElementDeclarationNode & { type: SyntaxToken },
        this.publicSchemaSymbol.symbolTable,
        this.symbolFactory,
        this.nodeToSymbol,
      );
      errors.push(...validatorObject.validate());
    });

    const projects = this.ast.body.filter((e) => getElementKind(e).unwrap_or(undefined) === ElementKind.Project);
    if (projects.length > 1) {
      projects.forEach((project) => errors.push(new CompileError(CompileErrorCode.PROJECT_REDEFINED, 'Only one project can exist', project)));
    }

    return new Report(this.nodeToSymbol, errors);
  }
}
