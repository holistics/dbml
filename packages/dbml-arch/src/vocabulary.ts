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

export const BUILTIN_KINDS: Record<string, KindSpec> = {
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

/** the words that open a declaration, and are therefore not available as an element kind */
export const RESERVED = new Set(['Kind', 'Group', 'Note', 'Metadata', 'Link', 'Ref', 'use', 'Project']);

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
