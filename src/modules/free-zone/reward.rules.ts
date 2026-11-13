export type PrizeInput = { rank: number; title: string; description?: string | undefined };

export type PeriodInput = {
  title: string;
  startsAt: Date;
  endsAt: Date;
  topN: number;
  minPoints: number;
  prizes: PrizeInput[];
};

/** Validates an admin-created reward period. Returns a Bangla error or null. */
export function checkPeriod(i: PeriodInput): string | null {
  if (i.title.trim().length < 3) return 'শিরোনাম কমপক্ষে ৩ অক্ষরের হতে হবে।';
  if (!(i.startsAt < i.endsAt)) return 'শেষ তারিখ শুরুর পরে হতে হবে।';
  if (!Number.isInteger(i.topN) || i.topN < 1 || i.topN > 20) return 'বিজয়ীর সংখ্যা ১ থেকে ২০ এর মধ্যে হতে হবে।';
  if (!Number.isInteger(i.minPoints) || i.minPoints < 1) return 'ন্যূনতম পয়েন্ট কমপক্ষে ১ হতে হবে।';
  const seen = new Set<number>();
  for (const p of i.prizes) {
    if (!Number.isInteger(p.rank) || p.rank < 1 || p.rank > i.topN) return `পুরস্কারের র‍্যাঙ্ক ১ থেকে ${i.topN} এর মধ্যে হতে হবে।`;
    if (seen.has(p.rank)) return 'একই র‍্যাঙ্কে দুটি পুরস্কার দেওয়া যাবে না।';
    seen.add(p.rank);
    if (p.title.trim().length < 2) return 'প্রতিটি পুরস্কারের নাম দিন।';
  }
  return null;
}

export type PointRow = { userId: string; points: number };

/** Ranks by points (desc); ties are broken by userId so the result is deterministic. */
export function rankWinners(rows: PointRow[], topN: number, minPoints: number): (PointRow & { rank: number })[] {
  return rows
    .filter((r) => r.points >= minPoints)
    .sort((a, b) => b.points - a.points || (a.userId < b.userId ? -1 : 1))
    .slice(0, topN)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

export type PeriodStatus = 'DRAFT' | 'ACTIVE' | 'CLOSED';

/** Allowed status moves: DRAFT→ACTIVE, DRAFT|ACTIVE→CLOSED. CLOSED is final. */
export function canMove(from: string, to: string): boolean {
  return (from === 'DRAFT' && to === 'ACTIVE') || ((from === 'DRAFT' || from === 'ACTIVE') && to === 'CLOSED');
}

export const WINNER_ACTIONS = ['award', 'revoke'] as const;
export type WinnerAction = (typeof WINNER_ACTIONS)[number];
