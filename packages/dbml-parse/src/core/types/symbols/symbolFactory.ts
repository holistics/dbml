import { NodeSymbol, NodeSymbolId, NodeSymbolIdGenerator } from './symbols';
import { Filepath } from '@/core/types/filepath';

export class SymbolFactory {
  private generator: NodeSymbolIdGenerator;
  private filepath: Filepath;

  constructor (generator: NodeSymbolIdGenerator, filepath: Filepath) {
    this.generator = generator;
    this.filepath = filepath;
  }

  create<T extends NodeSymbol, A>(Type: { new (args: A, id: NodeSymbolId, filepath: Filepath): T }, args: A): T {
    return new Type(args, this.generator.nextId(), this.filepath);
  }
}
