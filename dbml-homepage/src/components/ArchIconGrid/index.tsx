import clsx from 'clsx';
import React, { useMemo, useState } from 'react';
import {
  ArchMark,
  ArchRoleIcon,
  ArchTypeIcon,
  ROLE_CATEGORY_COLORS,
} from '@site/src/data/archIcons';
import gridStyles from '../EcosystemGrid/styles.module.scss';
import styles from './styles.module.scss';

// The colors are set as CSS variables, and styles.module.scss picks the one for the current theme.
function Mark({ mark, colors }: { mark: ArchMark; colors?: { light: string; dark: string } }) {
  const style = colors && ({ '--mark-light': colors.light, '--mark-dark': colors.dark } as React.CSSProperties);
  return (
    <svg className={styles.mark} style={style} viewBox="0 0 24 24" aria-hidden="true">
      {'fill' in mark ? (
        <path d={mark.fill} fill="currentColor" />
      ) : (
        mark.stroke.map((d) => (
          <path
            key={d}
            d={d}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.7}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))
      )}
    </svg>
  );
}

interface Item {
  name: string;
  category: string;
  mark: ArchMark;
  // shown under the name, and searched
  detail?: string;
}

interface IconGridProps {
  items: Item[];
  label: string;
  colorsOf?: (item: Item) => { light: string; dark: string } | undefined;
  sortCategories?: boolean;
}

function IconGrid({ items, label, colorsOf, sortCategories }: IconGridProps) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState<string | null>(null);

  const categories = useMemo(() => {
    const list = [...new Set(items.map((item) => item.category))];
    return sortCategories ? list.sort() : list;
  }, [items, sortCategories]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      if (active && item.category !== active) return false;
      if (!needle) return true;
      return [item.name, item.detail, item.category].some((field) => field?.toLowerCase().includes(needle));
    });
  }, [items, query, active]);

  return (
    <div>
      <div className={gridStyles.controls}>
        <input
          className={gridStyles.search}
          type="search"
          value={query}
          placeholder={`Search ${label}…`}
          aria-label={`Search ${label}`}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className={gridStyles.filters}>
          <button
            type="button"
            className={clsx(gridStyles.chip, active === null && gridStyles.chipActive)}
            onClick={() => setActive(null)}
          >
            All <span className={gridStyles.chipCount}>{items.length}</span>
          </button>
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              className={clsx(gridStyles.chip, active === category && gridStyles.chipActive)}
              onClick={() => setActive(active === category ? null : category)}
            >
              {category}{' '}
              <span className={gridStyles.chipCount}>
                {items.filter((item) => item.category === category).length}
              </span>
            </button>
          ))}
        </div>
      </div>
      {visible.length === 0 ? (
        <p className={gridStyles.empty}>Nothing matches “{query}”.</p>
      ) : (
        <div className={clsx(gridStyles.grid, styles.grid)}>
          {visible.map((item) => (
            <div key={item.name} className={clsx(gridStyles.card, styles.card)}>
              <Mark mark={item.mark} colors={colorsOf?.(item)} />
              <code className={styles.name}>{item.name}</code>
              {item.detail && <span className={styles.detail}>{item.detail}</span>}
              <span className={clsx(gridStyles.badge, styles.badge)}>{item.category}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function RoleIconGrid({ items }: { items: ArchRoleIcon[] }) {
  const rows = useMemo(() => items.map((item) => ({ ...item, detail: item.description })), [items]);
  return (
    <IconGrid
      items={rows}
      label="roles"
      colorsOf={(item) => ROLE_CATEGORY_COLORS[item.category]}
    />
  );
}

export function TypeIconGrid({ items }: { items: ArchTypeIcon[] }) {
  const rows = useMemo(
    () => items.map((item) => ({
      ...item,
      detail: item.alternatives.length ? `also: ${item.alternatives.join(', ')}` : undefined,
    })),
    [items],
  );
  return <IconGrid items={rows} label="types" sortCategories />;
}
