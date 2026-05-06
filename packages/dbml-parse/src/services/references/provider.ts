import Compiler from '@/compiler';
import {
  Filepath,
} from '@/core/types';
import {
  SyntaxNodeKind,
} from '@/core/types/nodes';
import {
  Location, Position, ReferenceProvider, TextModel,
  Uri,
} from '@/services/types';
import {
  getOffsetFromMonacoPosition,
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
    const filepath = Filepath.fromUri(String(model.uri));
    const offset = getOffsetFromMonacoPosition(model, position);

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
        const {
          symbol,
        } = node;
        if (symbol?.references.length) {
          return symbol.references.map(({
            startPos, endPos,
          }) => ({
            range: {
              startColumn: startPos.column + 1,
              startLineNumber: startPos.line + 1,
              endColumn: endPos.column + 1,
              endLineNumber: endPos.line + 1,
            },
            uri: Uri.parse(filepath.toUri()),
          }));
        }
      }
    }

    return [];
  }
}
