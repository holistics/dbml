import { ElementDeclarationNode, SyntaxNode } from '../parser/nodes';
import { NodeSymbolId } from './symbol/symbolIndex';

export interface UnresolvedName {
  ids: NodeSymbolId[];
  ownerElement: ElementDeclarationNode;
  referrer: SyntaxNode;
}
