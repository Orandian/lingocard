"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardState, Deck, DeckConfig, ExampleSentence } from "@/types";
import { sm2, START_EASE, Grade } from "@/lib/scheduler";
import { increment } from "@/lib/dailyCounts";

export type { Grade };

// ── Storage keys ──────────────────────────────────────────────────────────────

const V1_KEY = "lingocard.decks.v1";
const V2_KEY = "lingocard.decks.v2";

const DEFAULT_CONFIG: DeckConfig = { newPerDay: 20, maxReviewsPerDay: 200 };

// Legacy Leitner intervals (used only for v1→v2 migration mapping)
const LEITNER_INTERVALS = [0, 1, 3, 7, 16];

// ── v1 → v2 migration ────────────────────────────────────────────────────────
//
// v1 cards have: box (1-5), due, lastReviewed
// Mapping:
//   lastReviewed === null OR box === 1  → state "new" (never successfully reviewed)
//   box 2 → review, interval 1d,  reps 1
//   box 3 → review, interval 3d,  reps 2
//   box 4 → review, interval 7d,  reps 3
//   box 5 → review, interval 16d, reps 5
// All migrated cards start with ease 2.5, lapses 0.
//
// v1 decks add a default config; existing dailyLimit maps to newPerDay.

function migrateCard(raw: Record<string, unknown>): Card {
  // Already migrated (has `state` field)
  if (typeof raw.state === "string") return raw as unknown as Card;

  const box = typeof raw.box === "number" ? raw.box : 1;
  const hasBeenReviewed = raw.lastReviewed !== null;

  let state: CardState;
  let interval: number;
  let reps: number;

  if (!hasBeenReviewed || box === 1) {
    state = "new";
    interval = 0;
    reps = 0;
  } else {
    state = "review";
    interval = LEITNER_INTERVALS[Math.min(box - 1, 4)] || 1;
    reps = Math.max(1, box - 1);
  }

  return {
    ...(raw as Omit<Card, "state" | "ease" | "interval" | "reps" | "lapses">),
    state,
    ease: START_EASE,
    interval,
    reps,
    lapses: 0,
  } as Card;
}

function migrateDeck(raw: Record<string, unknown>): Deck {
  const dailyLimit =
    typeof raw.dailyLimit === "number" ? raw.dailyLimit : undefined;
  return {
    ...(raw as Omit<Deck, "config" | "cards">),
    config: (raw.config as DeckConfig) ?? {
      newPerDay: dailyLimit ?? DEFAULT_CONFIG.newPerDay,
      maxReviewsPerDay: DEFAULT_CONFIG.maxReviewsPerDay,
    },
    cards: ((raw.cards as Record<string, unknown>[]) ?? []).map(migrateCard),
  };
}

// ── Persistence ───────────────────────────────────────────────────────────────

function load(): Deck[] {
  if (typeof window === "undefined") return [];
  try {
    // Use v2 if it exists
    const v2 = window.localStorage.getItem(V2_KEY);
    if (v2) return JSON.parse(v2) as Deck[];

    // Migrate from v1
    const v1 = window.localStorage.getItem(V1_KEY);
    if (!v1) return [];
    const migrated = (JSON.parse(v1) as Record<string, unknown>[]).map(
      migrateDeck,
    );
    window.localStorage.setItem(V2_KEY, JSON.stringify(migrated));
    return migrated;
  } catch {
    return [];
  }
}

