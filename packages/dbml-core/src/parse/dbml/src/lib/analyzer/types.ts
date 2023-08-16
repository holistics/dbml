import { ElementDeclarationNode, SyntaxNode } from '../parser/nodes';
import { NodeSymbolId } from './symbol/symbolIndex';

export type UnresolvedName = UnresolvedUnqualifiedName | UnresolvedQualifiedName;

export interface UnresolvedUnqualifiedName {
  id: NodeSymbolId;
  qualifiers?: undefined;
  ownerElement: ElementDeclarationNode;
  referrer: SyntaxNode;
}

export interface UnresolvedQualifiedName {
  id: NodeSymbolId;
  qualifiers: NodeSymbolId[];
  ownerElement: ElementDeclarationNode;
  referrer: SyntaxNode;
}
