import type Compiler from '@/compiler';
import type Report from '@/core/types/report';

// Sentinel returned by a module when it does not handle a dispatched call -
// lets the dispatcher fall through to the next candidate module.
export const PASS_THROUGH = Symbol('PASS_THROUGH');
export type PassThrough = typeof PASS_THROUGH;

// Sentinel returned in place of a value when no module produced a result.
export const UNHANDLED = Symbol('UNHANDLED');
export type Unhandled = typeof UNHANDLED;

export interface Module {
  [index: string]: undefined | ((compiler: Compiler, ...args: any[]) => Report<unknown> | Report<PassThrough>);
}
