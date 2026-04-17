import type {
  Component,
} from 'vue';
import {
  SyntaxTokenKind,
} from '@dbml/parse';
import {
  PhIdentificationCard,
  PhQuotes,
  PhTextAa,
  PhNumberSquareOne,
  PhPalette,
  PhLightning,
  PhBracketsCurly,
  PhBracketsRound,
  PhBracketsSquare,
  PhBracketsAngle,
  PhStar,
  PhFlagCheckered,
  PhMathOperations,
  PhArticle,
  PhAsterisk,
  PhArrowsHorizontal,
  PhKeyReturn,
  PhQuestion,
} from '@phosphor-icons/vue';

export interface TokenIconInfo { icon: Component;
  color: string; }

export const TOKEN_ICON_MAP: Partial<Record<SyntaxTokenKind, TokenIconInfo>> = {
  [SyntaxTokenKind.IDENTIFIER]: { icon: PhIdentificationCard, color: 'text-blue-500' },
  [SyntaxTokenKind.QUOTED_STRING]: { icon: PhQuotes, color: 'text-violet-500' },
  [SyntaxTokenKind.STRING_LITERAL]: { icon: PhTextAa, color: 'text-green-600' },
  [SyntaxTokenKind.NUMERIC_LITERAL]: { icon: PhNumberSquareOne, color: 'text-amber-500' },
  [SyntaxTokenKind.COLOR_LITERAL]: { icon: PhPalette, color: 'text-pink-500' },
  [SyntaxTokenKind.FUNCTION_EXPRESSION]: { icon: PhLightning, color: 'text-orange-500' },
  [SyntaxTokenKind.OP]: { icon: PhMathOperations, color: 'text-red-500' },
  [SyntaxTokenKind.LPAREN]: { icon: PhBracketsRound, color: 'text-cyan-500' },
  [SyntaxTokenKind.RPAREN]: { icon: PhBracketsRound, color: 'text-cyan-500' },
  [SyntaxTokenKind.LBRACE]: { icon: PhBracketsCurly, color: 'text-cyan-500' },
  [SyntaxTokenKind.RBRACE]: { icon: PhBracketsCurly, color: 'text-cyan-500' },
  [SyntaxTokenKind.LBRACKET]: { icon: PhBracketsSquare, color: 'text-cyan-500' },
  [SyntaxTokenKind.RBRACKET]: { icon: PhBracketsSquare, color: 'text-cyan-500' },
  [SyntaxTokenKind.LANGLE]: { icon: PhBracketsAngle, color: 'text-cyan-500' },
  [SyntaxTokenKind.RANGLE]: { icon: PhBracketsAngle, color: 'text-cyan-500' },
  [SyntaxTokenKind.COMMA]: { icon: PhAsterisk, color: 'text-gray-400' },
  [SyntaxTokenKind.SEMICOLON]: { icon: PhAsterisk, color: 'text-gray-400' },
  [SyntaxTokenKind.COLON]: { icon: PhAsterisk, color: 'text-gray-400' },
  [SyntaxTokenKind.SPACE]: { icon: PhArrowsHorizontal, color: 'text-gray-300' },
  [SyntaxTokenKind.TAB]: { icon: PhArrowsHorizontal, color: 'text-gray-300' },
  [SyntaxTokenKind.NEWLINE]: { icon: PhKeyReturn, color: 'text-gray-300' },
  [SyntaxTokenKind.SINGLE_LINE_COMMENT]: { icon: PhArticle, color: 'text-gray-400' },
  [SyntaxTokenKind.MULTILINE_COMMENT]: { icon: PhArticle, color: 'text-gray-400' },
  [SyntaxTokenKind.WILDCARD]: { icon: PhStar, color: 'text-yellow-500' },
  [SyntaxTokenKind.EOF]: { icon: PhFlagCheckered, color: 'text-red-400' },
};

const FALLBACK: TokenIconInfo = {
  icon: PhQuestion,
  color: 'text-gray-400',
};

export function tokenIconFor (kind: SyntaxTokenKind): TokenIconInfo {
  return TOKEN_ICON_MAP[kind] ?? FALLBACK;
}

export const TOKEN_KIND_CLASS: Partial<Record<SyntaxTokenKind, string>> = {
  [SyntaxTokenKind.IDENTIFIER]: 'outline-blue-400/20 bg-blue-400/5',
  [SyntaxTokenKind.QUOTED_STRING]: 'outline-violet-400/20 bg-violet-400/5',
  [SyntaxTokenKind.STRING_LITERAL]: 'outline-green-500/20 bg-green-500/5',
  [SyntaxTokenKind.NUMERIC_LITERAL]: 'outline-amber-400/20 bg-amber-400/5',
  [SyntaxTokenKind.COLOR_LITERAL]: 'outline-pink-400/20 bg-pink-400/5',
  [SyntaxTokenKind.FUNCTION_EXPRESSION]: 'outline-orange-400/20 bg-orange-400/5',
  [SyntaxTokenKind.OP]: 'outline-red-400/20 bg-red-400/5',
  [SyntaxTokenKind.LPAREN]: 'outline-cyan-400/20 bg-cyan-400/5',
  [SyntaxTokenKind.RPAREN]: 'outline-cyan-400/20 bg-cyan-400/5',
  [SyntaxTokenKind.LBRACE]: 'outline-cyan-400/20 bg-cyan-400/5',
  [SyntaxTokenKind.RBRACE]: 'outline-cyan-400/20 bg-cyan-400/5',
  [SyntaxTokenKind.LBRACKET]: 'outline-cyan-400/20 bg-cyan-400/5',
  [SyntaxTokenKind.RBRACKET]: 'outline-cyan-400/20 bg-cyan-400/5',
  [SyntaxTokenKind.LANGLE]: 'outline-cyan-400/20 bg-cyan-400/5',
  [SyntaxTokenKind.RANGLE]: 'outline-cyan-400/20 bg-cyan-400/5',
  [SyntaxTokenKind.COMMA]: 'outline-gray-400/20 bg-gray-400/5',
  [SyntaxTokenKind.SEMICOLON]: 'outline-gray-400/20 bg-gray-400/5',
  [SyntaxTokenKind.COLON]: 'outline-gray-400/20 bg-gray-400/5',
  [SyntaxTokenKind.SINGLE_LINE_COMMENT]: 'outline-gray-400/20 bg-gray-400/5',
  [SyntaxTokenKind.MULTILINE_COMMENT]: 'outline-gray-400/20 bg-gray-400/5',
  [SyntaxTokenKind.WILDCARD]: 'outline-yellow-500/20 bg-yellow-500/5',
  [SyntaxTokenKind.EOF]: 'outline-red-400/20 bg-red-400/5',
};

export function tokenKindClass (kind: SyntaxTokenKind): string {
  return TOKEN_KIND_CLASS[kind] ?? 'outline-blue-400/20 bg-blue-400/5';
}
