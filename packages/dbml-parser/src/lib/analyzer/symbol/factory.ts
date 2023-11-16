import { NodeSymbol, NodeSymbolId, NodeSymbolIdGenerator } from './symbols';

export default class SymbolFactory {
  private generator: NodeSymbolIdGenerator;

  constructor(generator: NodeSymbolIdGenerator) {
    this.generator = generator;
  }

  create<T extends NodeSymbol, A>(Type: { new (args: A, id: NodeSymbolId): T }, args: A): T {
    return new Type(args, this.generator.nextId());
  }
}
