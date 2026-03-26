import Report from '@/core/report';
import { CompileError, CompileErrorCode } from '@/core/errors';
import { ElementDeclarationNode, ProgramNode, SyntaxNode, UseDeclarationNode } from '@/core/parser/nodes';
import { SchemaSymbol } from '@/core/analyzer/symbol/symbols';
import SymbolFactory from '@/core/analyzer/symbol/factory';
import { pickValidator } from '@/core/analyzer/validator/utils';
import SymbolTable from '@/core/analyzer/symbol/symbolTable';
import { SyntaxToken } from '@/core/lexer/tokens';
import { getElementKind } from '@/core/utils';
import { ElementKind } from '@/core/analyzer/types';
import { NodeToSymbolMap } from '@/core/analyzer/analyzer';
import type { Filepath, FilepathId } from '@/compiler/projectLayout';
import UseDeclarationValidator from '@/core/analyzer/validator/validators/use';

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
    { ast, filepath, nodeToSymbol }: {
      ast: ProgramNode;
      filepath: Filepath;
      nodeToSymbol?: NodeToSymbolMap;
    },
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
        const Val = pickValidator(decl as ElementDeclarationNode & { type: SyntaxToken });
        const validatorObject = new Val(
          decl as ElementDeclarationNode & { type: SyntaxToken },
          this.publicSchemaSymbol.symbolTable,
          this.nodeToSymbol,
          this.symbolFactory,
        );
        errors.push(...validatorObject.validate());
      } else if (decl instanceof UseDeclarationNode) {
        errors.push(...new UseDeclarationValidator(
          { node: decl, filepath: this.filepath, publicSymbolTable: this.publicSchemaSymbol.symbolTable, declarations: this.nodeToSymbol },
          this.symbolFactory,
          externalFilepaths,
        ).validate());
      }
    });

    const projects = this.ast.declarations.filter((e) => getElementKind(e).unwrap_or(undefined) === ElementKind.Project);
    if (projects.length > 1) {
      projects.forEach((project) => errors.push(new CompileError(CompileErrorCode.PROJECT_REDEFINED, 'Only one project can exist', project)));
    }

    return new Report({ nodeToSymbol: this.nodeToSymbol, externalFilepaths }, errors);
  }
}
