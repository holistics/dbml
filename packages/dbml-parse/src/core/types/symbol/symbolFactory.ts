import { Filepath } from '@/core/types/filepath';
import {
  NodeSymbol, NodeSymbolId, NodeSymbolIdGenerator,
} from './symbols';

export class SymbolFactory {
  private generator: NodeSymbolIdGenerator;

  constructor (generator: NodeSymbolIdGenerator) {
    this.generator = generator;
  }

  create<T extends NodeSymbol, A>(Type: { new (args: A, id: NodeSymbolId, filepath: Filepath): T }, args: A, filepath: Filepath): T {
    return new Type(args, this.generator.nextId(), filepath);
  }
}
