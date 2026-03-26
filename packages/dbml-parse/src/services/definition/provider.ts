import {
  Definition, DefinitionProvider, TextModel, Position,
} from '@/services/types';
import { getOffsetFromMonacoPosition, getFilepathFromModel } from '@/services/utils';
import Compiler from '@/compiler';
import { SyntaxNode, SyntaxNodeKind } from '@/core/parser/nodes';

export default class DBMLDefinitionProvider implements DefinitionProvider {
  private compiler: Compiler;

  constructor (compiler: Compiler) {
    this.compiler = compiler;
  }

  provideDefinition (model: TextModel, position: Position): Definition {
    const { uri } = model;
    const filepath = getFilepathFromModel(model);
    const offset = getOffsetFromMonacoPosition(model, position);
    const containers = [...this.compiler.container.stack(offset, filepath)];
    while (containers.length !== 0) {
      const node = containers.pop();
      if (!node) continue;

      const referee = this.compiler.nodeReferee(node, filepath);
      if (!referee) continue;

      let declaration: SyntaxNode | undefined;
      if (
        referee.declaration
        && [
          SyntaxNodeKind.PRIMARY_EXPRESSION,
          SyntaxNodeKind.VARIABLE,
        ].includes(node.kind)
      ) {
        ({ declaration } = referee);
      }

      if (declaration) {
        const { startPos, endPos } = declaration;
        const defUri = referee.filepath.absolute !== filepath.absolute
          ? uri.with({ path: referee.filepath.absolute })
          : uri;
        return [
          {
            range: {
              startColumn: startPos.column + 1,
              startLineNumber: startPos.line + 1,
              endColumn: endPos.column + 1,
              endLineNumber: endPos.line + 1,
            },
            uri: defUri,
          },
        ];
      }
    }

    return [];
  }
}
