import type { Filepath } from '@/compiler/projectLayout/filepath';
import { NodeSymbol, NodeSymbolId, NodeSymbolIdGenerator } from './symbols';

export default class SymbolFactory {
  private generator: NodeSymbolIdGenerator;
  readonly filepath: Filepath;

  constructor (generator: NodeSymbolIdGenerator, filepath: Filepath) {
    this.generator = generator;
    this.filepath = filepath;
  }

  create<T extends NodeSymbol, A>(Type: { new (args: A & { filepath: Filepath }, id: NodeSymbolId): T }, args: A): T {
    return new Type({ ...args, filepath: this.filepath }, this.generator.nextId());
  }
}
