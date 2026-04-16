import {
  Uri,
} from '@/services/types';
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
  SyntaxNode, SyntaxNodeKind,
} from '@/core/types/nodes';
import {
  Definition, DefinitionProvider, Position, TextModel,
} from '@/services/types';
import {
  getOffsetFromMonacoPosition,
} from '@/services/utils';

export default class DBMLDefinitionProvider implements DefinitionProvider {
  private compiler: Compiler;

  constructor (compiler: Compiler) {
    this.compiler = compiler;
  }

  provideDefinition (model: TextModel, position: Position): Definition {
    const {
      uri,
    } = model;
    const offset = getOffsetFromMonacoPosition(model, position);
    const filepath = uri ? Filepath.fromUri(String(uri)) : DEFAULT_ENTRY;
    const containers = [
      ...this.compiler.container.stack(filepath, offset),
    ];
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
        ({
          declaration,
        } = referee);
      }

      if (declaration) {
        const {
          startPos, endPos,
        } = declaration;
        // Use filepath from declaration if available and in multi-file mode (uri is set)
        let definitionUri = uri;
        if (uri && declaration.filepath) {
          definitionUri = Uri.parse(declaration.filepath.toUri());
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
