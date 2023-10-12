import { ElementDeclarationNode, SyntaxNode } from '../parser/nodes';
import { NodeSymbolIndex } from './symbol/symbolIndex';

export interface UnresolvedName {
  subnames: {
    index: NodeSymbolIndex;
    referrer: SyntaxNode;
  }[];
  ownerElement: ElementDeclarationNode;
}

export interface BindingRequest {
  unresolvedName: UnresolvedName;
  ignoreError: boolean;
}

export function createNonIgnorableBindingRequest(unresolvedName: UnresolvedName): BindingRequest {
  return {
    unresolvedName,
    ignoreError: false,
  };
}

export function createIgnorableBindingRequest(unresolvedName: UnresolvedName): BindingRequest {
  return {
    unresolvedName,
    ignoreError: true,
  };
}
