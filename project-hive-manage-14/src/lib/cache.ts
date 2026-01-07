import { logger } from './logger';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

class Cache {
  private static instance: Cache;
  private cache: Map<string, CacheEntry<any>>;
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutos

  private constructor() {
    this.cache = new Map();
  }

  public static getInstance(): Cache {
    if (!Cache.instance) {
      Cache.instance = new Cache();
    }
    return Cache.instance;
  }

  public set<T>(key: string, data: T, ttl: number = this.DEFAULT_TTL): void {
    const now = Date.now();
    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + ttl
    });
    logger.debug(`[Cache] Dados armazenados para chave: ${key}`);
  }

  public get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      logger.debug(`[Cache] Cache miss para chave: ${key}`);
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      logger.debug(`[Cache] Cache expirado para chave: ${key}`);
      this.cache.delete(key);
      return null;
    }

    logger.debug(`[Cache] Cache hit para chave: ${key}`);
    return entry.data as T;
  }

  public delete(key: string): void {
    this.cache.delete(key);
    logger.debug(`[Cache] Cache limpo para chave: ${key}`);
  }

  public clear(): void {
    this.cache.clear();
    logger.debug('[Cache] Cache limpo completamente');
  }

  public getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

export const cache = Cache.getInstance(); 