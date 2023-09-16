import { ElementDeclarationNode, SyntaxNode } from '../parser/nodes';
import { NodeSymbolIndex } from './symbol/symbolIndex';

export interface UnresolvedName {
  ids: NodeSymbolIndex[];
  ownerElement: ElementDeclarationNode;
  referrer: SyntaxNode;
}
