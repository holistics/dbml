import type Compiler from '@/compiler';
import { PASS_THROUGH, type PassThrough } from '@/core/types/module';
import { MetadataDeclarationNode, SyntaxNode } from '@/core/types/nodes';
import Report from '@/core/types/report';
import { type LocalModule, type Settings } from '../types';
import MetadataValidator from './validate';

export const metadataModule: LocalModule = {
  validateNode (compiler: Compiler, node: SyntaxNode): Report<void> | Report<PassThrough> {
    if (!(node instanceof MetadataDeclarationNode)) return new Report(PASS_THROUGH);

    return new Report(undefined, new MetadataValidator(compiler, node).validate());
  },

  nodeFullname (compiler: Compiler, node: SyntaxNode): Report<string[] | undefined> | Report<PassThrough> {
    if (!(node instanceof MetadataDeclarationNode)) return new Report(PASS_THROUGH);

    // if (!node.targetName) {
    //   return new Report(undefined, [
    //     new CompileError(
    //       CompileErrorCode.INVALID_NAME,
    //       'A Metadata element must target an element',
    //       node,
    //     ),
    //   ]);
    // }
    //
    // const nameFragments = destructureComplexVariable(node.targetName);
    // if (!nameFragments) {
    //   return new Report(undefined, [
    //     new CompileError(
    //       CompileErrorCode.INVALID_NAME,
    //       'Invalid Metadata target name',
    //       node,
    //     ),
    //   ]);
    // }

    // A Metadata element does not have a name
    return new Report(undefined);
  },

  // A Metadata declaration is structurally incapable of an alias or a setting
  // list (the node has no such fields), so these always succeed with no error.
  nodeAlias (compiler: Compiler, node: SyntaxNode): Report<string | undefined> | Report<PassThrough> {
    if (!(node instanceof MetadataDeclarationNode)) return new Report(PASS_THROUGH);

    return new Report(undefined);
  },

  nodeSettings (compiler: Compiler, node: SyntaxNode): Report<Settings> | Report<PassThrough> {
    if (!(node instanceof MetadataDeclarationNode)) return new Report(PASS_THROUGH);

    return new Report({});
  },
};
