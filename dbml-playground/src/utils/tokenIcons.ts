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
  [SyntaxTokenKind.IDENTIFIER]: 'hl-token-identifier',
  [SyntaxTokenKind.QUOTED_STRING]: 'hl-token-variable',
  [SyntaxTokenKind.STRING_LITERAL]: 'hl-token-string',
  [SyntaxTokenKind.NUMERIC_LITERAL]: 'hl-token-number',
  [SyntaxTokenKind.COLOR_LITERAL]: 'hl-token-color',
  [SyntaxTokenKind.FUNCTION_EXPRESSION]: 'hl-token-function',
  [SyntaxTokenKind.OP]: 'hl-token-op',
  [SyntaxTokenKind.LPAREN]: 'hl-token-bracket',
  [SyntaxTokenKind.RPAREN]: 'hl-token-bracket',
  [SyntaxTokenKind.LBRACE]: 'hl-token-bracket',
  [SyntaxTokenKind.RBRACE]: 'hl-token-bracket',
  [SyntaxTokenKind.LBRACKET]: 'hl-token-bracket',
  [SyntaxTokenKind.RBRACKET]: 'hl-token-bracket',
  [SyntaxTokenKind.LANGLE]: 'hl-token-bracket',
  [SyntaxTokenKind.RANGLE]: 'hl-token-bracket',
  [SyntaxTokenKind.COMMA]: 'hl-token-punct',
  [SyntaxTokenKind.SEMICOLON]: 'hl-token-punct',
  [SyntaxTokenKind.COLON]: 'hl-token-punct',
  [SyntaxTokenKind.SINGLE_LINE_COMMENT]: 'hl-token-comment',
  [SyntaxTokenKind.MULTILINE_COMMENT]: 'hl-token-comment',
  [SyntaxTokenKind.WILDCARD]: 'hl-token-wildcard',
  [SyntaxTokenKind.EOF]: 'hl-token-eof',
};

export function tokenKindClass (kind: SyntaxTokenKind): string {
  return TOKEN_KIND_CLASS[kind] ?? 'hl-token-identifier';
}
