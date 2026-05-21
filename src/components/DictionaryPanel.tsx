"use client";

import { useState, useEffect } from "react";
import { DictionaryEntry } from "@/types";

const LANG_MAP: Record<string, string> = {
  en: "en-US",
  ja: "ja-JP",
  zh: "zh-CN",
  "zh-TW": "zh-TW",
  ko: "ko-KR",
  es: "es-ES",
  fr: "fr-FR",
  de: "de-DE",
  it: "it-IT",
  pt: "pt-PT",
  ru: "ru-RU",
  ar: "ar-SA",
  hi: "hi-IN",
  th: "th-TH",
  vi: "vi-VN",
  id: "id-ID",
  my: "my-MM",
  ms: "ms-MY",
  tr: "tr-TR",
  pl: "pl-PL",
  nl: "nl-NL",
  sv: "sv-SE",
  da: "da-DK",
  fi: "fi-FI",
  no: "no-NO",
  uk: "uk-UA",
  cs: "cs-CZ",
  ro: "ro-RO",
  hu: "hu-HU",
  el: "el-GR",
};

type TabId = "definitions" | "examples" | "translations";

interface DictionaryPanelProps {
  entry: DictionaryEntry;
  headword: string;
  sourceLang: string;
  onAddCard: (back: string) => void;
  onClose: () => void;
}

