import { CompileError } from '@/core/errors';

export interface ElementBinder {
  bind(): CompileError[];
}
