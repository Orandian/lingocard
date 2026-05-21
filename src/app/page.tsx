"use client";

import { useState } from "react";
import { useDecks } from "@/store/useDecks";
import { useTheme, THEMES, ThemeId } from "@/store/useTheme";
import Translator from "@/components/Translator";
import DeckManager from "@/components/DeckManager";
import Practice from "@/components/Practice";

type Tab = "translate" | "decks";

export default function Home() {
  const {
    decks,
    ready,
    createDeck,
    deleteDeck,
    addCard,
    deleteCard,
    gradeCard,
    setDeckLimit,
  } = useDecks();

  const { theme, setTheme } = useTheme();
  const [tab, setTab] = useState<Tab>("translate");
  const [practiceId, setPracticeId] = useState<string | null>(null);

  const practiceDeck = decks.find((d) => d.id === practiceId) ?? null;

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
      <header className="mb-6 flex items-start justify-between gap-4 sm:mb-8">
        <div>
          <h1 className="font-display text-3xl font-black tracking-tight text-ink sm:text-4xl">
            Lingo<span className="text-accent">Card</span>
          </h1>
          <p className="mt-1 text-ink-soft">
            Translate, collect example sentences, save as Anki decks, and
            practice.
          </p>
        </div>
        <ThemePicker theme={theme} setTheme={setTheme} />
      </header>

      {practiceDeck ? (
        <Practice
          deck={practiceDeck}
          onGrade={gradeCard}
          onExit={() => setPracticeId(null)}
        />
      ) : (
        <>
          <nav className="mb-7 inline-flex rounded-full border border-line bg-paper-2 p-1">
            <TabBtn
              active={tab === "translate"}
              onClick={() => setTab("translate")}
            >
              Translate
            </TabBtn>
            <TabBtn active={tab === "decks"} onClick={() => setTab("decks")}>
              Decks{decks.length > 0 ? ` (${decks.length})` : ""}
            </TabBtn>
          </nav>

          {!ready ? (
            <p className="text-ink-soft">Loading…</p>
          ) : tab === "translate" ? (
            <Translator
              decks={decks}
              onCreateDeck={createDeck}
              onAddCard={addCard}
            />
          ) : (
            <DeckManager
              decks={decks}
              onCreateDeck={createDeck}
              onDeleteDeck={deleteDeck}
              onDeleteCard={deleteCard}
              onSetLimit={setDeckLimit}
              onPractice={(id) => setPracticeId(id)}
            />
          )}
        </>
      )}

      <footer className="mt-16 border-t border-line pt-5 text-center text-xs text-ink-soft/60">
        Runs locally · data saved in your browser · translation via Google
        Translate
      </footer>
    </main>
  );
}

// ── Theme picker ──────────────────────────────────────────────────────────────

function ThemePicker({
  theme,
  setTheme,
}: {
  theme: ThemeId;
  setTheme: (t: ThemeId) => void;
}) {
  return (
    <div
      className="flex items-center gap-1.5 rounded-full border border-line bg-paper-2/60 px-3 py-2"
      role="group"
      aria-label="Color theme"
    >
      {THEMES.map((t) => {
        const isActive = theme === t.id;
        return (
          <button
            key={t.id}
            onClick={() => setTheme(t.id)}
            title={t.label}
            aria-label={`${t.label} theme${isActive ? " (active)" : ""}`}
            aria-pressed={isActive}
            style={{
              background: t.paper,
              outline: isActive
                ? `2px solid ${t.accent}`
                : "1px solid rgba(0,0,0,0.12)",
              outlineOffset: isActive ? "2px" : "0px",
            }}
            className="relative h-6 w-6 rounded-full transition-[transform,outline] duration-150 hover:scale-110"
          >
            {/* accent dot */}
            <span
              style={{ background: t.accent }}
              className="absolute right-0.5 bottom-0.5 h-2 w-2 rounded-full"
            />
          </button>
        );
      })}
    </div>
  );
}

// ── Tab button ────────────────────────────────────────────────────────────────

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-5 py-2 text-sm font-medium transition ${
        active ? "bg-ink text-paper" : "text-ink-soft hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
