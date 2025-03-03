import {
 Definition, DefinitionProvider, TextModel, Position,
} from '../types';
import { getOffsetFromMonacoPosition } from '../utils';
import Compiler from '../../compiler';
import { SyntaxNodeKind } from '../../lib/parser/nodes';

export default class DBMLDefinitionProvider implements DefinitionProvider {
  private compiler: Compiler;

  constructor(compiler: Compiler) {
    this.compiler = compiler;
  }

  provideDefinition(model: TextModel, position: Position): Definition {
    const { uri } = model;
    const offset = getOffsetFromMonacoPosition(model, position);
    const containers = [...this.compiler.container.stack(offset)];
    while (containers.length !== 0) {
      const node = containers.pop()!;
      if (
        node?.referee?.declaration &&
        [SyntaxNodeKind.PRIMARY_EXPRESSION, SyntaxNodeKind.VARIABLE].includes(node?.kind)
      ) {
        const { startPos, endPos } = node.referee.declaration;

        return [
          {
            range: {
              startColumn: startPos.column + 1,
              startLineNumber: startPos.line + 1,
              endColumn: endPos.column + 1,
              endLineNumber: endPos.line + 1,
            },
            uri,
          },
        ];
      }
    }

    return [];
  }
}
