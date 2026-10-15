import {
  ICON_ALIAS, ICON_NAMES, isIconName, resolveIcon,
} from './icons.js';
import type { Category } from './model.js';

/**
 * THE BUILT-IN VOCABULARY, and the only place it is written down.
 *
 * Two forces pull against each other here. A model writing an architecture file needs a CLOSED
 * set, so it cannot invent `Microservice` and have it silently draw a blank box. A person
 * describing their own estate needs an OPEN set, because nobody's infrastructure fits twenty
 * words.
 *
 * `Kind` resolves it: the set is closed at any moment, and a declaration opens it by one. The
 * grammar is untouched either way, because DBML's parser never knew these words to begin with.
 * `parser.ts` has a single generic `elementDeclaration()` and does not mention `ElementKind`
 * anywhere, which is the whole reason this dialect can exist without forking it.
 */
export interface KindSpec {
  icon: string;
  category: Category;
}

const GENERIC_KINDS: Record<string, KindSpec> = {
  Server: { icon: 'server', category: 'compute' },
  Function: { icon: 'function', category: 'compute' },
  Container: { icon: 'container', category: 'compute' },
  Service: { icon: 'chip', category: 'compute' },
  Registry: { icon: 'container', category: 'compute' },
  Database: { icon: 'database', category: 'data' },
  Cache: { icon: 'cache', category: 'data' },
  Queue: { icon: 'queue', category: 'data' },
  Topic: { icon: 'stream', category: 'data' },
  Storage: { icon: 'disk', category: 'data' },
  Bucket: { icon: 'bucket', category: 'data' },
  Warehouse: { icon: 'graph', category: 'data' },
  Search: { icon: 'search', category: 'data' },
  LoadBalancer: { icon: 'balancer', category: 'net' },
  Proxy: { icon: 'proxy', category: 'net' },
  VPN: { icon: 'lock', category: 'net' },
  Gateway: { icon: 'gateway', category: 'net' },
  Firewall: { icon: 'firewall', category: 'net' },
  Router: { icon: 'router', category: 'net' },
  Secret: { icon: 'key', category: 'net' },
  CDN: { icon: 'globe', category: 'edge' },
  Internet: { icon: 'cloud', category: 'edge' },
  Client: { icon: 'person', category: 'people' },
  Browser: { icon: 'browser', category: 'people' },
  Mobile: { icon: 'mobile', category: 'people' },
  Team: { icon: 'users', category: 'people' },
  Monitoring: { icon: 'pulse', category: 'ops' },
  Logging: { icon: 'file', category: 'ops' },
  Alerting: { icon: 'bell', category: 'ops' },
  Scheduler: { icon: 'clock', category: 'ops' },
  Pipeline: { icon: 'pipeline', category: 'ops' },
};

/**
 * A BRAND IS A SETTING, NOT A KEYWORD.
 *
 * This table used to hold forty-two more keywords: `Postgres`, `Mongo`, `HAProxy`, each one a
 * word that opened a declaration. That was the wrong shape, and DBML says so plainly. DBML
 * does not have a `PostgresTable` keyword; it has `Table`, and the flavour is a setting. A
 * column is not a `PrimaryKeyColumn`, it is a column with `[pk]`.
 *
 * So the keyword is the ROLE and `type` is the BRAND:
 *
 *   Proxy    lb1      [name: 'ha 1', type: 'haproxy']
 *   Database users_db [name: 'Users DB', type: 'postgres']
 *
 * Four things came back from making that swap. The vocabulary a reader has to learn dropped
 * from 73 words to 31. The role survives as a structured fact, so a drawing can still be asked
 * which boxes are databases, which it could not when the box simply said `Postgres`. Changing
 * vendor is one word rather than a different declaration. And the spelling problem evaporates:
 * `postgres`, `postgresql` and `pg` are already aliases in the icon pack, so they cost nothing
 * instead of three keywords each.
 */
export const BUILTIN_KINDS: Record<string, KindSpec> = GENERIC_KINDS;

/**
 * `Postgress` is a typo, and `Postgres` is a brand, and neither is a new kind of thing.
 *
 * The brands used to be keywords, so somebody writing `Postgres users_db` got a diagram. They
 * now get this, which has to do two jobs: point a typo at the nearest role, and point a brand
 * at the setting it belongs in. Saying only "declare it" sends a person off to write a `Kind`
 * line for something the language already handles.
 */
export function suggestKind (typed: string): string {
  const needle = typed.toLowerCase();

  // a brand is a thing people reach for in this position, because every other diagramming
  // tool puts it there. Two lines of guidance beat an edit-distance miss.
  if (isIconName(needle)) {
    return `${typed} is a brand, and a brand is a setting:  Database name [type: '${needle}']`;
  }

  const near = Object.keys(BUILTIN_KINDS)
    .filter((name) => {
      const known = name.toLowerCase();
      if (known.startsWith(needle) || needle.startsWith(known) || known.includes(needle)) return true;
      // a typo is usually a transposition or a dropped letter, which no prefix test catches:
      // `Databse` shares no useful prefix with `Database` and is one edit away from it
      return within(known, needle, 2);
    })
    .slice(0, 6);
  if (near.length) return `Did you mean: ${near.join(', ')}?`;
  return `Declare it:  Kind ${typed} [icon: box]`;
}

/** edit distance, stopped as soon as it exceeds the budget: a diagnostic is not a search engine */
function within (a: string, b: string, budget: number): boolean {
  if (Math.abs(a.length - b.length) > budget) return false;

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j += 1) {
      row[j] = a[i - 1] === b[j - 1]
        ? previous[j - 1]
        : 1 + Math.min(previous[j - 1], previous[j], row[j - 1]);
      best = Math.min(best, row[j]);
    }
    if (best > budget) return false;
    previous = row;
  }
  return previous[b.length] <= budget;
}

export const RESERVED = new Set(['Kind', 'Group', 'Note', 'Metadata', 'Link', 'Ref', 'use', 'Project']);

const RESERVED_LOWER = new Set([...RESERVED].map((word) => word.toLowerCase()));

export const isReserved = (word: string): boolean => RESERVED_LOWER.has(word.toLowerCase());

export {
  ICON_ALIAS, ICON_NAMES, isIconName, resolveIcon,
};

/** a hundred names in a diagnostic is a wall, not a help */
export function suggestIcon (typed: string): string {
  const needle = typed.toLowerCase();
  const near = [...ICON_NAMES, ...Object.keys(ICON_ALIAS)]
    .filter((n) => n.startsWith(needle) || needle.startsWith(n) || n.includes(needle))
    .slice(0, 6);
  if (near.length) return `Did you mean: ${near.join(', ')}?`;
  return `The pack has ${ICON_NAMES.length} marks; draw your own with [glyph: 'M...'].`;
}
