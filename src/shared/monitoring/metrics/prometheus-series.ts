export type MetricLabels = Record<string, string>;

export function counterKey(labels: MetricLabels): string {
  return Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join(',');
}

export function sanitizeLabel(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ');
}

function labelsToString(key: string): string {
  return key
    .split(',')
    .filter(Boolean)
    .map((pair) => {
      const eq = pair.indexOf('=');
      const k = pair.slice(0, eq);
      const v = pair.slice(eq + 1);
      return `${k}="${sanitizeLabel(v)}"`;
    })
    .join(',');
}

export class Counter {
  private readonly values = new Map<string, number>();

  inc(labels: MetricLabels, amount = 1): void {
    const key = counterKey(labels);
    this.values.set(key, (this.values.get(key) ?? 0) + amount);
  }

  entries(name: string, help: string): string[] {
    const lines = [`# HELP ${name} ${help}`, `# TYPE ${name} counter`];
    for (const [key, value] of this.values.entries()) {
      const labelStr = labelsToString(key);
      lines.push(labelStr ? `${name}{${labelStr}} ${value}` : `${name} ${value}`);
    }
    return lines;
  }

  clear(): void {
    this.values.clear();
  }
}

/** Lightweight latency histogram (fixed buckets, in seconds). */
export class LatencyHistogram {
  private readonly counts = new Map<string, number[]>();
  private readonly sums = new Map<string, number>();
  private readonly totals = new Map<string, number>();

  constructor(private readonly bucketsSec: number[]) {
    this.bucketsSec = [...bucketsSec].sort((a, b) => a - b);
  }

  observe(labels: MetricLabels, durationSec: number): void {
    const key = counterKey(labels);
    if (!this.counts.has(key)) {
      this.counts.set(key, new Array(this.bucketsSec.length + 1).fill(0));
      this.sums.set(key, 0);
      this.totals.set(key, 0);
    }
    const bucketCounts = this.counts.get(key)!;
    for (let i = 0; i < this.bucketsSec.length; i++) {
      if (durationSec <= this.bucketsSec[i]!) bucketCounts[i]! += 1;
    }
    bucketCounts[this.bucketsSec.length]! += 1;
    this.sums.set(key, (this.sums.get(key) ?? 0) + durationSec);
    this.totals.set(key, (this.totals.get(key) ?? 0) + 1);
  }

  entries(name: string, help: string): string[] {
    const lines = [`# HELP ${name} ${help}`, `# TYPE ${name} histogram`];
    for (const [key, bucketCounts] of this.counts.entries()) {
      const labelStr = labelsToString(key);
      let cumulative = 0;
      for (let i = 0; i < this.bucketsSec.length; i++) {
        cumulative += bucketCounts[i] ?? 0;
        lines.push(`${name}_bucket{${labelStr},le="${this.bucketsSec[i]}"} ${cumulative}`);
      }
      cumulative += bucketCounts[this.bucketsSec.length] ?? 0;
      lines.push(`${name}_bucket{${labelStr},le="+Inf"} ${cumulative}`);
      lines.push(`${name}_sum{${labelStr}} ${this.sums.get(key) ?? 0}`);
      lines.push(`${name}_count{${labelStr}} ${this.totals.get(key) ?? 0}`);
    }
    return lines;
  }

  clear(): void {
    this.counts.clear();
    this.sums.clear();
    this.totals.clear();
  }
}

export class Gauge {
  private readonly values = new Map<string, number>();

  set(labels: MetricLabels, value: number): void {
    this.values.set(counterKey(labels), value);
  }

  setUnlabeled(value: number): void {
    this.values.set('', value);
  }

  entries(name: string, help: string): string[] {
    const lines = [`# HELP ${name} ${help}`, `# TYPE ${name} gauge`];
    for (const [key, value] of this.values.entries()) {
      if (!key) {
        lines.push(`${name} ${value}`);
      } else {
        lines.push(`${name}{${labelsToString(key)}} ${value}`);
      }
    }
    return lines;
  }

  clear(): void {
    this.values.clear();
  }
}
