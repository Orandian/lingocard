"use client";

import { useState, useEffect } from "react";
import { Deck } from "@/types";
import { langName } from "@/lib/languages";
import { downloadDeck, ExportOptions } from "@/lib/anki";
import { dueCards, newCards } from "@/store/useDecks";
import DeckStats from "@/components/DeckStats";

const DECKS_PER_PAGE = 8;
const CARDS_PER_PAGE = 10;

interface Props {
  decks: Deck[];
  onCreateDeck: (name: string) => void;
  onDeleteDeck: (id: string) => void;
  onDeleteCard: (deckId: string, cardId: string) => void;
  onSetLimit: (deckId: string, limit: number | undefined) => void;
  onPractice: (deckId: string) => void;
}

function groupDecks(decks: Deck[]): {
  standalone: Deck[];
  groups: Map<string, Deck[]>;
} {
  const groups = new Map<string, Deck[]>();
  const standalone: Deck[] = [];
  for (const deck of decks) {
    const sep = deck.name.indexOf("::");
    if (sep !== -1) {
      const parent = deck.name.slice(0, sep).trim();
      if (!groups.has(parent)) groups.set(parent, []);
      groups.get(parent)!.push(deck);
    } else {
      standalone.push(deck);
    }
  }
  return { standalone, groups };
}

function subdeckLabel(name: string): string {
  const idx = name.indexOf("::");
  return idx !== -1 ? name.slice(idx + 2).trim() : name;
}

type DeckItem =
  | { type: "standalone"; deck: Deck }
  | { type: "group"; parent: string; children: Deck[] };

export default function DeckManager({
  decks,
  onCreateDeck,
  onDeleteDeck,
  onDeleteCard,
  onSetLimit,
  onPractice,
}: Props) {
  const [newName, setNewName] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [statsFor, setStatsFor] = useState<string | null>(null);
  const [deckPage, setDeckPage] = useState(0);
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    tags: true,
    reversed: false,
  });
  const toggleOption = (key: keyof ExportOptions) =>
    setExportOptions((prev) => ({ ...prev, [key]: !prev[key] }));

  const { standalone, groups } = groupDecks(decks);

  const items: DeckItem[] = [
    ...standalone.map((deck) => ({ type: "standalone" as const, deck })),
    ...Array.from(groups.entries()).map(([parent, children]) => ({
      type: "group" as const,
      parent,
      children,
    })),
  ];

  const totalDeckPages = Math.ceil(items.length / DECKS_PER_PAGE);
  const visibleItems = items.slice(
    deckPage * DECKS_PER_PAGE,
    (deckPage + 1) * DECKS_PER_PAGE,
  );

  useEffect(() => {
    setDeckPage((p) => Math.min(p, Math.max(0, totalDeckPages - 1)));
  }, [totalDeckPages]);

  return (
    <div className="animate-rise">
      {/* New deck input */}
      <div className="mb-5 flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && newName.trim()) {
              onCreateDeck(newName);
              setNewName("");
            }
          }}
          placeholder="New deck name… (use :: for subdecks)"
          className="flex-1 rounded-full border border-line bg-paper-2 px-4 py-2 outline-none focus:border-accent"
        />
        <button
          onClick={() => {
            if (newName.trim()) {
              onCreateDeck(newName);
              setNewName("");
            }
          }}
          className="rounded-full bg-ink px-5 py-2 text-sm font-medium text-paper transition hover:bg-accent"
        >
          Create
        </button>
      </div>

      {/* Export options */}
      {decks.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-4 rounded-xl border border-line bg-paper-2 px-4 py-3 text-sm">
          <span className="font-medium text-ink-soft">Export options:</span>
          <label className="flex cursor-pointer items-center gap-2 text-ink-soft">
            <input
              type="checkbox"
              checked={exportOptions.tags}
              onChange={() => toggleOption("tags")}
              className="accent-accent"
            />
            Add tags
            <code className="rounded bg-paper px-1.5 py-0.5 text-xs">
              lingocard::en-ja
            </code>
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-ink-soft">
            <input
              type="checkbox"
              checked={exportOptions.reversed}
              onChange={() => toggleOption("reversed")}
              className="accent-accent"
            />
            Reversed cards
            <span className="text-xs text-ink-soft/60">(both directions)</span>
          </label>
        </div>
      )}

      {decks.length === 0 && (
        <p className="rounded-2xl border border-dashed border-line bg-paper-2 p-8 text-center text-ink-soft">
          No decks yet. Translate something and save it, or create a deck above.
        </p>
      )}

      <div className="space-y-4">
        {visibleItems.map((item) =>
          item.type === "standalone" ? (
            <div key={item.deck.id}>
              <DeckRow
                deck={item.deck}
                allDecks={decks}
                open={open}
                setOpen={setOpen}
                statsFor={statsFor}
                setStatsFor={setStatsFor}
                exportOptions={exportOptions}
                onDeleteDeck={onDeleteDeck}
                onDeleteCard={onDeleteCard}
                onSetLimit={onSetLimit}
                onPractice={onPractice}
              />
            </div>
          ) : (
            <div
              key={item.parent}
              className="rounded-2xl border border-line bg-paper-2 shadow-sm"
            >
              <div className="border-b border-line/50 px-4 py-3">
                <h3 className="font-display text-lg font-semibold text-ink">
                  {item.parent}
                </h3>
                <p className="text-xs text-ink-soft/60">
                  {item.children.reduce((n, d) => n + d.cards.length, 0)} cards
                  across {item.children.length} subdeck
                  {item.children.length !== 1 ? "s" : ""}
                </p>
              </div>
              <div className="divide-y divide-line/40 pl-4">
                {item.children.map((deck) => (
                  <DeckRow
                    key={deck.id}
                    deck={deck}
                    allDecks={decks}
                    label={subdeckLabel(deck.name)}
                    open={open}
                    setOpen={setOpen}
                    statsFor={statsFor}
                    setStatsFor={setStatsFor}
                    exportOptions={exportOptions}
                    onDeleteDeck={onDeleteDeck}
                    onDeleteCard={onDeleteCard}
                    onSetLimit={onSetLimit}
                    onPractice={onPractice}
                    indent
                  />
                ))}
              </div>
            </div>
          ),
        )}
      </div>

      {totalDeckPages > 1 && (
        <Pagination
          page={deckPage}
          total={totalDeckPages}
          onPrev={() => setDeckPage((p) => p - 1)}
          onNext={() => setDeckPage((p) => p + 1)}
          className="mt-5"
        />
      )}
    </div>
  );
}

