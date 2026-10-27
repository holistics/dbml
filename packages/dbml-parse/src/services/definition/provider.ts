import { Uri } from '@/services/types';
import Compiler from '@/compiler';
import { Filepath } from '@/core/types/filepath';
import { UNHANDLED } from '@/core/types/module';
import { SyntaxNode, SyntaxNodeKind, UseDeclarationNode } from '@/core/types/nodes';
import {
  Definition, DefinitionProvider, Position, TextModel,
} from '@/services/types';
import { getOffsetFromMonacoPosition, namedRefAt } from '@/services/utils';
import { isOffsetWithinSpan } from '@/core/utils/span';

export default class DBMLDefinitionProvider implements DefinitionProvider {
  private compiler: Compiler;

  constructor (compiler: Compiler) {
    this.compiler = compiler;
  }

  provideDefinition (model: TextModel, position: Position): Definition {
    const {
      uri,
    } = model;
    const filepath = Filepath.fromUri(String(model.uri));
    const offset = getOffsetFromMonacoPosition(model, position);

    // Go-to-definition on import path: jump to the imported file
    const importDef = this.resolveImportPath(filepath, offset, uri);
    if (importDef) return importDef;

    const containers = [
      ...this.compiler.container.stack(filepath, offset),
    ];
    while (containers.length !== 0) {
      const node = containers.pop();
      if (!node) continue;

      const referee = this.compiler.nodeReferee(node).getFiltered(UNHANDLED);
      if (!referee) {
        // A named Ref has no symbol: a `Metadata Ref name` header name jumps to the Ref's name
        if ([SyntaxNodeKind.PRIMARY_EXPRESSION, SyntaxNodeKind.VARIABLE].includes(node.kind)) {
          const refNameNode = namedRefAt(this.compiler, node)?.declaration.name;
          if (refNameNode) return this.toDefinition(refNameNode, uri);
        }
        continue;
      }

      let declaration: SyntaxNode | undefined;
      if (
        referee.declaration
        && [
          SyntaxNodeKind.PRIMARY_EXPRESSION,
          SyntaxNodeKind.VARIABLE,
        ].includes(node.kind)
      ) {
        ({
          declaration,
        } = referee);
      }

      if (declaration) return this.toDefinition(declaration, uri);
    }

    return [];
  }

  private toDefinition (declaration: SyntaxNode, uri: any): Definition {
    const {
      startPos, endPos,
    } = declaration;
    // Use filepath from declaration if available and in multi-file mode (uri is set)
    let definitionUri = uri;
    if (uri && declaration.filepath) {
      definitionUri = Uri.parse(declaration.filepath.toUri({ protocol: uri.scheme }));
    }

    return [
      {
        range: {
          startColumn: startPos.column + 1,
          startLineNumber: startPos.line + 1,
          endColumn: endPos.column + 1,
          endLineNumber: endPos.line + 1,
        },
        uri: definitionUri,
      },
    ];
  }

  private resolveImportPath (filepath: Filepath, offset: number, uri: any): Definition | undefined {
    const ast = this.compiler.parse.ast(filepath);
    for (const node of ast.body) {
      if (!(node instanceof UseDeclarationNode)) continue;
      if (!node.importPath || !isOffsetWithinSpan(offset, node.importPath)) continue;

      const specifier = node.importPath.value;
      if (!specifier) continue;

      const targetFilepath = this.compiler.layout.resolveFileSpecifier(filepath, specifier);
      if (!targetFilepath || !this.compiler.layout.exists(targetFilepath)) continue;

      const targetUri = uri
        ? Uri.parse(targetFilepath.toUri({ protocol: uri.scheme }))
        : uri;

      const { startPos, endPos } = node.importPath;
      return [{
        originSelectionRange: {
          startColumn: startPos.column + 1,
          startLineNumber: startPos.line + 1,
          endColumn: endPos.column + 1,
          endLineNumber: endPos.line + 1,
        },
        range: { startColumn: 1, startLineNumber: 1, endColumn: 1, endLineNumber: 1 },
        uri: targetUri,
      }];
    }
    return undefined;
  }
}
