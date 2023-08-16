import { NodeSymbolId } from './symbolIndex';
import { NodeSymbol } from './symbols';

export default class SymbolTable {
  private table: Map<NodeSymbolId, NodeSymbol>;

  constructor() {
    this.table = new Map();
  }

  has(id: NodeSymbolId): boolean {
    return this.table.has(id);
  }

  set(id: NodeSymbolId, value: NodeSymbol) {
    this.table.set(id, value);
  }

  get(id: NodeSymbolId): NodeSymbol | undefined;
  get(id: NodeSymbolId, defaultValue: NodeSymbol): NodeSymbol;
  get(id: NodeSymbolId, defaultValue?: NodeSymbol): NodeSymbol | undefined {
    return (
      this.table.get(id) ||
      (defaultValue !== undefined && this.set(id, defaultValue)) ||
      defaultValue
    );
  }
}
