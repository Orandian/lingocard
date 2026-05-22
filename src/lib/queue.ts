/**
 * Queue builder — determines which cards to study in a session, respecting
 * daily limits and parent-deck limit roll-up.
 */
import { Card, Deck } from "@/types";
import { todayStr } from "./dailyCounts";

export interface QueueItem {
  deckId: string;
  card: Card;
}

export interface QueueResult {
  items: QueueItem[];
  newCount: number;
  learningCount: number;
  reviewCount: number;
}

// ── Limit roll-up through the subdeck hierarchy ───────────────────────────────
//
// Anki rule: a parent deck's newPerDay / maxReviewsPerDay is an upper bound
// across ALL its descendants combined.
//
// Example: "Japanese" allows 20 new/day. "Japanese::N1" and "Japanese::N2"
// each allow 10. If N1 has already introduced 15 today, N2 can introduce at
// most 5 (not 10), because the parent cap is exhausted.
//
// Implementation: walk up the name hierarchy, sum counts for every deck in
// each ancestor's subtree, compare against the ancestor's limit.

function effectiveLimits(
  deck: Deck,
  allDecks: Deck[],
  allCounts: Record<string, number>,
  today: string,
): { newLeft: number; reviewLeft: number } {
  // Own remaining capacity
  const ownNew = allCounts[`${deck.id}:${today}:new`] ?? 0;
  const ownReview = allCounts[`${deck.id}:${today}:review`] ?? 0;
  let newLeft = deck.config.newPerDay - ownNew;
  let reviewLeft = deck.config.maxReviewsPerDay - ownReview;

  // Tighten limits at each ancestor level.
  const parts = deck.name.split("::");
  for (let depth = parts.length - 1; depth >= 1; depth--) {
    const ancestorName = parts.slice(0, depth).join("::");
    const ancestor = allDecks.find((d) => d.name === ancestorName);
    if (!ancestor) continue;

    // Sum counts for every deck in this ancestor's subtree
    const subtree = allDecks.filter(
      (d) => d.name === ancestorName || d.name.startsWith(ancestorName + "::"),
    );
    let subtreeNew = 0;
    let subtreeReview = 0;
    for (const d of subtree) {
      subtreeNew += allCounts[`${d.id}:${today}:new`] ?? 0;
      subtreeReview += allCounts[`${d.id}:${today}:review`] ?? 0;
    }

    newLeft = Math.min(newLeft, ancestor.config.newPerDay - subtreeNew);
    reviewLeft = Math.min(
      reviewLeft,
      ancestor.config.maxReviewsPerDay - subtreeReview,
    );
  }

  return { newLeft: Math.max(0, newLeft), reviewLeft: Math.max(0, reviewLeft) };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Build the practice queue for one or more decks.
 * Pass the primary deck plus all its subdecks when practising a parent.
 *
 * Order: due learning/lapsed first (never capped — must be cleared),
 *        then due reviews (capped by maxReviewsPerDay),
 *        then new cards (capped by newPerDay).
 */
export function buildQueue(
  decks: Deck[],
  allDecks: Deck[],
  now: number,
): QueueResult {
  if (decks.length === 0) {
    return { items: [], newCount: 0, learningCount: 0, reviewCount: 0 };
  }

  // Load daily counts once to avoid repeated localStorage reads
  let allCounts: Record<string, number> = {};
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem("lingocard.counts.v1");
      if (raw) allCounts = JSON.parse(raw) as Record<string, number>;
    } catch {
      /* ignore */
    }
  }

  const today = todayStr();
  const learning: QueueItem[] = [];
  const review: QueueItem[] = [];
  const fresh: QueueItem[] = [];

  for (const deck of decks) {
    const limits = effectiveLimits(deck, allDecks, allCounts, today);
    let deckReview = 0;
    let deckNew = 0;

    for (const card of deck.cards) {
      const item: QueueItem = { deckId: deck.id, card };

      if (card.state === "learning" || card.state === "lapsed") {
        // Due learning cards are never capped — they must always be reviewed
        if (card.due <= now) learning.push(item);
      } else if (card.state === "review") {
        if (card.due <= now && deckReview < limits.reviewLeft) {
          review.push(item);
          deckReview++;
        }
      } else {
        // state === "new"
        if (deckNew < limits.newLeft) {
          fresh.push(item);
          deckNew++;
        }
      }
    }
  }

  return {
    items: [...learning, ...review, ...fresh],
    newCount: fresh.length,
    learningCount: learning.length,
    reviewCount: review.length,
  };
}

/** Count cards by state for display in setup screen / stats. */
export function cardCounts(decks: Deck[], now: number) {
  let newC = 0,
    learningC = 0,
    reviewC = 0,
    lapsedC = 0,
    dueC = 0;
  for (const d of decks) {
    for (const c of d.cards) {
      if (c.state === "new") newC++;
      else if (c.state === "learning") learningC++;
      else if (c.state === "review") reviewC++;
      else if (c.state === "lapsed") lapsedC++;
      if (
        (c.state === "review" ||
          c.state === "learning" ||
          c.state === "lapsed") &&
        c.due <= now
      )
        dueC++;
    }
  }
  return {
    new: newC,
    learning: learningC,
    review: reviewC,
    lapsed: lapsedC,
    due: dueC,
  };
}
