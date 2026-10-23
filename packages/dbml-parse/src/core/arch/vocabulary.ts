import { ICON_ALIAS, ICON_NAMES, isIconName } from './icons';

export type RoleCategory = 'compute' | 'data' | 'net' | 'edge' | 'people' | 'ops';

export interface RoleSpec {
  icon: string;
  category: RoleCategory;
}

// The roles an element can have. There are no others, so diagrams map one to one to infrastructure code.
export const BUILTIN_ROLES: Record<string, RoleSpec> = {
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

const ROLE_BY_LOWER = new Map(Object.keys(BUILTIN_ROLES).map((name) => [name.toLowerCase(), name]));

// The role's declared spelling, whatever case was typed
export const roleName = (typed: string): string | undefined => ROLE_BY_LOWER.get(typed.toLowerCase());

export const NO_CUSTOM_ROLE_MESSAGE = 'Custom roles are not supported. Use a built-in role; `type` sets the mark (a mark name or an image URL) and `color` the colour.';

export function suggestRole (typed: string): string {
  const needle = typed.toLowerCase();

  if (isIconName(needle)) {
    return `${typed} is a brand, and a brand is a setting:  Database name [type: '${needle}']`;
  }

  const near = Object.keys(BUILTIN_ROLES)
    .filter((name) => {
      const known = name.toLowerCase();
      if (known.startsWith(needle) || needle.startsWith(known) || known.includes(needle)) return true;
      return within(known, needle, 2);
    })
    .slice(0, 6);
  if (near.length) return `Did you mean: ${near.join(', ')}?`;
  return `The roles are: ${Object.keys(BUILTIN_ROLES).join(', ')}.`;
}

// Edit distance, stopped as soon as it exceeds the budget
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

export function suggestIcon (typed: string): string {
  const needle = typed.toLowerCase();
  const near = [...ICON_NAMES, ...Object.keys(ICON_ALIAS)]
    .filter((n) => n.startsWith(needle) || needle.startsWith(n) || n.includes(needle))
    .slice(0, 6);
  if (near.length) return `Did you mean: ${near.join(', ')}?`;
  return `The pack has ${ICON_NAMES.length} marks; any other picture can be given as an image URL.`;
}
