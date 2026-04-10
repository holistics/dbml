import {
  Definition, DefinitionProvider, TextModel, Position,
} from '@/services/types';
import { getOffsetFromMonacoPosition } from '@/services/utils';
import Compiler from '@/compiler';
import { SyntaxNode, SyntaxNodeKind } from '@/core/types/nodes';
import { UNHANDLED } from '@/constants';
import { Filepath } from '@/core/types/filepath';

export default class DBMLDefinitionProvider implements DefinitionProvider {
  private compiler: Compiler;

  constructor (compiler: Compiler) {
    this.compiler = compiler;
  }

  provideDefinition (model: TextModel, position: Position): Definition {
    const { uri } = model;
    const offset = getOffsetFromMonacoPosition(model, position);
    const containers = [...this.compiler.container.stack(offset)];
    while (containers.length !== 0) {
      const node = containers.pop();
      if (!node) continue;

      const refereeResult = this.compiler.nodeReferee(node);
      if (refereeResult.hasValue(UNHANDLED)) continue;
      const referee = refereeResult.getValue();
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
        // Use filepath from declaration if available and in multi-file mode (uri is set)
        let definitionUri = uri;
        if (uri) {
          const declarationFilepath = (declaration as any).filepath as Filepath | undefined;
          if (declarationFilepath) {
            definitionUri = declarationFilepath.toUri();
          }
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
    }

    return [];
  }
}
