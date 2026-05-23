/**
 * Per-deck, per-day review counters stored in localStorage.
 * Key format: "{deckId}:{YYYY-MM-DD}:{new|review}"
 */

const COUNTS_KEY = "lingocard.counts.v1";

export function todayStr(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function loadAll(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(COUNTS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

function saveAll(counts: Record<string, number>): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(COUNTS_KEY, JSON.stringify(counts));
}

export function getCount(deckId: string, type: "new" | "review"): number {
  return loadAll()[`${deckId}:${todayStr()}:${type}`] ?? 0;
}

export function increment(deckId: string, type: "new" | "review"): void {
  const all = loadAll();
  const k = `${deckId}:${todayStr()}:${type}`;
  all[k] = (all[k] ?? 0) + 1;
  saveAll(all);
}

/** Load all counts for external use (e.g. queue builder). */
export function loadCounts(): Record<string, number> {
  return loadAll();
}
