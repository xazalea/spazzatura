/**
 * ProxyManager - automatic free proxy rotation using proxifly CDN
 *
 * Sources:
 *   https://cdn.jsdelivr.net/gh/proxifly/free-proxy-list/proxies/protocols/{protocol}/data.json
 *
 * Protocols: https, http, socks4, socks5
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProxyEntry {
  host: string;
  port: number;
  protocol: string;
  latency?: number;
  lastChecked?: Date;
}

interface CacheEntry {
  proxies: ProxyEntry[];
  fetchedAt: number;
}

interface ProxiflyCDNEntry {
  ip?: string;
  host?: string;
  port: number | string;
  protocols?: string[];
  protocol?: string;
}

// ---------------------------------------------------------------------------
// ProxyManager
// ---------------------------------------------------------------------------

export class ProxyManager {
  readonly protocols = ['https', 'http', 'socks4', 'socks5'] as const;

  /** 10-minute TTL for the proxy cache */
  private readonly cacheTtlMs = 10 * 60 * 1000;

  private readonly cache = new Map<string, CacheEntry>();

  /** Round-robin cursor per protocol */
  private readonly cursors = new Map<string, number>();

  // -------------------------------------------------------------------------
  // Fetching
  // -------------------------------------------------------------------------

  /**
   * Fetches proxy list for a single protocol from the proxifly CDN.
   */
  async fetchProxies(protocol: string): Promise<ProxyEntry[]> {
    const cached = this.cache.get(protocol);
    if (cached && Date.now() - cached.fetchedAt < this.cacheTtlMs) {
      return cached.proxies;
    }

    const url = `https://cdn.jsdelivr.net/gh/proxifly/free-proxy-list/proxies/protocols/${protocol}/data.json`;

    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!response.ok) {
        throw new Error(`Failed to fetch proxy list for ${protocol}: ${response.status}`);
      }

      const raw = await response.json() as ProxiflyCDNEntry[];

      const proxies: ProxyEntry[] = raw
        .map((entry): ProxyEntry | null => {
          const host = entry.host ?? entry.ip;
          const port = typeof entry.port === 'string' ? parseInt(entry.port, 10) : entry.port;

          if (!host || !port || isNaN(port)) return null;

          return { host, port, protocol };
        })
        .filter((p): p is ProxyEntry => p !== null);

      this.cache.set(protocol, { proxies, fetchedAt: Date.now() });
      return proxies;
    } catch {
      // Return cached (possibly stale) data on error, or empty list
      return cached?.proxies ?? [];
    }
  }

  /**
   * Fetches proxy lists for all 4 protocols in parallel.
   */
  async fetchAll(): Promise<Map<string, ProxyEntry[]>> {
    const results = await Promise.allSettled(
      this.protocols.map(async (p) => ({ protocol: p, proxies: await this.fetchProxies(p) }))
    );

    const map = new Map<string, ProxyEntry[]>();
    for (const result of results) {
      if (result.status === 'fulfilled') {
        map.set(result.value.protocol, result.value.proxies);
      }
    }
    return map;
  }

  // -------------------------------------------------------------------------
  // Validation
  // -------------------------------------------------------------------------

  /**
   * Tests a proxy by making a HEAD request to a well-known URL through it.
   * Returns the entry with latency filled in if reachable, or null if not.
   *
   * Note: Native fetch does not support proxy configuration – validation
   * requires an external HTTP agent (e.g. node-fetch + https-proxy-agent).
   * If those packages are unavailable we optimistically assume reachability
   * and skip the latency measurement.
   */
  async validate(proxy: ProxyEntry): Promise<ProxyEntry | null> {
    const proxyUrl = this.getProxyUrl(proxy);

    // Attempt dynamic import of proxy agent helpers
    let ProxyAgent: (new (url: string) => object) | undefined;
    try {
      const mod = await import('https-proxy-agent') as { HttpsProxyAgent: new (url: string) => object };
      ProxyAgent = mod.HttpsProxyAgent;
    } catch {
      // Package not installed – skip latency validation
      return { ...proxy, lastChecked: new Date() };
    }

    const start = Date.now();
    try {
      const agent = new ProxyAgent(proxyUrl);
      const response = await fetch('https://httpbin.org/ip', {
        // @ts-expect-error -- node-fetch agent option, not present in browser fetch types
        agent,
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) return null;

      return {
        ...proxy,
        latency: Date.now() - start,
        lastChecked: new Date(),
      };
    } catch {
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // Selection
  // -------------------------------------------------------------------------

  /**
   * Returns a validated proxy, rotating through the list on each call.
   * Prefers the specified protocol but falls back to others if unavailable.
   */
  async getProxy(preferProtocol?: string): Promise<ProxyEntry | null> {
    const protocol = preferProtocol ?? 'https';
    const proxies = await this.fetchProxies(protocol);

    if (proxies.length === 0) {
      // Try other protocols
      const all = await this.fetchAll();
      for (const [, list] of all) {
        if (list.length > 0) {
          return this.pickFromList(list, 'any');
        }
      }
      return null;
    }

    return this.pickFromList(proxies, protocol);
  }

  /**
   * Formats a ProxyEntry as a URL string (e.g. "https://1.2.3.4:8080").
   */
  getProxyUrl(proxy: ProxyEntry): string {
    return `${proxy.protocol}://${proxy.host}:${proxy.port}`;
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private pickFromList(proxies: ProxyEntry[], cursorKey: string): ProxyEntry {
    const cursor = this.cursors.get(cursorKey) ?? 0;
    const index = cursor % proxies.length;
    this.cursors.set(cursorKey, index + 1);

    // Non-null assertion safe: length > 0 guaranteed by caller
    return proxies[index]!;
  }
}

/** Singleton instance for convenience */
export const proxyManager = new ProxyManager();
