import type { Component } from 'vue';
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

export interface TokenIconInfo { icon: Component; color: string }

export const TOKEN_ICON_MAP: Record<string, TokenIconInfo> = {
  '<identifier>':           { icon: PhIdentificationCard, color: 'text-blue-500' },
  '<variable>':             { icon: PhQuotes,             color: 'text-violet-500' },
  '<string>':               { icon: PhTextAa,             color: 'text-green-600' },
  '<number>':               { icon: PhNumberSquareOne,    color: 'text-amber-500' },
  '<color>':                { icon: PhPalette,            color: 'text-pink-500' },
  '<function-expression>':  { icon: PhLightning,          color: 'text-orange-500' },
  '<op>':                   { icon: PhMathOperations,     color: 'text-red-500' },
  '<lparen>':               { icon: PhBracketsRound,      color: 'text-cyan-500' },
  '<rparen>':               { icon: PhBracketsRound,      color: 'text-cyan-500' },
  '<lbrace>':               { icon: PhBracketsCurly,      color: 'text-cyan-500' },
  '<rbrace>':               { icon: PhBracketsCurly,      color: 'text-cyan-500' },
  '<lbracket>':             { icon: PhBracketsSquare,     color: 'text-cyan-500' },
  '<rbracket>':             { icon: PhBracketsSquare,     color: 'text-cyan-500' },
  '<langle>':               { icon: PhBracketsAngle,      color: 'text-cyan-500' },
  '<rangle>':               { icon: PhBracketsAngle,      color: 'text-cyan-500' },
  '<comma>':                { icon: PhAsterisk,           color: 'text-gray-400' },
  '<semicolon>':            { icon: PhAsterisk,           color: 'text-gray-400' },
  '<colon>':                { icon: PhAsterisk,           color: 'text-gray-400' },
  '<space>':                { icon: PhArrowsHorizontal,   color: 'text-gray-300' },
  '<tab>':                  { icon: PhArrowsHorizontal,   color: 'text-gray-300' },
  '<newline>':              { icon: PhKeyReturn,          color: 'text-gray-300' },
  '<single-line-comment>':  { icon: PhArticle,            color: 'text-gray-400' },
  '<multiline-comment>':    { icon: PhArticle,            color: 'text-gray-400' },
  '<wildcard>':             { icon: PhStar,               color: 'text-yellow-500' },
  '<eof>':                  { icon: PhFlagCheckered,      color: 'text-red-400' },
};

const FALLBACK: TokenIconInfo = { icon: PhQuestion, color: 'text-gray-400' };

export function tokenIconFor (kind: string): TokenIconInfo {
  return TOKEN_ICON_MAP[kind] ?? FALLBACK;
}
