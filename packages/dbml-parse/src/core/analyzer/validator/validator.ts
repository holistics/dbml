import {
  DEFAULT_SCHEMA_NAME,
} from '@/constants';
import {
  ElementKind,
} from '@/core/types/keywords';
import {
  pickValidator,
} from '@/core/analyzer/validator/utils';
import {
  CompileError, CompileErrorCode, CompileWarning,
} from '@/core/types/errors';
import {
  ElementDeclarationNode, ProgramNode,
} from '@/core/types/nodes';
import Report from '@/core/types/report';
import SymbolFactory from '@/core/types/symbol/factory';
import SymbolTable from '@/core/types/symbol/symbolTable';
import {
  SchemaSymbol,
} from '@/core/types/symbol/symbols';
import {
  SyntaxToken,
} from '@/core/types/tokens';

export default class Validator {
  private ast: ProgramNode;

  private publicSchemaSymbol: SchemaSymbol;

  private symbolFactory: SymbolFactory;

  constructor (ast: ProgramNode, symbolFactory: SymbolFactory) {
    this.ast = ast;
    this.symbolFactory = symbolFactory;
    this.publicSchemaSymbol = this.symbolFactory.create(SchemaSymbol, {
      symbolTable: new SymbolTable(),
      name: DEFAULT_SCHEMA_NAME,
    });

    this.ast.symbol = this.publicSchemaSymbol;
    this.ast.symbol.declaration = this.ast;
  }

  validate (): Report<ProgramNode> {
    const errors: CompileError[] = [];
    const warnings: CompileWarning[] = [];

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
      const result = validatorObject.validate();
      errors.push(...result.errors);
      warnings.push(...result.warnings);
    });

    const projects = this.ast.body.filter((e) => e.isKind(ElementKind.Project));
    if (projects.length > 1) {
      projects.forEach((project) => errors.push(new CompileError(CompileErrorCode.PROJECT_REDEFINED, 'Only one project can exist', project)));
    }

    return new Report(this.ast, errors, warnings);
  }
}
