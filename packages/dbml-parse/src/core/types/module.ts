import type { PassThrough } from '@/constants';
import type Report from '../report';
import type Compiler from '@/compiler';

export interface Module {
  [index: string]: undefined | ((compiler: Compiler, ...args: any[]) => Report<unknown> | Report<PassThrough>);
}
