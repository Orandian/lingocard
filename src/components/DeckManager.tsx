"use client";

import { useState, useEffect } from "react";
import { Deck } from "@/types";
import { langName } from "@/lib/languages";
import { downloadDeck, ExportOptions } from "@/lib/anki";
import { dueCards, newCards } from "@/store/useDecks";
import DeckStats from "@/components/DeckStats";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  const [nameError, setNameError] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [statsFor, setStatsFor] = useState<string | null>(null);
  const [deckPage, setDeckPage] = useState(0);
  const [newDeckId, setNewDeckId] = useState<string | null>(null);
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
      {/* New deck input with validation */}
      <div className="mb-5">
        <div className="flex gap-2">
          <input
            value={newName}
            onChange={(e) => {
              setNewName(e.target.value);
              if (e.target.value.trim()) setNameError(false);
            }}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              if (!newName.trim()) {
                setNameError(true);
                return;
              }
              const deck = onCreateDeck(newName) as unknown as {
                id?: string;
              } | void;
              if (deck && typeof deck === "object" && "id" in deck) {
                setNewDeckId((deck as { id: string }).id);
                setTimeout(() => setNewDeckId(null), 600);
              }
              setNewName("");
              setNameError(false);
            }}
            placeholder="New deck name… (use :: for subdecks)"
            aria-invalid={nameError}
            className={`flex-1 rounded-full border bg-paper-2 px-4 py-2 outline-none transition focus:border-accent ${
              nameError ? "border-red-400 focus:border-red-400" : "border-line"
            }`}
          />
          <button
            onClick={() => {
              if (!newName.trim()) {
                setNameError(true);
                return;
              }
              const deck = onCreateDeck(newName) as unknown as {
                id?: string;
              } | void;
              if (deck && typeof deck === "object" && "id" in deck) {
                setNewDeckId((deck as { id: string }).id);
                setTimeout(() => setNewDeckId(null), 600);
              }
              setNewName("");
              setNameError(false);
            }}
            className="rounded-full bg-ink px-5 py-2 text-sm font-medium text-paper transition-colors duration-150 hover:bg-accent active:scale-95"
          >
            Create
          </button>
        </div>
        {nameError && (
          <p className="mt-1.5 pl-4 text-xs text-red-500" role="alert">
            Please enter a deck name.
          </p>
        )}
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
            <div
              key={item.deck.id}
              className={newDeckId === item.deck.id ? "animate-scale-in" : ""}
            >
              <DeckRow
                deck={item.deck}
                allDecks={decks}
                open={open}
                setOpen={setOpen}
                statsFor={statsFor}
                setStatsFor={setStatsFor}
                exportOptions={exportOptions}
                onDeleteDeck={onDeleteDeck}
                onRequestDelete={(id, name) => setPendingDelete({ id, name })}
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
                    onRequestDelete={(id, name) =>
                      setPendingDelete({ id, name })
                    }
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

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent className="bg-paper text-ink ring-line">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-ink">
              Delete deck?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-ink-soft">
              <strong className="text-ink">
                &ldquo;{pendingDelete?.name}&rdquo;
              </strong>{" "}
              and all its cards will be permanently removed. This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setPendingDelete(null)}
              className="rounded-full border-line bg-paper text-ink-soft hover:bg-paper-2 hover:text-ink"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDelete) {
                  onDeleteDeck(pendingDelete.id);
                  setPendingDelete(null);
                }
              }}
              variant="destructive"
              className="rounded-full"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
  onRequestDelete: (id: string, name: string) => void;
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
  onRequestDelete,
  onDeleteCard,
  onSetLimit,
  onPractice,
  indent,
}: DeckRowProps) {
  const [editLimit, setEditLimit] = useState(false);
  const [limitVal, setLimitVal] = useState(String(deck.dailyLimit ?? ""));
  const [cardPage, setCardPage] = useState(0);
  const [deletingCards, setDeletingCards] = useState<Set<string>>(new Set());

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

  const handleDeleteCard = (cardId: string) => {
    setDeletingCards((prev) => new Set(prev).add(cardId));
    setTimeout(() => {
      onDeleteCard(deck.id, cardId);
      setDeletingCards((prev) => {
        const next = new Set(prev);
        next.delete(cardId);
        return next;
      });
    }, 150);
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
          className="text-left transition-colors duration-150 sm:flex-1 hover:text-accent"
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
                className="rounded-full bg-accent-2 px-2 py-1 text-xs text-paper active:scale-95"
              >
                ✓
              </button>
              <button
                onClick={() => setEditLimit(false)}
                className="rounded-full border border-line px-2 py-1 text-xs text-ink-soft active:scale-95"
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
              className="rounded-full border border-line px-3 py-2.5 text-sm text-ink-soft transition-colors duration-150 hover:border-accent hover:text-accent active:scale-95 sm:py-1.5"
            >
              {deck.dailyLimit ? `${deck.dailyLimit}/day` : "Limit"}
            </button>
          )}

          <button
            onClick={() => setStatsFor(showStats ? null : deck.id)}
            className={`rounded-full border px-3 py-2.5 text-sm transition-colors duration-150 active:scale-95 sm:py-1.5 ${showStats ? "border-accent text-accent" : "border-line text-ink-soft hover:border-accent hover:text-accent"}`}
          >
            Stats
          </button>

          <button
            onClick={() => onPractice(deck.id)}
            disabled={deck.cards.length === 0}
            className="rounded-full bg-accent-2 px-3 py-2.5 text-sm font-medium text-paper transition-opacity duration-150 hover:opacity-90 disabled:opacity-30 active:scale-95 sm:py-1.5"
          >
            Practice
          </button>
          <button
            onClick={() => downloadDeck(deck, exportOptions)}
            disabled={deck.cards.length === 0}
            className="rounded-full border border-line px-3 py-2.5 text-sm transition-colors duration-150 hover:border-accent hover:text-accent disabled:opacity-30 active:scale-95 sm:py-1.5"
          >
            Export
          </button>
          <button
            onClick={() => onRequestDelete(deck.id, label ?? deck.name)}
            className="rounded-full border border-line px-3 py-2.5 text-sm text-ink-soft transition-colors duration-150 hover:border-red-400 hover:text-red-500 active:scale-95 sm:py-1.5"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Stats panel */}
      {showStats && (
        <div className="animate-scale-in border-t border-line/50 px-4 pb-4">
          <DeckStats
            deck={deck}
            allDecks={allDecks}
            onClose={() => setStatsFor(null)}
          />
        </div>
      )}

      {/* Card list — animated expand/collapse */}
      <div
        className="deck-expand-grid"
        data-open={isOpen && deck.cards.length > 0 ? "true" : "false"}
      >
        <div className="deck-expand-inner border-t border-line">
          <ul>
            {visibleCards.map((card) => (
              <li
                key={card.id}
                className={`flex items-start justify-between gap-4 border-b border-line/50 px-4 py-3 last:border-0 ${
                  deletingCards.has(card.id) ? "animate-fade-shrink" : ""
                }`}
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
                  onClick={() => handleDeleteCard(card.id)}
                  className="shrink-0 text-sm text-ink-soft/60 transition-colors duration-150 hover:text-accent active:scale-90"
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
      </div>
    </div>
  );
}
