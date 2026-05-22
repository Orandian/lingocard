/**
 * SM-2 scheduler — swappable via the Scheduler interface.
 * FSRS or any other algorithm can replace this by implementing the same interface.
 */
import { Card, CardState } from "@/types";

export type Grade = "again" | "hard" | "good" | "easy";

export interface ReviewPreview {
  label: string; // human-readable next interval, e.g. "1m", "10m", "4d"
  intervalMs: number;
}

/** Pluggable scheduler interface. */
export interface Scheduler {
  /** Apply a grade and return an updated copy of the card (pure, no DB writes). */
  review(card: Card, grade: Grade, now: number): Card;
  /** Predict next interval for each grade without mutating the card. */
  preview(card: Card, grade: Grade, now: number): ReviewPreview;
}

// ── Constants ─────────────────────────────────────────────────────────────────

/** Learning step durations in minutes.
 *  New cards cycle through [1 min → 10 min] before graduating to review. */
const LEARN_STEPS_MIN = [1, 10];

export const START_EASE = 2.5; // initial ease factor for new cards
const MIN_EASE = 1.3; // ease floor (Anki spec)
const MS_MIN = 60_000;
const MS_DAY = 86_400_000;

// ── Helpers ───────────────────────────────────────────────────────────────────

function clampEase(e: number): number {
  return Math.max(MIN_EASE, Math.round(e * 100) / 100);
}

/** Add ±5% fuzz so all cards don't cluster on the same day. */
function fuzz(days: number): number {
  if (days < 2) return days;
  const delta = Math.max(1, Math.round(days * 0.05));
  return days + Math.floor(Math.random() * (delta * 2 + 1)) - delta;
}

function fmt(ms: number): string {
  const mins = Math.round(ms / MS_MIN);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(ms / 3_600_000);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.round(ms / MS_DAY)}d`;
}

// ── Core computation (pure) ───────────────────────────────────────────────────

interface Fields {
  state: CardState;
  ease: number;
  interval: number; // days (preserved on lapsed cards; 0 during learning)
  reps: number; // step index during learning; successive-correct count on review
  lapses: number;
  offsetMs: number; // milliseconds from now until next due
}

function compute(card: Card, grade: Grade): Fields {
  const { state, ease, interval, reps, lapses } = card;

  // ── Learning / Lapsed path ─────────────────────────────────────────────────
  // Both "learning" (unseen cards) and "lapsed" (relearning after a miss) use
  // the same step table. `reps` is the current step index (0-based).
  // When a lapsed card graduates, its interval is halved instead of reset to 1d.
  if (state === "new" || state === "learning" || state === "lapsed") {
    const nextState: CardState = state === "new" ? "learning" : state;
    // Graduation interval: halved for lapsed cards, 1 day for new/learning
    const gradInterval =
      state === "lapsed" ? Math.max(1, Math.ceil(interval * 0.5)) : 1;

    switch (grade) {
      case "again":
        // Restart learning from step 0
        return {
          state: nextState,
          ease,
          interval,
          reps: 0,
          lapses,
          offsetMs: LEARN_STEPS_MIN[0] * MS_MIN,
        };

      case "hard": {
        // Stay on current step (no advancement)
        const stepMs =
          LEARN_STEPS_MIN[Math.min(reps, LEARN_STEPS_MIN.length - 1)] * MS_MIN;
        return {
          state: nextState,
          ease,
          interval,
          reps,
          lapses,
          offsetMs: stepMs,
        };
      }

      case "good":
        if (reps < LEARN_STEPS_MIN.length - 1) {
          // Advance to next learning step
          return {
            state: nextState,
            ease,
            interval,
            reps: reps + 1,
            lapses,
            offsetMs: LEARN_STEPS_MIN[reps + 1] * MS_MIN,
          };
        }
        // Graduate to review
        return {
          state: "review",
          ease,
          interval: gradInterval,
          reps: 1,
          lapses,
          offsetMs: gradInterval * MS_DAY,
        };

      case "easy": // Skip remaining steps; graduate with a boosted starting interval
      {
        const easyInterval = Math.max(gradInterval, 4);
        return {
          state: "review",
          ease: clampEase(ease + 0.15),
          interval: easyInterval,
          reps: 1,
          lapses,
          offsetMs: easyInterval * MS_DAY,
        };
      }
    }
  }

  // ── Review path ─────────────────────────────────────────────────────────────
  // Standard SM-2 formulas:
  //   again  → lapse:  ease − 0.20 (floor 1.3), relearn from step 0
  //   hard   → slow:   interval × 1.2,  ease − 0.15
  //   good   → normal: interval × ease
  //   easy   → fast:   interval × ease × 1.3, ease + 0.15
  switch (grade) {
    case "again":
      return {
        state: "lapsed",
        ease: clampEase(ease - 0.2),
        interval, // preserved so graduation halves it, not resets it
        reps: 0,
        lapses: lapses + 1,
        offsetMs: LEARN_STEPS_MIN[0] * MS_MIN,
      };

    case "hard": {
      const i = fuzz(Math.max(interval + 1, Math.ceil(interval * 1.2)));
      return {
        state: "review",
        ease: clampEase(ease - 0.15),
        interval: i,
        reps: reps + 1,
        lapses,
        offsetMs: i * MS_DAY,
      };
    }

    case "good": {
      const i = fuzz(Math.max(interval + 1, Math.ceil(interval * ease)));
      return {
        state: "review",
        ease,
        interval: i,
        reps: reps + 1,
        lapses,
        offsetMs: i * MS_DAY,
      };
    }

    case "easy": {
      const i = fuzz(Math.max(interval + 1, Math.ceil(interval * ease * 1.3)));
      return {
        state: "review",
        ease: clampEase(ease + 0.15),
        interval: i,
        reps: reps + 1,
        lapses,
        offsetMs: i * MS_DAY,
      };
    }
  }
}

// ── Exported SM-2 scheduler ───────────────────────────────────────────────────

export const sm2: Scheduler = {
  review(card, grade, now) {
    const f = compute(card, grade);
    return {
      ...card,
      state: f.state,
      ease: f.ease,
      interval: f.interval,
      reps: f.reps,
      lapses: f.lapses,
      due: now + f.offsetMs,
      lastReviewed: now,
    };
  },

  preview(card, grade, _now) {
    const f = compute(card, grade);
    return { label: fmt(f.offsetMs), intervalMs: f.offsetMs };
  },
};
