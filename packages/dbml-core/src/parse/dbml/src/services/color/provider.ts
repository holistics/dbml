import Compiler from '../../compiler';
import { SyntaxTokenKind } from '../../lib/lexer/tokens';
import {
 ColorInformation, ColorPresentation, DocumentColorProvider, TextModel,
} from '../types';

export default class DBMLDocumentColorProvider implements DocumentColorProvider {
  private compiler: Compiler;

  constructor(compiler: Compiler) {
    this.compiler = compiler;
  }

  provideColorPresentations(model: TextModel, colorInfo: ColorInformation): ColorPresentation[] {
    const { red, green, blue } = colorInfo.color;

    return [
      {
        label: `rgb(${red}, ${green}, ${blue})`,
      },
    ];
  }

  provideDocumentColors(): ColorInformation[] {
    const tokens = this.compiler.parse.tokens();

    return tokens
      .filter(({ kind, isInvalid }) => kind === SyntaxTokenKind.COLOR_LITERAL && !isInvalid)
      .map(({ value, startPos }) => {
        const red = Number.parseInt(
          value.length === 7 ? `${value[1]}${value[2]}` : `${value[1]}${value[1]}`,
          16,
        );
        const green = Number.parseInt(
          value.length === 7 ? `${value[3]}${value[4]}` : `${value[2]}${value[2]}`,
          16,
        );
        const blue = Number.parseInt(
          value.length === 7 ? `${value[5]}${value[6]}` : `${value[3]}${value[3]}`,
          16,
        );

        return {
          color: {
            red,
            green,
            blue,
            alpha: 1,
          },
          range: {
            startLineNumber: startPos.line + 1,
            startColumn: startPos.column + 1,
            endLineNumber: startPos.column + 1,
            endColumn: startPos.column + 1,
          },
        };
      });
  }
}
