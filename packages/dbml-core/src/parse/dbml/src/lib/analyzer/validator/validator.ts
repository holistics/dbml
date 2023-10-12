import Report from '../../report';
import { CompileError } from '../../errors';
import { ElementDeclarationNode, ProgramNode } from '../../parser/nodes';
import { ContextStack } from './validatorContext';
import { SchemaSymbol } from '../symbol/symbols';
import SymbolFactory from '../symbol/factory';
import { pickValidator } from './utils';
import { ElementKind } from './types';
import SymbolTable from '../symbol/symbolTable';
import { SyntaxToken } from '../../lexer/tokens';

export default class Validator {
  private ast: ProgramNode;

  private publicSchemaSymbol: SchemaSymbol;

  private contextStack: ContextStack;

  private kindsGloballyFound: Set<ElementKind>;
  private kindsLocallyFound: Set<ElementKind>;

  private errors: CompileError[];

  private symbolFactory: SymbolFactory;

  constructor(ast: ProgramNode, symbolFactory: SymbolFactory) {
    this.ast = ast;
    this.contextStack = new ContextStack();
    this.errors = [];
    this.symbolFactory = symbolFactory;
    this.publicSchemaSymbol = this.symbolFactory.create(SchemaSymbol, {
      symbolTable: new SymbolTable(),
    });
    this.kindsGloballyFound = new Set();
    this.kindsLocallyFound = new Set();

    this.ast.symbol = this.publicSchemaSymbol;
    this.ast.symbol.declaration = this.ast;
  }

  validate(): Report<ProgramNode, CompileError> {
    this.ast.body.forEach((_element) => {
      // eslint-disable-next-line no-param-reassign
      _element.parent = this.ast;
      if (_element.type === undefined) {
        return;
      }
      const element = _element as ElementDeclarationNode & { type: SyntaxToken };

      const Val = pickValidator(element);
      const validatorObject = new Val(
        element,
        this.publicSchemaSymbol,
        this.contextStack,
        this.errors,
        this.kindsGloballyFound,
        this.kindsLocallyFound,
        this.symbolFactory,
      );
      validatorObject.validate();
    });

    return new Report(this.ast, this.errors);
  }
}
