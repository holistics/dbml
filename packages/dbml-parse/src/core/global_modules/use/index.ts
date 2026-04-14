import Compiler from '@/compiler';
import {
  CompileError, CompileErrorCode,
} from '@/core/types/errors';
import {
  Filepath, resolveImportFilepath,
} from '@/core/types/filepath';
import {
  PASS_THROUGH, type PassThrough, UNHANDLED,
} from '@/core/types/module';
import {
  InfixExpressionNode, SyntaxNode, UseDeclarationNode, UseSpecifierListNode, UseSpecifierNode,
} from '@/core/types/nodes';
import Report from '@/core/types/report';
import type {
  SchemaElement,
} from '@/core/types/schemaJson';
import {
  NodeSymbol, SymbolKind, UseSymbol,
} from '@/core/types/symbol';
import {
  destructureComplexVariable,
  extractVariableFromExpression,
  isAccessExpression,
  isDotDelimitedIdentifier,
  isExpressionAVariableNode,
  isUseDeclaration,
  isUseSpecifier,
} from '@/core/utils/expression';
import {
  GlobalModule,
} from '../types';
import {
  lookupMember,
} from '../utils';

export const useModule: GlobalModule = {
  nodeSymbol (compiler: Compiler, node: SyntaxNode): Report<NodeSymbol> | Report<PassThrough> {
    if (!isUseSpecifier(node) || !node.name) return Report.create(PASS_THROUGH);

    const symbolKind = node.getSymbolKind();
    if (symbolKind === undefined) return Report.create(PASS_THROUGH);
    // Imported schemas are merged into the existing SchemaSymbol hierarchy, not wrapped in UseSymbol.
    if (symbolKind === SymbolKind.Schema) return Report.create(PASS_THROUGH);

    const originalSymbol = compiler.nodeReferee(node.name).getFiltered(UNHANDLED);

    return Report.create(compiler.symbolFactory.create(
      UseSymbol,
      {
        useSpecifierDeclaration: node,
        declaration: originalSymbol?.declaration,
        usedSymbol: originalSymbol,
        kind: symbolKind,
      },
      node.filepath,
    ));
  },

  nodeReferee (compiler: Compiler, node: SyntaxNode): Report<NodeSymbol | undefined> | Report<PassThrough> {
    if (!isExpressionAVariableNode(node) && !isDotDelimitedIdentifier(node)) return Report.create(PASS_THROUGH);

    const useSpecifier = node.parentOfKind(UseSpecifierNode);
    if (!useSpecifier) return Report.create(PASS_THROUGH);

    // `node` is the terminal name fragment when it IS the specifier name,
    // or is the rightmost part of a qualified name (e.g. `table` in `public.table`).
    // Otherwise it's a schema prefix → always resolved as Schema.
    const isTerminalFragment = useSpecifier.name === node
      || (isAccessExpression(useSpecifier.name) && useSpecifier.name.rightExpression === node);
    const symbolKind = isTerminalFragment ? useSpecifier.getSymbolKind() : SymbolKind.Schema;
    if (symbolKind === undefined) return Report.create(undefined);

    const fullname = destructureComplexVariable(node.parentOfKind(InfixExpressionNode));
    const name = extractVariableFromExpression(node) ?? fullname?.at(-1);
    if (name === undefined) return Report.create(undefined);

    const useDeclaration = node.parentOfKind(UseDeclarationNode);
    if (useDeclaration?.importPath?.value === undefined) return Report.create(undefined);

    const importPath = resolveImportFilepath(node.filepath, useDeclaration.importPath.value);
    if (!importPath) return Report.create(undefined);

    if (!compiler.layout.exists(importPath)) return Report.create(
      undefined,
      [
        new CompileError(CompileErrorCode.NONEXISTENT_MODULE, `${symbolKind} '${fullname?.join('.') ?? name}' does not exist in file ${importPath.toString()}. Does the file exist?`, node),
      ],
    );

    const leftNode = node.parentOfKind(InfixExpressionNode)?.leftExpression;
    if (leftNode && leftNode !== node) {
      const parentSymbol = compiler.nodeReferee(leftNode).getFiltered(UNHANDLED);
      if (!parentSymbol) return Report.create(undefined);

      return lookupMember(compiler, parentSymbol, name, {
        kinds: [
          symbolKind,
        ],
        errorNode: node,
      });
    }

    const found = lookupMemberInFilepath(compiler, importPath, name, symbolKind);
    if (found) return Report.create(found);

    return Report.create(
      undefined,
      [
        new CompileError(CompileErrorCode.BINDING_ERROR, `${symbolKind} '${name}' does not exist in file ${importPath.toString()}`, node),
      ],
    );
  },

  bindNode (compiler: Compiler, node: SyntaxNode): Report<void> | Report<PassThrough> {
    if (isUseDeclaration(node)) {
      const errors: CompileError[] = [];
      if (node.importPath?.value) {
        const importPath = resolveImportFilepath(node.filepath, node.importPath.value);
        if (importPath && !compiler.layout.exists(importPath)) {
          errors.push(new CompileError(
            CompileErrorCode.NONEXISTENT_MODULE,
            `Failed to resolve the non-existent file '${node.importPath.value}'`,
            node.importPath,
          ));
        }
      }

      if (node.specifiers) {
        const res = compiler.bindNode(node.specifiers);
        errors.push(...res.getErrors());
      }

      return new Report(undefined, errors);
    }

    if (node instanceof UseSpecifierListNode) {
      const errors = node.specifiers.flatMap((s) => compiler.bindNode(s).getErrors());

      return new Report(undefined, errors);
    }

    if (isUseSpecifier(node)) {
      // Call nodeReferee on the name expression (not the specifier itself) so that
      // kind-mismatch and nonexistent-name errors are produced during binding.
      if (!node.name) return new Report(undefined);
      const errors = compiler.nodeReferee(node.name).getErrors();

      return new Report(undefined, errors);
    }

    return Report.create(PASS_THROUGH);
  },

  interpretNode (compiler: Compiler, node: SyntaxNode): Report<SchemaElement | SchemaElement[] | undefined> | Report<PassThrough> {
    if (!isUseSpecifier(node)) return Report.create(PASS_THROUGH);

    const symbolResult = compiler.nodeSymbol(node);
    if (symbolResult.hasValue(UNHANDLED)) return Report.create(undefined);
    const symbol = symbolResult.getValue();
    if (!(symbol instanceof UseSymbol) || !symbol.usedSymbol || !symbol.usedSymbol.declaration) return Report.create(undefined);

    const result = compiler.interpretNode(symbol.usedSymbol.declaration);
    if (result.hasValue(UNHANDLED)) return Report.create(undefined);

    const value = result.getValue();
    if (!value || Array.isArray(value)) return result;

    const name = compiler.symbolName(symbol);

    if (name && 'name' in value) {
      return Report.create({
        ...value,
        name,
      } as typeof value);
    }

    return Report.create(value);
  },
};

