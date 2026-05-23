"use client";

import { useMemo, useState } from "react";
import { Deck } from "@/types";
import { Grade, sm2 } from "@/lib/scheduler";
import { buildQueue, QueueItem } from "@/lib/queue";

interface Props {
  deck: Deck;
  allDecks: Deck[]; // needed for subdeck roll-up + parent limit resolution
  onGrade: (deckId: string, cardId: string, grade: Grade) => void;
  onExit: () => void;
}

const GRADE_CONFIG: { grade: Grade; label: string; className: string }[] = [
  {
    grade: "again",
    label: "Again",
    className:
      "rounded-full border border-accent bg-accent/10 py-3 font-medium text-accent transition hover:bg-accent/20",
  },
  {
    grade: "hard",
    label: "Hard",
    className:
      "rounded-full border border-line bg-paper-2 py-3 font-medium text-ink-soft transition hover:border-accent hover:text-accent",
  },
  {
    grade: "good",
    label: "Good",
    className:
      "rounded-full bg-accent-2 py-3 font-medium text-paper transition hover:opacity-90",
  },
  {
    grade: "easy",
    label: "Easy",
    className:
      "rounded-full border border-accent-2 bg-accent-2/10 py-3 font-medium text-accent-2 transition hover:bg-accent-2/20",
  },
];

