import Report from '@/core/report';
import { CompileError, CompileErrorCode } from '@/core/errors';
import { ElementDeclarationNode, ProgramNode, SyntaxNode, UseDeclarationNode } from '@/core/parser/nodes';
import { SchemaSymbol } from '@/core/validator/symbol/symbols';
import SymbolFactory from '@/core/validator/symbol/factory';
import { pickElementValidator } from '@/core/validator/utils';
import SymbolTable from '@/core/validator/symbol/symbolTable';
import { SyntaxToken } from '@/core/lexer/tokens';
import { getElementKind } from '@/core/utils';
import { ElementKind } from '@/core/types';
import { NodeToSymbolMap } from '@/core/types';
import type { Filepath, FilepathId } from '@/compiler/projectLayout';
import UseDeclarationValidator from '@/core/validator/validators/use';

export type ValidatorResult = {
  nodeToSymbol: NodeToSymbolMap;
  externalFilepaths: Map<FilepathId, UseDeclarationNode>;
};

export default class Validator {
  private ast: ProgramNode;

  private filepath: Filepath;

  private publicSchemaSymbol: SchemaSymbol;

  private symbolFactory: SymbolFactory;

  private nodeToSymbol: NodeToSymbolMap;

  constructor (
    { ast, filepath, nodeToSymbol }: { ast: ProgramNode; filepath: Filepath; nodeToSymbol?: NodeToSymbolMap },
    symbolFactory: SymbolFactory,
  ) {
    this.ast = ast;
    this.filepath = filepath;
    this.symbolFactory = symbolFactory;
    this.nodeToSymbol = nodeToSymbol ?? new Map();
    this.publicSchemaSymbol = (nodeToSymbol?.get(ast) ?? this.symbolFactory.create(SchemaSymbol, {
      symbolTable: new SymbolTable(),
    })) as SchemaSymbol;
    this.nodeToSymbol.set(this.ast, this.publicSchemaSymbol);
  }

  validate (): Report<ValidatorResult> {
    const errors: CompileError[] = [];
    const externalFilepaths = new Map<FilepathId, UseDeclarationNode>();

    // Validate in source order
    this.ast.body.forEach((decl) => {
      if (decl instanceof ElementDeclarationNode) {
        if (decl.type === undefined) return;
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
      } else {
        errors.push(...new UseDeclarationValidator(
          { node: decl, filepath: this.filepath, publicSymbolTable: this.publicSchemaSymbol.symbolTable, declarations: this.nodeToSymbol },
          this.symbolFactory,
          externalFilepaths,
        ).validate());
      }
    });

    const projects = this.ast.declarations.filter((e) => getElementKind(e).unwrap_or(undefined) === ElementKind.Project);
    if (projects.length > 1) {
      projects.forEach((project) => errors.push(new CompileError(CompileErrorCode.PROJECT_REDEFINED, 'Only one project can exist', project, this.symbolFactory.filepath)));
    }

    return new Report({ nodeToSymbol: this.nodeToSymbol, externalFilepaths }, errors);
  }
}
