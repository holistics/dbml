import {
  Definition, DefinitionProvider, TextModel, Position,
} from '@/services/types';
import { getOffsetFromMonacoPosition } from '@/services/utils';
import Compiler from '@/compiler';
import { SyntaxNode, SyntaxNodeKind } from '@/core/parser/nodes';

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

      if (!node?.referee) continue;

      let declaration: SyntaxNode | undefined;
      if (
        node.referee?.declaration
        && [
          SyntaxNodeKind.PRIMARY_EXPRESSION,
          SyntaxNodeKind.VARIABLE,
          SyntaxNodeKind.PARTIAL_INJECTION,
        ].includes(node?.kind)
      ) {
        ({ declaration } = node.referee);
      } else if (node.referee?.injectorDeclaration) {
        declaration = node.referee.injectorDeclaration;
      }

      if (declaration) {
        const { startPos, endPos } = declaration;
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