export default function Practice({ deck, allDecks, onGrade, onExit }: Props) {
  const [phase, setPhase] = useState<"setup" | "playing">("setup");
  const now = Date.now();

  // All decks in this practice scope: the primary deck + all subdecks
  const practiceDecks = useMemo(
    () =>
      allDecks.filter(
        (d) => d.id === deck.id || d.name.startsWith(deck.name + "::"),
      ),
    [deck, allDecks],
  );

  // Queue is built once when the session starts
  const queueResult = useMemo(() => {
    if (phase !== "playing")
      return {
        items: [] as QueueItem[],
        newCount: 0,
        learningCount: 0,
        reviewCount: 0,
      };
    return buildQueue(practiceDecks, allDecks, now);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [stats, setStats] = useState({ correct: 0, wrong: 0 });

  const queue = queueResult.items;
  const currentItem: QueueItem | undefined = queue[idx];
  // Always look up card from allDecks in case state mutated since session start
  const currentCard = currentItem
    ? allDecks
        .find((d) => d.id === currentItem.deckId)
        ?.cards.find((c) => c.id === currentItem.card.id)
    : undefined;
  const done = phase === "playing" && idx >= queue.length;

  // Remaining counts in session (rough — based on initial queue)
  const remaining = {
    new: Math.max(
      0,
      queueResult.newCount -
        queue
          .slice(0, idx)
          .filter(
            (i) =>
              practiceDecks
                .find((d) => d.id === i.deckId)
                ?.cards.find((c) => c.id === i.card.id)?.state === "new" ||
              i.card.state === "new",
          ).length,
    ),
    learning: queueResult.learningCount,
    review: queueResult.reviewCount,
  };

  const handleGrade = (grade: Grade) => {
    if (!currentItem) return;
    onGrade(currentItem.deckId, currentItem.card.id, grade);
    setStats((s) => ({
      correct: s.correct + (grade === "again" ? 0 : 1),
      wrong: s.wrong + (grade === "again" ? 1 : 0),
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

  // Preview intervals for each grade button (pure — doesn't mutate)
  const previews = currentCard
    ? (Object.fromEntries(
        (["again", "hard", "good", "easy"] as Grade[]).map((g) => [
          g,
          sm2.preview(currentCard, g, now).label,
        ]),
      ) as Record<Grade, string>)
    : null;

  // ── Setup screen ─────────────────────────────────────────────────────────────
  if (phase === "setup") {
    // Show today's queue sizes to the user
    const preview = buildQueue(practiceDecks, allDecks, Date.now());
    const totalCards = practiceDecks.reduce((n, d) => n + d.cards.length, 0);
    return (
      <div className="animate-rise mx-auto max-w-xl">
        <button
          onClick={onExit}
          className="mb-6 text-sm text-ink-soft transition hover:text-accent"
        >
          ← Back to decks
        </button>
        <div className="rounded-3xl border border-line bg-paper-2 p-5 shadow-sm sm:p-8">
          <h2 className="font-display text-2xl font-bold text-ink">
            {deck.name}
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            {totalCards} card{totalCards !== 1 ? "s" : ""} total
          </p>

          {/* Today's session breakdown */}
          <div className="mt-5 grid grid-cols-3 gap-3">
            {[
              { label: "New", count: preview.newCount, color: "text-accent-2" },
              {
                label: "Learning",
                count: preview.learningCount,
                color: "text-ink-soft",
              },
              {
                label: "Review",
                count: preview.reviewCount,
                color: "text-accent",
              },
            ].map(({ label, count, color }) => (
              <div
                key={label}
                className="rounded-xl border border-line bg-paper px-3 py-2.5 text-center"
              >
                <p className={`text-xl font-bold ${color}`}>{count}</p>
                <p className="text-xs text-ink-soft/70">{label}</p>
              </div>
            ))}
          </div>

          <p className="mt-3 text-xs text-ink-soft/60">
            Limits: {deck.config.newPerDay} new/day ·{" "}
            {deck.config.maxReviewsPerDay} reviews/day
          </p>

          <button
            onClick={start}
            disabled={preview.items.length === 0}
            className="mt-6 w-full rounded-full bg-ink py-3 font-medium text-paper transition hover:bg-accent disabled:opacity-30"
          >
            {preview.items.length === 0
              ? "Nothing due today"
              : `Start session · ${preview.items.length} cards`}
          </button>
        </div>
      </div>
    );
  }

  // ── Done screen ───────────────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="animate-rise mx-auto max-w-xl">
        <div className="animate-scale-in rounded-3xl border border-line bg-paper-2 p-6 text-center shadow-sm sm:p-10">
          <p className="font-display text-2xl text-ink sm:text-3xl">
            Session complete
          </p>
          <p className="mt-3 text-ink-soft">
            <span className="text-accent-2">{stats.correct} correct</span>
            {" · "}
            <span className="text-accent">{stats.wrong} again</span>
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
      {/* Top bar: back + counts */}
      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={onExit}
          className="text-sm text-ink-soft transition hover:text-accent"
        >
          ← Back
        </button>
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded-full bg-accent-2/20 px-2 py-0.5 text-accent-2">
            {queueResult.newCount} new
          </span>
          <span className="rounded-full bg-paper-2 px-2 py-0.5 text-ink-soft">
            {queueResult.learningCount} lrn
          </span>
          <span className="rounded-full bg-accent/10 px-2 py-0.5 text-accent">
            {queueResult.reviewCount} rev
          </span>
          <span className="ml-1 text-ink-soft/60">
            {Math.min(idx + 1, queue.length)}/{queue.length}
          </span>
        </div>
      </div>

      {currentCard ? (
        <div key={idx} className="animate-slide-in-right">
          {/* Card state badge */}
          <div className="mb-2 flex justify-end">
            <span className="rounded-full border border-line px-2 py-0.5 text-xs text-ink-soft/60 capitalize">
              {currentItem?.card.state}
            </span>
          </div>

          {/* Flashcard — 3D flip */}
          <button
            onClick={() => setFlipped((f) => !f)}
            className="block w-full"
            aria-pressed={flipped}
            aria-label={flipped ? "Hide answer" : "Reveal answer"}
          >
            <div className="flip-card-scene">
              <div
                className={`flip-card-body min-h-[10rem] sm:min-h-[14rem] ${flipped ? "is-flipped" : ""}`}
              >
                {/* Front face */}
                <div className="flip-card-face flex min-h-[10rem] w-full flex-col items-center justify-center rounded-3xl border border-line bg-paper-2 p-5 text-center shadow-sm sm:min-h-[14rem] sm:p-8">
                  <p className="text-xs uppercase tracking-widest text-ink-soft/50">
                    Prompt
                  </p>
                  <p className="mt-3 font-display text-xl leading-snug text-ink sm:text-3xl">
                    {currentCard.front}
                  </p>
                  <p className="mt-5 text-xs text-ink-soft/50">tap to reveal</p>
                </div>

                {/* Back face */}
                <div className="flip-card-face flip-card-face--back flex min-h-[10rem] w-full flex-col items-center justify-center rounded-3xl border border-accent-2/40 bg-accent-2/5 p-5 text-center shadow-sm sm:min-h-[14rem] sm:p-8">
                  <p className="text-xs uppercase tracking-widest text-ink-soft/50">
                    Answer
                  </p>
                  <p className="mt-3 font-display text-xl leading-snug text-ink sm:text-3xl">
                    {currentCard.back}
                  </p>
                  {currentCard.examples.length > 0 && (
                    <ul className="mt-5 space-y-1.5 text-left text-sm">
                      {currentCard.examples.slice(0, 3).map((ex, i) => (
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
                  <p className="mt-5 text-xs text-ink-soft/50">tap to hide</p>
                </div>
              </div>
            </div>
          </button>

          {/* 4-button grading row */}
          {flipped && (
            <div className="mt-4 grid grid-cols-4 gap-2 animate-rise">
              {GRADE_CONFIG.map(({ grade, label, className }) => (
                <button
                  key={grade}
                  onClick={() => handleGrade(grade)}
                  className={`flex flex-col items-center ${className} px-1 active:scale-95`}
                >
                  <span>{label}</span>
                  {previews && (
                    <span className="mt-0.5 text-xs opacity-70">
                      {previews[grade]}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
