import Report from '@/core/report';
import { CompileError } from '@/core/errors';
import { ElementDeclarationNode, ProgramNode, SyntaxNode, UseDeclarationNode } from '@/core/parser/nodes';
import { SchemaSymbol } from '@/core/analyzer/symbol/symbols';
import SymbolFactory from '@/core/analyzer/symbol/factory';
import { pickValidator } from '@/core/analyzer/validator/utils';
import SymbolTable from '@/core/analyzer/symbol/symbolTable';
import { SyntaxToken } from '@/core/lexer/tokens';
import { NodeToSymbolMap } from '@/core/analyzer/analyzer';
import { InternedMap } from '@/core/internable';
import type { FilepathId } from '@/compiler/projectLayout';
import UseDeclarationValidator from '@/core/analyzer/validator/validators/use';

export type ValidatorResult = {
  nodeToSymbol: NodeToSymbolMap;
  externalFilepaths: Map<FilepathId, UseDeclarationNode>;
};

export default class Validator {
  private ast: ProgramNode;

  private publicSchemaSymbol: SchemaSymbol;

  private symbolFactory: SymbolFactory;

  private nodeToSymbol: NodeToSymbolMap;

  constructor (
    { ast }: {
      ast: ProgramNode;
    },
    { nodeToSymbol }: {
      nodeToSymbol: NodeToSymbolMap;
    },
    symbolFactory: SymbolFactory,
  ) {
    this.ast = ast;
    this.symbolFactory = symbolFactory;
    this.nodeToSymbol = nodeToSymbol;
    this.publicSchemaSymbol = this.symbolFactory.create(SchemaSymbol, {
      symbolTable: new SymbolTable(),
    });
    this.nodeToSymbol.set(this.ast, this.publicSchemaSymbol);
  }

  validate (): Report<ValidatorResult> {
    const errors: CompileError[] = [];
    const externalFilepaths = new Map<FilepathId, UseDeclarationNode>();

    // Validate in source order
    this.ast.body.forEach((decl) => {
      if (decl instanceof ElementDeclarationNode) {
        if (decl.type === undefined) return;
        const Val = pickValidator(decl as ElementDeclarationNode & { type: SyntaxToken });
        const validatorObject = new Val(
          { declarationNode: decl as ElementDeclarationNode & { type: SyntaxToken }, publicSymbolTable: this.publicSchemaSymbol.symbolTable },
          { nodeToSymbol: this.nodeToSymbol },
          this.symbolFactory,
        );
        errors.push(...validatorObject.validate());
      } else if (decl instanceof UseDeclarationNode) {
        errors.push(...new UseDeclarationValidator(
          { node: decl, filepath: this.ast.filepath, publicSymbolTable: this.publicSchemaSymbol.symbolTable, declarations: this.nodeToSymbol },
          this.symbolFactory,
          externalFilepaths,
        ).validate());
      }
    });

    return new Report({ nodeToSymbol: this.nodeToSymbol, externalFilepaths }, errors);
  }
}
