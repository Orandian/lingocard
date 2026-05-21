"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, Deck, ExampleSentence } from "@/types";

const STORAGE_KEY = "lingocard.decks.v1";

// Leitner intervals per box, in days.
const BOX_INTERVALS = [0, 1, 3, 7, 16];

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function load(): Deck[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Deck[];
  } catch {
    return [];
  }
}

function save(decks: Deck[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(decks));
}

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

  const persist = useCallback((next: Deck[]) => {
    setDecks(next);
    save(next);
  }, []);

  const createDeck = useCallback(
    (name: string): Deck => {
      const deck: Deck = {
        id: uid(),
        name: name.trim() || "Untitled deck",
        cards: [],
        createdAt: Date.now(),
      };
      persist([...load(), deck]);
      return deck;
    },
    [persist],
  );

  const deleteDeck = useCallback(
    (deckId: string) => {
      persist(load().filter((d) => d.id !== deckId));
    },
    [persist],
  );

  const renameDeck = useCallback(
    (deckId: string, name: string) => {
      persist(load().map((d) => (d.id === deckId ? { ...d, name } : d)));
    },
    [persist],
  );

  const addCard = useCallback(
    (deckId: string, input: NewCardInput): boolean => {
      const current = load();
      const deck = current.find((d) => d.id === deckId);
      if (deck) {
        const frontNorm = input.front.trim().toLowerCase();
        const backNorm = input.back.trim().toLowerCase();
        const duplicate = deck.cards.some(
          (c) =>
            c.front.trim().toLowerCase() === frontNorm &&
            c.back.trim().toLowerCase() === backNorm,
        );
        if (duplicate) return false;
      }
      const card: Card = {
        id: uid(),
        ...input,
        createdAt: Date.now(),
        box: 1,
        due: Date.now(),
        lastReviewed: null,
      };
      persist(
        current.map((d) =>
          d.id === deckId ? { ...d, cards: [card, ...d.cards] } : d,
        ),
      );
      return true;
    },
    [persist],
  );

  const deleteCard = useCallback(
    (deckId: string, cardId: string) => {
      persist(
        load().map((d) =>
          d.id === deckId
            ? { ...d, cards: d.cards.filter((c) => c.id !== cardId) }
            : d,
        ),
      );
    },
    [persist],
  );

  // Practice grading: correct moves card up a box, wrong resets to box 1.
  const gradeCard = useCallback(
    (deckId: string, cardId: string, correct: boolean) => {
      persist(
        load().map((d) => {
          if (d.id !== deckId) return d;
          return {
            ...d,
            cards: d.cards.map((c) => {
              if (c.id !== cardId) return c;
              const box = correct
                ? Math.min(c.box + 1, BOX_INTERVALS.length)
                : 1;
              const intervalDays = BOX_INTERVALS[box - 1] ?? 0;
              return {
                ...c,
                box,
                lastReviewed: Date.now(),
                due: Date.now() + intervalDays * 86400000,
              };
            }),
          };
        }),
      );
    },
    [persist],
  );

  const setDeckLimit = useCallback(
    (deckId: string, limit: number | undefined) => {
      persist(
        load().map((d) => (d.id === deckId ? { ...d, dailyLimit: limit } : d)),
      );
    },
    [persist],
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
  };
}

export function dueCards(deck: Deck): Card[] {
  const now = Date.now();
  return deck.cards.filter((c) => c.due <= now);
}

export function newCards(deck: Deck): Card[] {
  return deck.cards.filter((c) => c.lastReviewed === null);
}
