import Link from '@docusaurus/Link';
import clsx from 'clsx';
import React, { useMemo, useState } from 'react';
import {
  CommunityCategory,
  communityCategoryLabels,
  EcosystemItem,
} from '@site/src/data/ecosystem';
import styles from './styles.module.scss';

/**
 * Star counts come from shields.io rather than a client-side call to the GitHub
 * API: unauthenticated API calls are capped at 60/hour per visitor IP, which a
 * grid of ~20 repos would exhaust in three page loads.
 */
// A white five-pointed star, inlined as the badge's logo — shields.io has no
// built-in star icon, and `logo=github` reads as "GitHub link", not "stars".
const STAR_LOGO =
  'data:image/svg+xml;base64,' +
  'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAy' +
  'NCIgZmlsbD0id2hpdGUiPjxwYXRoIGQ9Ik0xMiAuNTg3bDMuNjY4IDcuNDMxIDguMzMyIDEuMTUx' +
  'LTYuMDY0IDUuODI4IDEuNDggOC4yNzlMMTIgMTkuNDQ2bC03LjQxNiAzLjgzIDEuNDgtOC4yNzlM' +
  'MCA5LjE2OWw4LjMzMi0xLjE1MXoiLz48L3N2Zz4=';

function starsBadgeUrl(repo: string) {
  const params = new URLSearchParams({
    style: 'flat-square',
    logo: STAR_LOGO,
    label: '',
    // Transparent, so the badge reads as part of the card rather than a sticker
    // pasted onto it. shields.io draws the star and count in white; `.stars`
    // inverts them to dark ink on the light theme.
    color: 'rgba(0,0,0,0)',
  });
  return `https://img.shields.io/github/stars/${repo}?${params}`;
}

function Card({ item, showStars }: { item: EcosystemItem; showStars?: boolean }) {
  const footer = [
    item.author && (
      <span key="author" className={styles.cardAuthor}>
        by {item.author}
      </span>
    ),
    showStars && item.repo && (
      <img
        key="stars"
        className={styles.stars}
        src={starsBadgeUrl(item.repo)}
        alt={`${item.repo} stars on GitHub`}
        loading="lazy"
        height={20}
      />
    ),
  ].filter(Boolean);

  return (
    <Link className={styles.card} to={item.href}>
      <div className={styles.cardHeader}>
        <span className={styles.cardName}>{item.name}</span>
        {item.language && <span className={styles.badge}>{item.language}</span>}
      </div>
      <p className={styles.cardDescription}>{item.description}</p>
      {item.note && <p className={styles.cardNote}>{item.note}</p>}
      {footer.length > 0 && <div className={styles.cardFooter}>{footer}</div>}
    </Link>
  );
}

export function EcosystemGrid({
  items,
  showStars,
}: {
  items: EcosystemItem[];
  showStars?: boolean;
}) {
  return (
    <div className={styles.grid}>
      {items.map((item) => (
        <Card key={item.href} item={item} showStars={showStars} />
      ))}
    </div>
  );
}

const categories = Object.keys(communityCategoryLabels) as CommunityCategory[];

export function CommunityGrid({ items }: { items: EcosystemItem[] }) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState<CommunityCategory | null>(null);

  const counts = useMemo(() => {
    const result = {} as Record<CommunityCategory, number>;
    categories.forEach((category) => {
      result[category] = items.filter((item) =>
        item.categories?.includes(category),
      ).length;
    });
    return result;
  }, [items]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      if (active && !item.categories?.includes(active)) return false;
      if (!needle) return true;
      return [item.name, item.description, item.language, item.author, item.note]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(needle));
    });
  }, [items, query, active]);

  return (
    <div>
      <div className={styles.controls}>
        <input
          className={styles.search}
          type="search"
          value={query}
          placeholder="Search by name, language or author…"
          aria-label="Search community projects"
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className={styles.filters}>
          <button
            type="button"
            className={clsx(styles.chip, active === null && styles.chipActive)}
            onClick={() => setActive(null)}
          >
            All <span className={styles.chipCount}>{items.length}</span>
          </button>
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              className={clsx(styles.chip, active === category && styles.chipActive)}
              onClick={() => setActive(active === category ? null : category)}
            >
              {communityCategoryLabels[category]}{' '}
              <span className={styles.chipCount}>{counts[category]}</span>
            </button>
          ))}
        </div>
      </div>
      {visible.length === 0 ? (
        <p className={styles.empty}>
          No project matches “{query}”. Know one?{' '}
          <a href="https://github.com/holistics/dbml/pulls">Add it via a pull request.</a>
        </p>
      ) : (
        <EcosystemGrid items={visible} showStars />
      )}
    </div>
  );
}
