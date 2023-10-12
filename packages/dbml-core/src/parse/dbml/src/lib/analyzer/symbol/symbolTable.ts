import { NodeSymbolIndex } from './symbolIndex';
import { NodeSymbol } from './symbols';

export default class SymbolTable {
  private table: Map<NodeSymbolIndex, NodeSymbol>;

  constructor() {
    this.table = new Map();
  }

  has(id: NodeSymbolIndex): boolean {
    return this.table.has(id);
  }

  set(id: NodeSymbolIndex, value: NodeSymbol) {
    this.table.set(id, value);
  }

  get(id: NodeSymbolIndex): NodeSymbol | undefined;
  get(id: NodeSymbolIndex, defaultValue: NodeSymbol): NodeSymbol;
  get(id: NodeSymbolIndex, defaultValue?: NodeSymbol): NodeSymbol | undefined {
    return (
      this.table.get(id) ||
      (defaultValue !== undefined && this.set(id, defaultValue)) ||
      defaultValue
    );
  }

  entries(): IterableIterator<[NodeSymbolIndex, NodeSymbol]> {
    return this.table.entries();
  }
}
