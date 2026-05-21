"use client";

import { useMemo, useState } from "react";
import { Deck, Card } from "@/types";
import { dueCards, newCards } from "@/store/useDecks";

interface Props {
  deck: Deck;
  onGrade: (deckId: string, cardId: string, correct: boolean) => void;
  onExit: () => void;
}

type BoxFilter = "all" | "due" | "box1" | "box1-2";

const BOX_FILTER_LABELS: Record<BoxFilter, string> = {
  all: "All cards",
  due: "Due only",
  box1: "Box 1 (struggling)",
  "box1-2": "Box 1–2",
};

export default function Practice({ deck, onGrade, onExit }: Props) {
  const [phase, setPhase] = useState<"setup" | "playing">("setup");
  const [boxFilter, setBoxFilter] = useState<BoxFilter>("due");
  const [sessionLimit, setSessionLimit] = useState<number>(
    deck.dailyLimit ?? 20,
  );

  const due = dueCards(deck);
  const fresh = newCards(deck);

  // Build the queue only when the session starts
  const queue = useMemo(() => {
    if (phase !== "playing") return [];

    let pool: Card[];
    switch (boxFilter) {
      case "due":
        pool = due.length > 0 ? due : deck.cards;
        break;
      case "box1":
        pool = deck.cards.filter((c) => c.box === 1);
        break;
      case "box1-2":
        pool = deck.cards.filter((c) => c.box <= 2);
        break;
      default:
        pool = deck.cards;
    }

    // Cap new (never-reviewed) cards at the session limit
    const seenIds = new Set(due.map((c) => c.id));
    const seenCards = pool.filter((c) => seenIds.has(c.id));
    const unseenCards = pool.filter((c) => !seenIds.has(c.id));
    const limitedUnseen = unseenCards.slice(0, sessionLimit);
    const combined =
      boxFilter === "all"
        ? pool.slice(0, sessionLimit)
        : [...seenCards, ...limitedUnseen];

    return [...combined].sort(() => Math.random() - 0.5).map((c) => c.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [stats, setStats] = useState({ correct: 0, wrong: 0 });

  const currentId = queue[idx];
  const card = deck.cards.find((c) => c.id === currentId);
  const done = phase === "playing" && idx >= queue.length;

  const grade = (correct: boolean) => {
    if (!card) return;
    onGrade(deck.id, card.id, correct);
    setStats((s) => ({
      correct: s.correct + (correct ? 1 : 0),
      wrong: s.wrong + (correct ? 0 : 1),
    }));
    setFlipped(false);
    setIdx((i) => i + 1);
  };

  const start = () => {
    setIdx(0);
    setFlipped(false);
    setStats({ correct: 0, wrong: 0 });
    setPhase("playing");
  };

  // ── Setup screen ─────────────────────────────────────────────────────────────
  if (phase === "setup") {
    return (
      <div className="animate-rise mx-auto max-w-xl">
        <button
          onClick={onExit}
          className="mb-6 text-sm text-ink-soft transition hover:text-accent"
        >
          ← Back to decks
        </button>

        <div className="rounded-3xl border border-line bg-paper-2/50 p-8 shadow-sm">
          <h2 className="font-display text-2xl font-bold text-ink">
            {deck.name}
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            {deck.cards.length} cards · {due.length} due · {fresh.length} new
          </p>

          <div className="mt-6 space-y-5">
            {/* Box filter */}
            <div>
              <p className="mb-2 text-sm font-medium text-ink">
                Cards to study
              </p>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(BOX_FILTER_LABELS) as BoxFilter[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setBoxFilter(f)}
                    className={`rounded-xl border px-4 py-2.5 text-left text-sm transition ${
                      boxFilter === f
                        ? "border-accent-2 bg-accent-2/10 font-medium text-accent-2"
                        : "border-line text-ink-soft hover:border-accent hover:text-ink"
                    }`}
                  >
                    {BOX_FILTER_LABELS[f]}
                  </button>
                ))}
              </div>
            </div>

            {/* Session new-card limit */}
            <div>
              <label className="mb-2 block text-sm font-medium text-ink">
                New cards this session
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={1}
                  max={Math.max(50, deck.cards.length)}
                  value={sessionLimit}
                  onChange={(e) => setSessionLimit(Number(e.target.value))}
                  className="flex-1 accent-accent-2"
                />
                <span className="w-10 text-right text-sm font-medium text-ink">
                  {sessionLimit}
                </span>
              </div>
              {deck.dailyLimit && (
                <p className="mt-1 text-xs text-ink-soft/60">
                  Deck default: {deck.dailyLimit}/day
                </p>
              )}
            </div>
          </div>

          <button
            onClick={start}
            disabled={deck.cards.length === 0}
            className="mt-8 w-full rounded-full bg-ink py-3 font-medium text-paper transition hover:bg-accent disabled:opacity-30"
          >
            Start session
          </button>
        </div>
      </div>
    );
  }

  // ── Done screen ───────────────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="animate-rise mx-auto max-w-xl">
        <div className="rounded-3xl border border-line bg-paper-2/50 p-10 text-center shadow-sm">
          <p className="font-display text-3xl text-ink">Session complete</p>
          <p className="mt-3 text-ink-soft">
            <span className="text-accent-2">{stats.correct} correct</span>
            {" · "}
            <span className="text-accent">{stats.wrong} to review</span>
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <button
              onClick={() => {
                setPhase("setup");
              }}
              className="rounded-full border border-line px-6 py-2.5 text-ink-soft transition hover:border-accent hover:text-accent"
            >
              New session
            </button>
            <button
              onClick={onExit}
              className="rounded-full bg-ink px-6 py-2.5 text-paper transition hover:bg-accent"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Playing screen ────────────────────────────────────────────────────────────
  return (
    <div className="animate-rise mx-auto max-w-xl">
      <div className="mb-5 flex items-center justify-between">
        <button
          onClick={onExit}
          className="text-sm text-ink-soft transition hover:text-accent"
        >
          ← Back
        </button>
        <span className="text-sm text-ink-soft">
          {Math.min(idx + 1, queue.length)} / {queue.length}
        </span>
      </div>

      {card ? (
        <div>
          <button
            onClick={() => setFlipped((f) => !f)}
            className="block w-full"
          >
            <div
              className={`flex min-h-[14rem] flex-col items-center justify-center rounded-3xl border p-8 text-center shadow-sm transition ${
                flipped
                  ? "border-accent-2/40 bg-accent-2/5"
                  : "border-line bg-paper-2/50"
              }`}
            >
              <p className="text-xs uppercase tracking-widest text-ink-soft/50">
                {flipped ? "Answer" : "Prompt"}
              </p>
              <p className="mt-3 font-display text-3xl leading-snug text-ink">
                {flipped ? card.back : card.front}
              </p>
              {flipped && card.examples.length > 0 && (
                <ul className="mt-5 space-y-1.5 text-left text-sm">
                  {card.examples.slice(0, 3).map((ex, i) => (
                    <li key={i} className="text-ink-soft">
                      {ex.source}
                      {ex.target ? (
                        <>
                          <span className="mx-1 text-accent">→</span>
                          {ex.target}
                        </>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-5 text-xs text-ink-soft/50">
                tap to {flipped ? "hide" : "reveal"}
              </p>
            </div>
          </button>

          {flipped && (
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => grade(false)}
                className="flex-1 rounded-full border border-accent bg-accent/10 py-3 font-medium text-accent transition hover:bg-accent/20"
              >
                Got it wrong
              </button>
              <button
                onClick={() => grade(true)}
                className="flex-1 rounded-full bg-accent-2 py-3 font-medium text-white transition hover:opacity-90"
              >
                Got it right
              </button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
