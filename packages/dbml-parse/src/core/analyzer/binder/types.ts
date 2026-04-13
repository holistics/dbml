import {
  CompileError,
} from '@/core/types/errors';

export interface ElementBinder {
  bind(): CompileError[];
}
