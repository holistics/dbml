import type { Filepath } from '@/compiler/projectLayout';
import { SyntaxNode, SyntaxNodeId, SyntaxNodeIdGenerator } from '@/core/parser/nodes';

export default class NodeFactory {
  private generator: SyntaxNodeIdGenerator;
  readonly filepath: Filepath;

  constructor (generator: SyntaxNodeIdGenerator, filepath: Filepath) {
    this.generator = generator;
    this.filepath = filepath;
  }

  create<T extends SyntaxNode, A>(Type: { new (args: A, id: SyntaxNodeId): T }, args: A): T {
    const node = new Type(args, this.generator.nextId());
    node.filepath = this.filepath;
    return node;
  }
}
