import { NodeSymbolIndex } from './symbolIndex';
import { NodeSymbol } from './symbols';

export default class SymbolTable {
  private table: Map<NodeSymbolIndex, NodeSymbol>;

  constructor () {
    this.table = new Map();
  }

  has (id: NodeSymbolIndex): boolean {
    return this.table.has(id);
  }

  set (id: NodeSymbolIndex, value: NodeSymbol) {
    this.table.set(id, value);
  }

  get (id: NodeSymbolIndex): NodeSymbol | undefined;
  get (id: NodeSymbolIndex, defaultValue: NodeSymbol): NodeSymbol;
  get (id: NodeSymbolIndex, defaultValue?: NodeSymbol): NodeSymbol | undefined {
    if (this.table.has(id)) return this.table.get(id);
    if (defaultValue !== undefined) {
      this.table.set(id, defaultValue);
      return defaultValue;
    }
    return undefined;
  }

  delete (id: NodeSymbolIndex): boolean {
    return this.table.delete(id);
  }

  entries (): IterableIterator<[NodeSymbolIndex, NodeSymbol]> {
    return this.table.entries();
  }

  forEach (callback: (value: NodeSymbol, key: NodeSymbolIndex) => void) {
    return this.table.forEach(callback);
  }

  clone (): SymbolTable {
    const copy = new SymbolTable();
    for (const [id, symbol] of this.table) {
      copy.set(id, symbol);
    }
    return copy;
  }

  // Deep clone: symbols with a nested symbolTable get a fresh copy of it (recursively),
  // so mutations from resolveExternalDependencies don't bleed back into the cached validateFile result.
  deepClone (): SymbolTable {
    const copy = new SymbolTable();
    for (const [id, symbol] of this.table) {
      if (symbol.symbolTable !== undefined) {
        const symbolCopy = Object.assign(Object.create(Object.getPrototypeOf(symbol)), symbol);
        symbolCopy.symbolTable = symbol.symbolTable.deepClone();
        copy.set(id, symbolCopy);
      } else {
        copy.set(id, symbol);
      }
    }
    return copy;
  }
}
