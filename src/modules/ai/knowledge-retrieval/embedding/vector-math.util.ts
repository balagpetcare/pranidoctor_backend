export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function normalizeScore(value: number, min: number, max: number): number {
  if (max <= min) return value > 0 ? 1 : 0;
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}

export function hashEmbeddingText(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(16, '0');
}

/** Deterministic pseudo-embedding for local dev / ops when no provider is configured. */
export function deterministicEmbedVector(text: string, dimensions = 1536): number[] {
  const vector = new Array<number>(dimensions).fill(0);
  const normalized = text.trim().normalize('NFC');
  for (let i = 0; i < normalized.length; i += 1) {
    const idx = (normalized.charCodeAt(i) * (i + 1)) % dimensions;
    vector[idx] = (vector[idx] ?? 0) + normalized.charCodeAt(i) / 255;
  }
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1;
  return vector.map((v) => v / norm);
}
