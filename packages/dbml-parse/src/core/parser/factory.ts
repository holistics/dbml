import {
  Filepath,
} from '@/core/types/filepath';
import {
  SyntaxNode, SyntaxNodeId, SyntaxNodeIdGenerator,
} from '@/core/types/nodes';

export default class NodeFactory {
  private generator: SyntaxNodeIdGenerator;
  private filepath: Filepath;

  constructor (generator: SyntaxNodeIdGenerator, filepath: Filepath) {
    this.generator = generator;
    this.filepath = filepath;
  }

  create<T extends SyntaxNode, A>(Type: { new (args: A, id: SyntaxNodeId, filepath: Filepath): T }, args: A): T {
    return new Type(args, this.generator.nextId(), this.filepath);
  }
}
