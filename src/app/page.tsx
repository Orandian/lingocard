"use client";

import { useState } from "react";
import { useDecks } from "@/store/useDecks";
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

  const [tab, setTab] = useState<Tab>("translate");
  const [practiceId, setPracticeId] = useState<string | null>(null);

  const practiceDeck = decks.find((d) => d.id === practiceId) ?? null;

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      <header className="mb-8">
        <h1 className="font-display text-4xl font-black tracking-tight text-ink">
          Lingo<span className="text-accent">Card</span>
        </h1>
        <p className="mt-1 text-ink-soft">
          Translate, collect example sentences, save as Anki decks, and
          practice.
        </p>
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
        Runs locally · data saved in your browser · translation via MyMemory
      </footer>
    </main>
  );
}

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
