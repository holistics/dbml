import { getOffsetFromMonacoPosition } from '../utils';
import Compiler from '../../compiler';
import { SyntaxNodeKind } from '../../lib/parser/nodes';
import {
 Location, ReferenceProvider, TextModel, Position,
} from '../types';

export default class DBMLReferencesProvider implements ReferenceProvider {
  private compiler: Compiler;

  constructor(compiler: Compiler) {
    this.compiler = compiler;
  }

  provideReferences(model: TextModel, position: Position): Location[] {
    const { uri } = model;
    const offset = getOffsetFromMonacoPosition(model, position);

    const containers = [...this.compiler.container.stack(offset)];
    while (containers.length !== 0) {
      const node = containers.pop();
      if (
        node &&
        [
          SyntaxNodeKind.ELEMENT_DECLARATION,
          SyntaxNodeKind.FUNCTION_APPLICATION,
          SyntaxNodeKind.PRIMARY_EXPRESSION,
        ].includes(node?.kind)
      ) {
        const { symbol } = node;
        if (symbol?.references.length) {
          return symbol.references.map(({ startPos, endPos }) => ({
            range: {
              startColumn: startPos.column + 1,
              startLineNumber: startPos.line + 1,
              endColumn: endPos.column + 1,
              endLineNumber: endPos.line + 1,
            },
            uri,
          }));
        }
      }
    }

    return [];
  }
}
