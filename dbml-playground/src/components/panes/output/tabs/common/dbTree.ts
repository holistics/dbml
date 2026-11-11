import { inject, provide, type InjectionKey } from 'vue';

// These must match the literal Tailwind classes in DbRow/DbSection:
// caret and row icon are `w-3.5` (14px), row items are spaced with `gap-2` (8px).
const ICON_PX = 14;
const GAP_PX = 8;
// Left padding of a DbSection header (`px-3`).
const BASE_PX = 12;

// One level = one caret + gap, so a child's caret/icon lines up under its parent's icon.
const STEP_PX = ICON_PX + GAP_PX;

const LEVEL_KEY: InjectionKey<number> = Symbol('dbTreeLevel');

export function indentFor (level: number): number {
  return BASE_PX + level * STEP_PX;
}

/** Marks the root of a tree (a DbSection). Rows rendered inside it start at level 1. */
export function provideDbTreeRoot (): void {
  provide(LEVEL_KEY, 0);
}

/** Claims the next level below the nearest ancestor row/section, and passes it on to descendants. */
export function useDbTreeLevel (): number {
  const level = inject(LEVEL_KEY, 0) + 1;
  provide(LEVEL_KEY, level);
  return level;
}
