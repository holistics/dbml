// Shared types for the playground's AST/symbol serializers. Shape is the flat
// form the output-tab UIs render directly — no nested `context` wrapper.

import type {
  SyntaxNode, SyntaxToken,
} from '@dbml/parse';
import type {
  SymbolInfo, DeclarationPosition,
} from '@/stores/parserStore';

export type Serializable =
  | string | number | null | undefined | boolean | bigint | symbol
  | SyntaxToken
  | SyntaxNode
  | SymbolInfo
  | readonly Serializable[]
  | { readonly [key: string]: Serializable };

type Primitive = string | number | boolean | null | undefined;
export type SerializedValue =
  | Primitive
  | SerializedToken
  | SerializedNode
  | SerializedSymbol
  | SerializedValue[]
  | { [key: string]: SerializedValue };

export interface SerializedToken {
  id: string;
  value?: string;
  leadingTrivia?: string;
  trailingTrivia?: string;
  isInvalid?: true;
}

export interface SerializedNode {
  id: string;
  fullStart?: number;
  fullEnd?: number;
  children?: Record<string, SerializedValue>;
}

export interface SerializedSymbolDeclaration {
  id: string;
  declarationPosition: DeclarationPosition;
  declarationFilepath?: string;
}

export interface SerializedSymbol {
  id: string;
  members?: SerializedSymbol[];
  declaration?: SerializedSymbolDeclaration;
}

export interface SerializeOpts {
  simple?: boolean;
}