// ── Pagination ────────────────────────────────────────────────────────────────

function Pagination({
  page,
  total,
  onPrev,
  onNext,
  className = "",
}: {
  page: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  className?: string;
}) {
  return (
    <div className={`flex items-center justify-center gap-3 ${className}`}>
      <button
        onClick={onPrev}
        disabled={page === 0}
        className="rounded-full border border-line px-4 py-1.5 text-sm text-ink-soft transition hover:border-accent hover:text-accent disabled:cursor-default disabled:opacity-30"
      >
        ← Prev
      </button>
      <span className="text-sm text-ink-soft">
        {page + 1} / {total}
      </span>
      <button
        onClick={onNext}
        disabled={page >= total - 1}
        className="rounded-full border border-line px-4 py-1.5 text-sm text-ink-soft transition hover:border-accent hover:text-accent disabled:cursor-default disabled:opacity-30"
      >
        Next →
      </button>
    </div>
  );
}

// ── DeckRow ───────────────────────────────────────────────────────────────────

interface DeckRowProps {
  deck: Deck;
  allDecks: Deck[];
  label?: string;
  open: string | null;
  setOpen: (id: string | null) => void;
  statsFor: string | null;
  setStatsFor: (id: string | null) => void;
  exportOptions: ExportOptions;
  onDeleteDeck: (id: string) => void;
  onDeleteCard: (deckId: string, cardId: string) => void;
  onSetLimit: (deckId: string, limit: number | undefined) => void;
  onPractice: (deckId: string) => void;
  indent?: boolean;
}

