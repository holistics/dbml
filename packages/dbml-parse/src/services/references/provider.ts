import {
  Uri,
} from 'monaco-editor-core';
import Compiler from '@/compiler';
import {
  DEFAULT_ENTRY,
} from '@/constants';
import {
  Filepath,
} from '@/core/types/filepath';
import {
  UNHANDLED,
} from '@/core/types/module';
import {
  SyntaxNodeKind,
} from '@/core/types/nodes';
import {
  Location, Position, ReferenceProvider, TextModel,
} from '@/services/types';
import {
  extractReferee, getOffsetFromMonacoPosition,
} from '@/services/utils';

export default class DBMLReferencesProvider implements ReferenceProvider {
  private compiler: Compiler;

  constructor (compiler: Compiler) {
    this.compiler = compiler;
  }

  provideReferences (model: TextModel, position: Position): Location[] {
    const {
      uri,
    } = model;
    const offset = getOffsetFromMonacoPosition(model, position);
    const filepath = uri ? Filepath.fromUri(String(uri)) : DEFAULT_ENTRY;

    // Ensure binding is done before resolving references
    this.compiler.bindProject();

    const containers = [
      ...this.compiler.container.stack(filepath, offset),
    ];
    while (containers.length !== 0) {
      const node = containers.pop();
      if (
        node
        && [
          SyntaxNodeKind.ELEMENT_DECLARATION,
          SyntaxNodeKind.FUNCTION_APPLICATION,
          SyntaxNodeKind.PRIMARY_EXPRESSION,
        ].includes(node?.kind)
      ) {
        // Try nodeSymbol first (for declarations), then nodeReferee (for reference positions)
        const symbol = this.compiler.nodeSymbol(node).getFiltered(UNHANDLED) ?? extractReferee(this.compiler, node);
        const referencesResult = symbol ? this.compiler.symbolReferences(symbol) : undefined;
        if (referencesResult && !referencesResult.hasValue(UNHANDLED)) {
          const references = referencesResult.getValue();
          if (references && references.length > 0) {
            return references.map((refNode) => {
              // Use filepath from reference node if available and in multi-file mode (uri is set)
              let refUri: any = uri;
              if (uri && refNode.filepath) {
                refUri = Uri.parse(refNode.filepath.toUri());
              }

              return {
                range: {
                  startColumn: refNode.startPos.column + 1,
                  startLineNumber: refNode.startPos.line + 1,
                  endColumn: refNode.endPos.column + 1,
                  endLineNumber: refNode.endPos.line + 1,
                },
                uri: refUri,
              };
            });
          }
        }
      }
    }

    return [];
  }
}
