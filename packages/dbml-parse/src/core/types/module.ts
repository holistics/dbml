import type { PassThrough } from '@/constants';
import type Report from '@/core/types/report';
import type Compiler from '@/compiler';

export interface Module {
  [index: string]: undefined | ((compiler: Compiler, ...args: any[]) => Report<unknown> | Report<PassThrough>);
}