function persist(decks: Deck[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(V2_KEY, JSON.stringify(decks));
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface NewCardInput {
  front: string;
  back: string;
  sourceLang: string;
  targetLang: string;
  examples: ExampleSentence[];
}

export function useDecks() {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setDecks(load());
    setReady(true);
  }, []);

  const persistState = useCallback((next: Deck[]) => {
    setDecks(next);
    persist(next);
  }, []);

  const createDeck = useCallback(
    (name: string): Deck => {
      const deck: Deck = {
        id: uid(),
        name: name.trim() || "Untitled deck",
        cards: [],
        createdAt: Date.now(),
        config: { ...DEFAULT_CONFIG },
      };
      persistState([...load(), deck]);
      return deck;
    },
    [persistState],
  );

  const deleteDeck = useCallback(
    (deckId: string) => {
      persistState(load().filter((d) => d.id !== deckId));
    },
    [persistState],
  );

  const renameDeck = useCallback(
    (deckId: string, name: string) => {
      persistState(load().map((d) => (d.id === deckId ? { ...d, name } : d)));
    },
    [persistState],
  );

  const addCard = useCallback(
    (deckId: string, input: NewCardInput): boolean => {
      const current = load();
      const deck = current.find((d) => d.id === deckId);
      if (deck) {
        const fn = input.front.trim().toLowerCase();
        const bn = input.back.trim().toLowerCase();
        if (
          deck.cards.some(
            (c) =>
              c.front.trim().toLowerCase() === fn &&
              c.back.trim().toLowerCase() === bn,
          )
        ) {
          return false;
        }
      }
      const card: Card = {
        id: uid(),
        ...input,
        createdAt: Date.now(),
        state: "new",
        ease: START_EASE,
        interval: 0,
        reps: 0,
        lapses: 0,
        due: Date.now(),
        lastReviewed: null,
      };
      persistState(
        current.map((d) =>
          d.id === deckId ? { ...d, cards: [card, ...d.cards] } : d,
        ),
      );
      return true;
    },
    [persistState],
  );

  const deleteCard = useCallback(
    (deckId: string, cardId: string) => {
      persistState(
        load().map((d) =>
          d.id === deckId
            ? { ...d, cards: d.cards.filter((c) => c.id !== cardId) }
            : d,
        ),
      );
    },
    [persistState],
  );

  /**
   * Grade a card using SM-2. Increments the daily counter so daily limits
   * track correctly across sessions.
   */
  const gradeCard = useCallback(
    (deckId: string, cardId: string, grade: Grade) => {
      const now = Date.now();
      const current = load();
      const deck = current.find((d) => d.id === deckId);
      const card = deck?.cards.find((c) => c.id === cardId);
      if (!card) return;

      // Increment the correct daily counter BEFORE updating the card state
      increment(deckId, card.state === "new" ? "new" : "review");

      persistState(
        current.map((d) => {
          if (d.id !== deckId) return d;
          return {
            ...d,
            cards: d.cards.map((c) =>
              c.id === cardId ? sm2.review(c, grade, now) : c,
            ),
          };
        }),
      );
    },
    [persistState],
  );

  const setDeckConfig = useCallback(
    (deckId: string, config: Partial<DeckConfig>) => {
      persistState(
        load().map((d) =>
          d.id === deckId ? { ...d, config: { ...d.config, ...config } } : d,
        ),
      );
    },
    [persistState],
  );

  // Legacy shim — kept so DeckManager's "Limit" UI still compiles
  const setDeckLimit = useCallback(
    (deckId: string, limit: number | undefined) => {
      persistState(
        load().map((d) =>
          d.id === deckId
            ? {
                ...d,
                dailyLimit: limit,
                config: {
                  ...d.config,
                  newPerDay: limit ?? DEFAULT_CONFIG.newPerDay,
                },
              }
            : d,
        ),
      );
    },
    [persistState],
  );

  return {
    decks,
    ready,
    createDeck,
    deleteDeck,
    renameDeck,
    addCard,
    deleteCard,
    gradeCard,
    setDeckLimit,
    setDeckConfig,
  };
}

// ── Convenience helpers (used by DeckManager, Stats) ─────────────────────────

export function dueCards(deck: Deck): Card[] {
  const now = Date.now();
  return deck.cards.filter(
    (c) =>
      (c.state === "review" ||
        c.state === "learning" ||
        c.state === "lapsed") &&
      c.due <= now,
  );
}

export function newCards(deck: Deck): Card[] {
  return deck.cards.filter((c) => c.state === "new");
}
