import type { Filepath } from '@/compiler/projectLayout';
import { SyntaxNode, SyntaxNodeId, SyntaxNodeIdGenerator } from '@/core/parser/nodes';

export default class NodeFactory {
  private generator: SyntaxNodeIdGenerator;
  readonly filepath: Filepath;

  constructor (generator: SyntaxNodeIdGenerator, filepath: Filepath) {
    this.generator = generator;
    this.filepath = filepath;
  }

  create<T extends SyntaxNode, A>(Type: { new (args: A, id: SyntaxNodeId, filepath: Filepath): T }, args: A): T {
    return new Type(args, this.generator.nextId(), this.filepath);
  }
}
