import type Compiler from '../../index';
import type { Database } from '@/core/interpreter/types';

export function rawDb (this: Compiler): Readonly<Database> | undefined {
  return this.parse._().getValue().rawDb;
}
