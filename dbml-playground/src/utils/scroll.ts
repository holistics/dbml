import {
  nextTick,
} from 'vue';
import type {
  Ref,
} from 'vue';

/* Scroll container so both row[i] and its detail panel (if open) are fully visible. */
export function scrollRowIntoView (
  i: number,
  rowEls: (HTMLElement | null)[],
  detailEls: (HTMLElement | null)[],
  scrollEl: Ref<HTMLElement | null>,
) {
  nextTick(() => {
    const row = rowEls[i];
    const container = scrollEl.value;
    if (!row || !container) return;
    const bottomEl = detailEls[i] ?? row;
    const containerRect = container.getBoundingClientRect();
    const rowTop = row.getBoundingClientRect().top - containerRect.top + container.scrollTop;
    const bottomEdge = bottomEl.getBoundingClientRect().bottom - containerRect.top + container.scrollTop;
    const visTop = container.scrollTop;
    const visBottom = visTop + container.clientHeight;
    if (rowTop < visTop) {
      container.scrollTo({
        top: rowTop,
        behavior: 'smooth',
      });
    } else if (bottomEdge > visBottom) {
      container.scrollTo({
        top: bottomEdge - container.clientHeight,
        behavior: 'smooth',
      });
    }
  });
}
