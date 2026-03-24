import { getOffsetFromMonacoPosition, getFilepathFromModel } from '@/services/utils';
import Compiler from '@/compiler';
import { SyntaxNodeKind } from '@/core/parser/nodes';
import {
  Location, ReferenceProvider, TextModel, Position,
} from '@/services/types';

export default class DBMLReferencesProvider implements ReferenceProvider {
  private compiler: Compiler;

  constructor (compiler: Compiler) {
    this.compiler = compiler;
  }

  provideReferences (model: TextModel, position: Position): Location[] {
    const { uri } = model;
    const filepath = getFilepathFromModel(model);
    const offset = getOffsetFromMonacoPosition(model, position);

    const containers = [...this.compiler.container.stack(offset, filepath)];
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
        const symbol = this.compiler.symbol.nodeSymbol(node, filepath);
        const references = symbol ? this.compiler.symbol.nodeReferences(node, filepath) : undefined;
        if (references?.length) {
          return references.map(({ startPos, endPos }: { startPos: any; endPos: any }) => ({
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
