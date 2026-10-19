import {
  archSort, endpointNode, handleOf, isTopLevel, linkPartsOf, nameOf,
} from '@/core/arch/read';
import { Filepath } from '@/core/types/filepath';
import type { ElementDeclarationNode } from '@/core/types/nodes';
import type Compiler from '../../../index';

// A DBML file has no architecture declarations, so a `Table` is never taken for a node
export function archDeclarations (compiler: Compiler, filepath: Filepath): ElementDeclarationNode[] {
  const ast = compiler.parseFile(filepath).getValue().ast;
  if (compiler.parsedFileKind(filepath) !== 'arch') return [];
  return ast.body.filter(isTopLevel);
}

const isElement = (declaration: ElementDeclarationNode): boolean => {
  const sort = archSort(declaration);
  return sort === 'node' || sort === 'group' || sort === 'note';
};

export function findArchElement (compiler: Compiler, filepath: Filepath, handle: string): ElementDeclarationNode | undefined {
  return archDeclarations(compiler, filepath).find((d) => isElement(d) && handleOf(d) === handle);
}

export function findArchLink (compiler: Compiler, filepath: Filepath, from: string, to: string): ElementDeclarationNode | undefined {
  return archDeclarations(compiler, filepath).find((d) => {
    if (archSort(d) !== 'link') return false;
    const parts = linkPartsOf(d);
    if (!parts) return false;
    const left = nameOf(endpointNode(parts.infix.left));
    const right = nameOf(endpointNode(parts.infix.right));
    return (left === from && right === to) || (left === to && right === from);
  });
}
