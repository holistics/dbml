import type Compiler from './index';

export const CACHE_STORAGE = Symbol('compilerCache');
export type CacheStorage = Map<string, Map<any, any> | any>;

export interface QueryOptions {
  toKey?: (...args: any[]) => unknown;
}

type AnyMethod = (...args: any[]) => any;

/**
 * Method decorator that adds caching and auto-binds to instance.
 * Uses TypeScript 5.0+ native decorators with context.addInitializer for auto-binding.
 * The method name is used as the cache key.
 *
 * @param options - Optional configuration for caching behavior
 */
export function query<This, Args extends unknown[], Return> (
  options?: QueryOptions,
): (
  target: (this: This, ...args: Args) => Return,
  context: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Return>,
) => (this: This, ...args: Args) => Return {
  return function (
    target: (this: This, ...args: Args) => Return,
    context: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Return>,
  ): (this: This, ...args: Args) => Return {
    const methodName = String(context.name);

    // Wrapped method with caching
    const cachedMethod = function (this: This, ...args: Args): Return {
      const compiler = this as unknown as Compiler;
      const cache = compiler[CACHE_STORAGE] as CacheStorage;

      if (args.length === 0) {
        if (cache.has(methodName) && !(cache.get(methodName) instanceof Map)) {
          return cache.get(methodName);
        }
        const result = target.apply(this, args);
        cache.set(methodName, result);
        return result;
      }

      const key = options?.toKey ? options.toKey(...args) : args.length === 1 ? args[0] : args;
      let mapCache = cache.get(methodName);

      if (mapCache instanceof Map && mapCache.has(key)) {
        return mapCache.get(key);
      }

      const result = target.apply(this, args);

      if (!(mapCache instanceof Map)) {
        mapCache = new Map();
        cache.set(methodName, mapCache);
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
