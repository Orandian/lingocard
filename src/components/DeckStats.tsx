"use client";

import { Deck } from "@/types";

interface Props {
  deck: Deck;
  allDecks: Deck[]; // for including subdecks
  onClose: () => void;
}

const MS_DAY = 86_400_000;

function bar(value: number, max: number, colorClass: string) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-paper-2">
      <div
        className={`h-full rounded-full transition-all ${colorClass}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default function DeckStats({ deck, allDecks, onClose }: Props) {
  const now = Date.now();

  // Collect cards from this deck and all subdecks
  const deckScope = allDecks.filter(
    (d) => d.id === deck.id || d.name.startsWith(deck.name + "::"),
  );
  const cards = deckScope.flatMap((d) => d.cards);

  // ── State breakdown ───────────────────────────────────────────────────────────
  const counts = { new: 0, learning: 0, review: 0, lapsed: 0 };
  for (const c of cards) counts[c.state]++;
  const total = cards.length;

  // ── 7-day forecast ────────────────────────────────────────────────────────────
  // Count cards due on each of the next 7 calendar days.
  const forecast = Array.from({ length: 7 }, (_, i) => {
    const start = now + i * MS_DAY;
    const end = start + MS_DAY;
    return cards.filter((c) => c.due >= start && c.due < end).length;
  });
  const forecastMax = Math.max(1, ...forecast);

  // ── Retention approximation ───────────────────────────────────────────────────
  // Approximated from card history: retention ≈ 1 - (lapses / (reps + lapses)).
  // Only review-state cards have enough history to be meaningful.
  // Labeled "~approx" since we don't store a full review log.
  const reviewCards = cards.filter((c) => c.state === "review");
  let retentionPct: number | null = null;
  if (reviewCards.length > 0) {
    const totalReps = reviewCards.reduce((s, c) => s + c.reps + c.lapses, 0);
    const totalLapses = reviewCards.reduce((s, c) => s + c.lapses, 0);
    retentionPct =
      totalReps > 0 ? Math.round((1 - totalLapses / totalReps) * 100) : null;
  }

  const days = ["Today", "D+1", "D+2", "D+3", "D+4", "D+5", "D+6"];

  const STATE_ROWS: {
    key: keyof typeof counts;
    label: string;
    color: string;
  }[] = [
    { key: "new", label: "New", color: "bg-accent-2" },
    { key: "learning", label: "Learning", color: "bg-ink-soft" },
    { key: "review", label: "Review", color: "bg-accent" },
    { key: "lapsed", label: "Lapsed", color: "bg-red-400" },
  ];

  return (
    <div className="mt-3 rounded-2xl border border-line bg-paper p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold text-ink">
          Stats — {deck.name}
        </h3>
        <button
          onClick={onClose}
          className="text-sm text-ink-soft/60 transition hover:text-accent"
        >
          ✕
        </button>
      </div>

      {/* State breakdown */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-ink-soft/60">
          Card states
        </p>
        {STATE_ROWS.map(({ key, label, color }) => (
          <div key={key} className="flex items-center gap-3">
            <span className="w-16 text-sm text-ink-soft">{label}</span>
            <div className="flex-1">{bar(counts[key], total, color)}</div>
            <span className="w-8 text-right text-sm font-medium text-ink">
              {counts[key]}
            </span>
          </div>
        ))}
        <p className="pt-1 text-xs text-ink-soft/50">{total} cards total</p>
      </div>

      {/* Retention */}
      {retentionPct !== null && (
        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-soft/60">
            Retention <span className="normal-case font-normal">(~approx)</span>
          </p>
          <div className="mt-2 flex items-center gap-3">
            <div className="flex-1">
              {bar(
                retentionPct,
                100,
                retentionPct >= 80 ? "bg-accent-2" : "bg-accent",
              )}
            </div>
            <span className="text-sm font-medium text-ink">
              {retentionPct}%
            </span>
          </div>
          <p className="mt-1 text-xs text-ink-soft/50">
            Estimated from reps vs lapses across {reviewCards.length} review
            card{reviewCards.length !== 1 ? "s" : ""}. Does not account for
            cards still in learning.
          </p>
        </div>
      )}

      {/* 7-day forecast */}
      <div className="mt-5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-soft/60">
          Due next 7 days
        </p>
        <div className="flex items-end gap-1.5">
          {forecast.map((count, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-xs font-medium text-ink">
                {count > 0 ? count : ""}
              </span>
              <div
                className={`w-full rounded-t ${i === 0 ? "bg-accent" : "bg-paper-2 border border-line"}`}
                style={{
                  height: `${Math.max(4, Math.round((count / forecastMax) * 60))}px`,
                }}
              />
              <span className="text-xs text-ink-soft/60">{days[i]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
