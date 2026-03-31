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
import UseDeclarationValidator from '@/core/analyzer/validator/validators/use';
import type { SelectiveUseInfo, WildcardUseInfo } from '@/compiler/queries/pipeline/validate';

export type ValidatorResult = {
  nodeToSymbol: NodeToSymbolMap;
  selectiveUses: SelectiveUseInfo[];
  wildcardUses: WildcardUseInfo[];
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
    this.publicSchemaSymbol.declaration = this.ast;
    this.nodeToSymbol.set(this.ast, this.publicSchemaSymbol);
  }

  validate (): Report<ValidatorResult> {
    const errors: CompileError[] = [];
    const selectiveUses: SelectiveUseInfo[] = [];
    const wildcardUses: WildcardUseInfo[] = [];

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
        const validator = new UseDeclarationValidator(
          { node: decl, filepath: this.ast.filepath },
        );
        const result = validator.validate();
        errors.push(...result.errors);
        selectiveUses.push(...result.selectiveUses);
        wildcardUses.push(...result.wildcardUses);
      }
    });

    return new Report({ nodeToSymbol: this.nodeToSymbol, selectiveUses, wildcardUses }, errors);
  }
}