function lookupMemberInFilepath (compiler: Compiler, importPath: Filepath | undefined, name: string, symbolKind: SymbolKind, visited: Set<Filepath> = new Set()): NodeSymbol | undefined {
  if (!importPath || visited.has(importPath)) return undefined;
  visited.add(importPath);

  const usable = compiler.fileUsableMembers(importPath).getFiltered(UNHANDLED);
  if (!usable) return undefined;

  // 1. Direct non-schema members
  const directMember = usable.nonSchemaMembers.find((m) => compiler.symbolName(m) === name);
  if (directMember && directMember.isKind(symbolKind)) {
    return directMember;
  }

  // 2. Direct schema members
  const directSchema = usable.schemaMembers.find((m) => m.name === name);
  if (directSchema && directSchema.isKind(SymbolKind.Schema)) {
    return directSchema;
  }

  // 3. Selective reuses
  for (const specifier of usable.reuses.selective) {
    if (destructureComplexVariable(specifier.alias ?? specifier.name)?.at(-1) === name) {
      return compiler.nodeSymbol(specifier).getFiltered(UNHANDLED);
    }
  }

  // 4. Wildcard reuses
  for (const {
    importPath: wildcardPath,
  } of usable.reuses.wildcard) {
    const member = lookupMemberInFilepath(compiler, wildcardPath, name, symbolKind, visited);
    if (member) return member;
  }

  return undefined;
}
