interface DomainState {
  lastRequestAt: number;
  queue: Array<() => void>;
  processing: boolean;
}

export class RateLimiter {
  private readonly minIntervalMs: number;
  private readonly domains = new Map<string, DomainState>();

  constructor(minIntervalMs = 1000) {
    this.minIntervalMs = minIntervalMs;
  }

  private hostname(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  }

  throttle(url: string): Promise<void> {
    const domain = this.hostname(url);
    if (!this.domains.has(domain)) {
      this.domains.set(domain, {
        lastRequestAt: 0,
        queue: [],
        processing: false,
      });
    }
    const state = this.domains.get(domain)!;

    return new Promise<void>((resolve) => {
      state.queue.push(resolve);
      if (!state.processing) {
        void this.drainQueue(domain);
      }
    });
  }

  private async drainQueue(domain: string): Promise<void> {
    const state = this.domains.get(domain)!;
    state.processing = true;

    while (state.queue.length > 0) {
      const now = Date.now();
      const wait = this.minIntervalMs - (now - state.lastRequestAt);
      if (wait > 0) {
        await new Promise<void>((r) => setTimeout(r, wait));
      }
      state.lastRequestAt = Date.now();
      state.queue.shift()!();
    }

    state.processing = false;
  }
}