function DeckRow({
  deck,
  allDecks,
  label,
  open,
  setOpen,
  statsFor,
  setStatsFor,
  exportOptions,
  onDeleteDeck,
  onDeleteCard,
  onSetLimit,
  onPractice,
  indent,
}: DeckRowProps) {
  const [editLimit, setEditLimit] = useState(false);
  const [limitVal, setLimitVal] = useState(String(deck.dailyLimit ?? ""));
  const [cardPage, setCardPage] = useState(0);

  const isOpen = open === deck.id;
  const showStats = statsFor === deck.id;
  const due = dueCards(deck).length;
  const fresh = newCards(deck).length;

  const totalCardPages = Math.ceil(deck.cards.length / CARDS_PER_PAGE);
  const visibleCards = deck.cards.slice(
    cardPage * CARDS_PER_PAGE,
    (cardPage + 1) * CARDS_PER_PAGE,
  );

  useEffect(() => {
    if (!isOpen) setCardPage(0);
  }, [isOpen]);

  const commitLimit = () => {
    const n = parseInt(limitVal, 10);
    onSetLimit(deck.id, isNaN(n) || n <= 0 ? undefined : n);
    setEditLimit(false);
  };

  return (
    <div
      className={
        indent ? "" : "rounded-2xl border border-line bg-paper shadow-sm"
      }
    >
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <button
          onClick={() => setOpen(isOpen ? null : deck.id)}
          className="text-left sm:flex-1"
        >
          <h3 className="font-display text-xl text-ink">
            {label ?? deck.name}
          </h3>
          <p className="text-sm text-ink-soft">
            {deck.cards.length} card{deck.cards.length !== 1 ? "s" : ""}
            {due > 0 && <span className="ml-2 text-accent-2">· {due} due</span>}
            {fresh > 0 && (
              <span className="ml-1 text-ink-soft/60">· {fresh} new</span>
            )}
            {deck.config.newPerDay !== 20 && (
              <span className="ml-1 text-ink-soft/50">
                · {deck.config.newPerDay}/day
              </span>
            )}
          </p>
        </button>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {editLimit ? (
            <div className="flex items-center gap-1">
              <input
                autoFocus
                type="number"
                min={1}
                value={limitVal}
                onChange={(e) => setLimitVal(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitLimit();
                  if (e.key === "Escape") setEditLimit(false);
                }}
                placeholder="∞"
                className="w-16 rounded-full border border-line px-2 py-1 text-center text-sm outline-none focus:border-accent"
              />
              <button
                onClick={commitLimit}
                className="rounded-full bg-accent-2 px-2 py-1 text-xs text-paper"
              >
                ✓
              </button>
              <button
                onClick={() => setEditLimit(false)}
                className="rounded-full border border-line px-2 py-1 text-xs text-ink-soft"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setLimitVal(String(deck.dailyLimit ?? ""));
                setEditLimit(true);
              }}
              title="Set daily new-card limit"
              className="rounded-full border border-line px-3 py-2.5 text-sm text-ink-soft transition hover:border-accent hover:text-accent sm:py-1.5"
            >
              {deck.dailyLimit ? `${deck.dailyLimit}/day` : "Limit"}
            </button>
          )}

          <button
            onClick={() => setStatsFor(showStats ? null : deck.id)}
            className={`rounded-full border px-3 py-2.5 text-sm transition sm:py-1.5 ${showStats ? "border-accent text-accent" : "border-line text-ink-soft hover:border-accent hover:text-accent"}`}
          >
            Stats
          </button>

          <button
            onClick={() => onPractice(deck.id)}
            disabled={deck.cards.length === 0}
            className="rounded-full bg-accent-2 px-3 py-2.5 text-sm font-medium text-paper transition hover:opacity-90 disabled:opacity-30 sm:py-1.5"
          >
            Practice
          </button>
          <button
            onClick={() => downloadDeck(deck, exportOptions)}
            disabled={deck.cards.length === 0}
            className="rounded-full border border-line px-3 py-2.5 text-sm transition hover:border-accent hover:text-accent disabled:opacity-30 sm:py-1.5"
          >
            Export
          </button>
          <button
            onClick={() => {
              if (confirm(`Delete "${deck.name}"?`)) onDeleteDeck(deck.id);
            }}
            className="rounded-full border border-line px-3 py-2.5 text-sm text-ink-soft transition hover:border-accent hover:text-accent sm:py-1.5"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Stats panel */}
      {showStats && (
        <div className="border-t border-line/50 px-4 pb-4">
          <DeckStats
            deck={deck}
            allDecks={allDecks}
            onClose={() => setStatsFor(null)}
          />
        </div>
      )}

      {/* Card list */}
      {isOpen && deck.cards.length > 0 && (
        <div className="border-t border-line">
          <ul>
            {visibleCards.map((card) => (
              <li
                key={card.id}
                className="flex items-start justify-between gap-4 border-b border-line/50 px-4 py-3 last:border-0"
              >
                <div className="min-w-0">
                  <p className="text-ink">
                    <span className="font-medium">{card.front}</span>
                    <span className="mx-2 text-accent">→</span>
                    <span>{card.back}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-ink-soft/70">
                    {langName(card.sourceLang)} → {langName(card.targetLang)}
                    {card.examples.length > 0 &&
                      ` · ${card.examples.length} example${card.examples.length !== 1 ? "s" : ""}`}
                    {` · ${card.state}`}
                    {card.state === "review" && ` · ${card.interval}d`}
                  </p>
                </div>
                <button
                  onClick={() => onDeleteCard(deck.id, card.id)}
                  className="shrink-0 text-sm text-ink-soft/60 transition hover:text-accent"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
          {totalCardPages > 1 && (
            <div className="border-t border-line/50 px-4 py-3">
              <Pagination
                page={cardPage}
                total={totalCardPages}
                onPrev={() => setCardPage((p) => p - 1)}
                onNext={() => setCardPage((p) => p + 1)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