export default function DictionaryPanel({
  entry,
  headword,
  sourceLang,
  onAddCard,
  onClose,
}: DictionaryPanelProps) {
  const hasDefinitions = (entry.defsByPos?.length ?? 0) > 0;
  const hasExamples = (entry.examples?.length ?? 0) > 0;
  const hasTranslations = (entry.alternatives?.length ?? 0) > 0;
  const hasReadings = (entry.readings?.length ?? 0) > 0;
  const hasJlpt = !!entry.jlpt;
  const hasPhonetic = !!entry.phonetic;

  // Determine first non-empty tab
  function firstNonEmptyTab(): TabId {
    if (hasDefinitions) return "definitions";
    if (hasExamples) return "examples";
    if (hasTranslations) return "translations";
    return "definitions";
  }

  const [activeTab, setActiveTab] = useState<TabId>(firstNonEmptyTab);

  // Re-evaluate when entry changes
  useEffect(() => {
    setActiveTab(firstNonEmptyTab());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry]);

  const speak = () => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(headword);
    utter.lang = LANG_MAP[sourceLang] ?? sourceLang;
    window.speechSynthesis.speak(utter);
  };

  const tabs: { id: TabId; label: string; has: boolean }[] = [
    { id: "definitions", label: "Definitions", has: hasDefinitions },
    { id: "examples", label: "Examples", has: hasExamples },
    { id: "translations", label: "Translations", has: hasTranslations },
  ];

  const hasAny =
    hasDefinitions || hasExamples || hasTranslations || hasReadings || hasJlpt;

  return (
    <div
      className="flex h-full min-h-screen flex-col"
      role="region"
      aria-label={`Dictionary entry for ${headword}`}
    >
      {/* ── Header ── */}
      <div className="flex items-start justify-between border-b border-line px-5 pt-4 pb-3">
        <div className="min-w-0 flex-1">
          {/* Headword row */}
          <div className="flex items-center gap-2">
            <h2 className="font-display text-2xl font-bold text-ink leading-tight">
              {headword}
            </h2>
            <button
              onClick={speak}
              aria-label={`Listen to pronunciation of ${headword}`}
              title="Listen to pronunciation"
              className="flex-shrink-0 rounded-full p-1 text-ink-soft/60 transition-colors hover:bg-paper-2 hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <SpeakerIcon />
            </button>
          </div>

          {/* Phonetic + JLPT badge row */}
          {(hasPhonetic || hasJlpt) && (
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {hasPhonetic && (
                <span className="text-sm italic text-ink-soft/70">
                  {entry.phonetic}
                </span>
              )}
              {hasJlpt && (
                <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-bold text-accent">
                  JLPT {entry.jlpt}
                </span>
              )}
            </div>
          )}

          {/* Japanese readings chips */}
          {hasReadings && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {entry.readings!.map((r, i) => (
                <span
                  key={i}
                  className="rounded-full border border-line bg-paper-2 px-2 py-0.5 text-sm text-ink"
                >
                  {r}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Close dictionary panel"
          className="ml-3 flex-shrink-0 rounded-full p-1.5 text-ink-soft/60 transition-colors hover:bg-paper-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <CloseIcon />
        </button>
      </div>

      {/* ── Tab bar ── */}
      <div className="flex border-b border-line" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`dict-panel-${tab.id}`}
            disabled={!tab.has}
            onClick={() => tab.has && setActiveTab(tab.id)}
            className={`px-5 py-2.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent ${
              !tab.has
                ? "cursor-default text-ink-soft/30"
                : activeTab === tab.id
                  ? "border-b-2 border-accent font-medium text-accent"
                  : "text-ink-soft/70 hover:text-ink"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      <div className="p-5">
        {!hasAny && (
          <p className="text-sm text-ink-soft/60">
            No dictionary data found for &ldquo;{headword}&rdquo;.
          </p>
        )}

        {/* Definitions tab */}
        {activeTab === "definitions" && hasDefinitions && (
          <div
            id="dict-panel-definitions"
            role="tabpanel"
            className="space-y-5"
          >
            {entry.defsByPos!.map((group, gi) => (
              <div key={gi}>
                {/* POS header */}
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-accent">
                  {group.pos}
                </p>
                <ol className="space-y-3">
                  {group.senses.map((sense, si) => (
                    <li key={si} className="flex gap-2.5">
                      <span className="mt-0.5 flex-shrink-0 text-xs font-medium text-ink-soft/50 tabular-nums">
                        {si + 1}.
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm text-ink">{sense.definition}</p>
                        {sense.example && (
                          <p className="mt-1 text-sm italic text-ink-soft/80">
                            &ldquo;{sense.example}&rdquo;
                          </p>
                        )}
                        {sense.synonyms && sense.synonyms.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            <span className="text-xs text-ink-soft/50">
                              Synonyms:
                            </span>
                            {sense.synonyms.map((syn, syi) => (
                              <button
                                key={syi}
                                onClick={() => onAddCard(syn)}
                                title={`Add "${syn}" as card`}
                                className="rounded-full border border-line bg-paper-2 px-2 py-0.5 text-xs text-ink-soft transition-colors hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
                              >
                                {syn}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        )}

        {/* Examples tab */}
        {activeTab === "examples" && hasExamples && (
          <div id="dict-panel-examples" role="tabpanel" className="space-y-2">
            {entry.examples!.map((ex, i) => (
              <div
                key={i}
                className="flex items-start justify-between gap-3 rounded-xl border border-line bg-paper-2/60 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm text-ink">{ex.source}</p>
                  {ex.target && (
                    <p className="mt-0.5 text-sm italic text-ink-soft/70">
                      {ex.target}
                    </p>
                  )}
                </div>
                {ex.source && (
                  <button
                    onClick={() => onAddCard(ex.source)}
                    aria-label={`Save example as card`}
                    title="Save as card"
                    className="flex-shrink-0 rounded-full border border-line bg-paper px-2.5 py-1 text-xs text-ink-soft transition-colors hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
                  >
                    +
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Translations tab */}
        {activeTab === "translations" && hasTranslations && (
          <div id="dict-panel-translations" role="tabpanel">
            <TranslationsTab
              alternatives={entry.alternatives!}
              onAddCard={onAddCard}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Translations tab sub-component ───────────────────────────────────────────

function TranslationsTab({
  alternatives,
  onAddCard,
}: {
  alternatives: NonNullable<DictionaryEntry["alternatives"]>;
  onAddCard: (back: string) => void;
}) {
  // Group by pos when present; otherwise flat list under implicit group
  const grouped = new Map<string, typeof alternatives>();

  for (const alt of alternatives) {
    const key = alt.pos ?? "";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(alt);
  }

  return (
    <div className="space-y-4">
      {Array.from(grouped.entries()).map(([pos, alts]) => (
        <div key={pos}>
          {pos && (
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-accent">
              {pos}
            </p>
          )}
          <ul className="space-y-1.5">
            {alts.map((alt, i) => (
              <li
                key={i}
                className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 transition-colors hover:bg-paper-2"
              >
                <div className="min-w-0">
                  <span className="text-sm font-medium text-ink">
                    {alt.text}
                  </span>
                  {alt.backTranslations && alt.backTranslations.length > 0 && (
                    <span className="ml-2 text-xs text-ink-soft/50">
                      {alt.backTranslations.join(", ")}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => onAddCard(alt.text)}
                  aria-label={`Add "${alt.text}" as card back`}
                  title={`Save "${alt.text}" as card`}
                  className="flex-shrink-0 flex h-6 w-6 items-center justify-center rounded-full border border-line bg-paper text-ink-soft/60 transition-colors hover:border-accent hover:bg-accent/10 hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-3.5 w-3.5 fill-current"
                    aria-hidden="true"
                  >
                    <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function SpeakerIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 fill-current"
      aria-hidden="true"
    >
      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 fill-current"
      aria-hidden="true"
    >
      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
    </svg>
  );
}
