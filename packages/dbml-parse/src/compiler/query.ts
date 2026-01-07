import type Compiler from './index';

export const CACHE_STORAGE = Symbol('compilerCache');
export type CacheStorage = Map<string, Map<any, any> | any>;

export interface QueryOptions<TArg = unknown, TKey = TArg> {
  toKey?: (arg: TArg) => TKey;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyMethod = (...args: any[]) => any;

/**
 * Method decorator that adds caching and auto-binds to instance.
 * Uses TypeScript 5.0+ native decorators with context.addInitializer for auto-binding.
 *
 * @param queryId - Unique identifier for this query (used as cache key)
 * @param options - Optional configuration for caching behavior
 */
export function query<This, Args extends unknown[], Return> (
  queryId: string,
  options?: QueryOptions<Args[0], unknown>,
): (
  target: (this: This, ...args: Args) => Return,
  context: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Return>,
) => (this: This, ...args: Args) => Return {
  return function (
    target: (this: This, ...args: Args) => Return,
    context: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Return>,
  ): (this: This, ...args: Args) => Return {
    const methodName = context.name;

    // Wrapped method with caching
    const cachedMethod = function (this: This, ...args: Args): Return {
      const compiler = this as unknown as Compiler;
      const cache = compiler[CACHE_STORAGE] as CacheStorage;
      const arg = args[0];

      if (arg === undefined) {
        if (cache.has(queryId) && !(cache.get(queryId) instanceof Map)) {
          return cache.get(queryId);
        }
        const result = target.apply(this, args);
        cache.set(queryId, result);
        return result;
      }

      const key = options?.toKey ? options.toKey(arg) : arg;
      let mapCache = cache.get(queryId);

      if (mapCache instanceof Map && mapCache.has(key)) {
        return mapCache.get(key);
      }

      const result = target.apply(this, args);

      if (!(mapCache instanceof Map)) {
        mapCache = new Map();
        cache.set(queryId, mapCache);
      }
      mapCache.set(key, result);

      return result;
    } as (this: This, ...args: Args) => Return;

    // Auto-bind on instance initialization
    context.addInitializer(function (this: This) {
      (this as unknown as Record<string | symbol, AnyMethod>)[methodName] = cachedMethod.bind(this);
    });

    return cachedMethod;
  };
}

export function createCacheStorage (): CacheStorage {
  return new Map();
}

export function clearCache (cache: CacheStorage): void {
  cache.clear();
}
