"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { LANGUAGES, langName } from "@/lib/languages";
import { translate } from "@/lib/translate";
import { getDictionary } from "@/lib/dictionary";
import { speak } from "@/lib/tts";
import {
  TranslationResult,
  Deck,
  DictEntry,
  AlternativeTranslation,
  DictionaryEntry,
} from "@/types";
import { NewCardInput } from "@/store/useDecks";
import DictionaryPanel from "@/components/DictionaryPanel";

const MAX_CHARS = 5000;
const DEFAULT_SOURCE_TABS = ["my", "ja", "en"];
const DEFAULT_TARGET_TABS = ["en", "ja", "my"];
const STORAGE_KEY = "lingocard.translator.v1";

interface PersistedState {
  text: string;
  sourceLang: string;
  targetLang: string;
  result: TranslationResult | null;
  sourceTabs: string[];
  targetTabs: string[];
}

function loadState(): Partial<PersistedState> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PersistedState) : {};
  } catch {
    return {};
  }
}

function saveState(state: PersistedState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

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

interface Props {
  decks: Deck[];
  onCreateDeck: (name: string) => Deck;
  onAddCard: (deckId: string, input: NewCardInput) => boolean;
}

export default function Translator({ decks, onCreateDeck, onAddCard }: Props) {
  const saved = loadState();
  const [text, setText] = useState(saved.text ?? "");
  const [sourceLang, setSourceLang] = useState(saved.sourceLang ?? "auto");
  const [targetLang, setTargetLang] = useState(saved.targetLang ?? "en");
  const [result, setResult] = useState<TranslationResult | null>(
    saved.result ?? null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [starred, setStarred] = useState(false);
  const [isListening, setIsListening] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const [sourceTabs, setSourceTabs] = useState(
    saved.sourceTabs ?? DEFAULT_SOURCE_TABS,
  );
  const [targetTabs, setTargetTabs] = useState(
    saved.targetTabs ?? DEFAULT_TARGET_TABS,
  );
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const [showTargetPicker, setShowTargetPicker] = useState(false);
  const [dictEntry, setDictEntry] = useState<DictionaryEntry | null>(null);
  const [dictLoading, setDictLoading] = useState(false);
  const [dictOpen, setDictOpen] = useState(false);
  const [dictCache, setDictCache] = useState<Record<string, DictionaryEntry>>(
    {},
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-translate with 500ms debounce
  useEffect(() => {
    if (!text.trim()) {
      setResult(null);
      setError(null);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setError(null);
      setSavedMsg(null);
      try {
        const r = await translate(text, sourceLang, targetLang);
        setResult(r);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Translation failed");
      } finally {
        setLoading(false);
      }
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [text, sourceLang, targetLang]);

  // Persist state to localStorage so it survives tab switches and page refreshes
  useEffect(() => {
    saveState({ text, sourceLang, targetLang, result, sourceTabs, targetTabs });
  }, [text, sourceLang, targetLang, result, sourceTabs, targetTabs]);

  const pushRecentSource = useCallback((code: string) => {
    if (code === "auto") return;
    setSourceTabs((prev) =>
      [code, ...prev.filter((c) => c !== code)].slice(0, 3),
    );
  }, []);

  const pushRecentTarget = useCallback((code: string) => {
    setTargetTabs((prev) =>
      [code, ...prev.filter((c) => c !== code)].slice(0, 3),
    );
  }, []);

  const selectSource = (code: string) => {
    setSourceLang(code);
    if (code !== "auto") pushRecentSource(code);
    setShowSourcePicker(false);
  };

  const selectTarget = (code: string) => {
    setTargetLang(code);
    pushRecentTarget(code);
    setShowTargetPicker(false);
  };

  const swap = () => {
    if (sourceLang === "auto") return;
    const prevSource = sourceLang;
    const prevTarget = targetLang;
    selectSource(prevTarget);
    selectTarget(prevSource);
    if (result) {
      setText(result.translation);
      setResult(null);
    }
  };

  const clear = () => {
    setText("");
    setResult(null);
    setError(null);
    textareaRef.current?.focus();
  };

  const copy = async () => {
    if (!result?.translation) return;
    await navigator.clipboard.writeText(result.translation);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // speak is imported from @/lib/tts (Google TTS proxy, not SpeechSynthesis)

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang = LANG_MAP[detectedCode ?? sourceLang] ?? sourceLang ?? "en-US";
    rec.interimResults = false;
    rec.continuous = false;
    rec.onstart = () => setIsListening(true);
    rec.onend = () => setIsListening(false);
    rec.onerror = () => setIsListening(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      const t = e.results[0][0].transcript;
      setText((prev: string) =>
        (prev ? `${prev} ${t}` : t).slice(0, MAX_CHARS),
      );
    };
    recognitionRef.current = rec;
    rec.start();
  };

  const quickSave = () => {
    if (!result?.translation) return;
    const fav =
      decks.find((d) => d.name === "Favorites") ?? onCreateDeck("Favorites");
    save(fav.id);
    setStarred(true);
    setTimeout(() => setStarred(false), 2000);
  };

  const save = (deckId: string) => {
    if (!result) return;
    const resolvedSource =
      sourceLang === "auto" ? (result.detectedLang ?? "en") : sourceLang;
    const added = onAddCard(deckId, {
      front: text.trim(),
      back: result.translation,
      sourceLang: resolvedSource,
      targetLang,
      examples: result.examples,
    });
    const deck = decks.find((d) => d.id === deckId);
    setSavedMsg(
      added ? `Saved to "${deck?.name}"` : `Already in "${deck?.name}"`,
    );
    setTimeout(() => setSavedMsg(null), 2500);
  };

  const saveToNew = () => {
    if (!result) return;
    const resolvedSource =
      sourceLang === "auto" ? (result.detectedLang ?? "en") : sourceLang;
    const deck = onCreateDeck(`${resolvedSource}→${targetLang}`);
    save(deck.id);
  };

  // Save a card with a custom back value (used by DictionaryPanel alternative chips)
  const saveWithCustomBack = (back: string) => {
    const fav =
      decks.find((d) => d.name === "Favorites") ?? onCreateDeck("Favorites");
    const resolvedSource =
      sourceLang === "auto" ? (result?.detectedLang ?? "en") : sourceLang;
    const added = onAddCard(fav.id, {
      front: text.trim(),
      back,
      sourceLang: resolvedSource,
      targetLang,
      examples: result?.examples ?? [],
    });
    setSavedMsg(
      added
        ? `Saved "${back}" to "Favorites"`
        : `"${back}" already in "Favorites"`,
    );
    setTimeout(() => setSavedMsg(null), 2500);
  };

  const handleOpenDictionary = async () => {
    if (dictOpen) {
      setDictOpen(false);
      return;
    }
    setDictOpen(true);
    // Resolve "auto" to the detected language so the API route gets the real
    // source language and looks up the correct dictionary (e.g. ja → Jisho).
    const resolvedSource =
      sourceLang === "auto" ? (result?.detectedLang ?? "en") : sourceLang;
    const cacheKey = `${text}|${resolvedSource}|${targetLang}`;
    if (dictCache[cacheKey]) {
      setDictEntry(dictCache[cacheKey]);
      return;
    }
    setDictLoading(true);
    try {
      const entry = await getDictionary(text, resolvedSource, targetLang);
      setDictCache((prev) => ({ ...prev, [cacheKey]: entry }));
      setDictEntry(entry);
    } finally {
      setDictLoading(false);
    }
  };

  // Reset star, dictionary panel when source text changes
  useEffect(() => {
    setStarred(false);
    setDictOpen(false);
    setDictEntry(null);
  }, [text]);

  const detectedCode = result?.detectedLang;
  const detectedName = detectedCode ? langName(detectedCode) : null;
  const charCount = text.length;
  const nearLimit = charCount > MAX_CHARS * 0.8;
  const hasTranslation = !!result?.translation;

  const closeAllPickers = () => {
    setShowSourcePicker(false);
    setShowTargetPicker(false);
  };

  return (
    <div className="flex flex-col gap-0">
      {/* ── Main card ── */}
      <div
        className="overflow-hidden rounded-2xl border border-line bg-paper shadow-sm"
        onClick={closeAllPickers}
      >
        {/* ── Language bar ── */}

        {/* Mobile: two compact buttons + swap (fits any screen width) */}
        <div className="flex items-stretch border-b border-line sm:hidden">
          <div
            className="relative min-w-0 flex-1"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                setShowSourcePicker((v) => !v);
                setShowTargetPicker(false);
              }}
              className="flex w-full items-center justify-between gap-1 px-3 py-3 text-left text-sm font-medium text-ink"
            >
              <span className="truncate">
                {sourceLang === "auto"
                  ? detectedName
                    ? `${detectedName} ·det`
                    : "Detect"
                  : langName(sourceLang)}
              </span>
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4 shrink-0 fill-current text-ink-soft"
              >
                <path d="M7 10l5 5 5-5z" />
              </svg>
            </button>
            {showSourcePicker && (
              <LangPicker
                exclude={["auto"]}
                selected={sourceLang}
                onSelect={selectSource}
              />
            )}
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              swap();
            }}
            disabled={sourceLang === "auto"}
            title="Swap languages"
            aria-label="Swap languages"
            className="shrink-0 border-x border-line px-3 text-ink-soft/60 transition-colors hover:text-accent disabled:cursor-not-allowed disabled:opacity-30"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
              <path d="M6.99 11L3 15l3.99 4v-3H14v-2H6.99v-3zM21 9l-3.99-4v3H10v2h7.01v3L21 9z" />
            </svg>
          </button>

          <div
            className="relative min-w-0 flex-1"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                setShowTargetPicker((v) => !v);
                setShowSourcePicker(false);
              }}
              className="flex w-full items-center justify-between gap-1 px-3 py-3 text-left text-sm font-medium text-ink"
            >
              <span className="truncate">{langName(targetLang)}</span>
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4 shrink-0 fill-current text-ink-soft"
              >
                <path d="M7 10l5 5 5-5z" />
              </svg>
            </button>
            {showTargetPicker && (
              <LangPicker
                selected={targetLang}
                onSelect={selectTarget}
                alignRight
              />
            )}
          </div>
        </div>

        {/* Desktop: full tab strip */}
        <div className="hidden items-stretch border-b border-line sm:flex">
          {/* Source side */}
          <div className="flex min-w-0 flex-1 items-stretch overflow-x-auto">
            <LangTab
              active={sourceLang === "auto"}
              onClick={() => selectSource("auto")}
            >
              {sourceLang === "auto" && detectedName
                ? `${detectedName} – detected`
                : "Detect language"}
            </LangTab>
            {sourceTabs.map((code) => (
              <LangTab
                key={code}
                active={sourceLang === code}
                onClick={() => selectSource(code)}
              >
                {langName(code)}
              </LangTab>
            ))}
            <div
              className="relative flex-shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                aria-label="More source languages"
                onClick={() => {
                  setShowSourcePicker((v) => !v);
                  setShowTargetPicker(false);
                }}
                className="flex h-full items-center px-2 text-ink-soft transition-colors hover:text-ink"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
                  <path d="M7 10l5 5 5-5z" />
                </svg>
              </button>
              {showSourcePicker && (
                <LangPicker
                  exclude={["auto"]}
                  selected={sourceLang}
                  onSelect={selectSource}
                />
              )}
            </div>
          </div>

          {/* Swap */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              swap();
            }}
            disabled={sourceLang === "auto"}
            title="Swap languages"
            aria-label="Swap languages"
            className="flex flex-shrink-0 items-center justify-center px-3 text-ink-soft/60 transition-colors hover:text-accent disabled:cursor-not-allowed disabled:opacity-30"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
              <path d="M6.99 11L3 15l3.99 4v-3H14v-2H6.99v-3zM21 9l-3.99-4v3H10v2h7.01v3L21 9z" />
            </svg>
          </button>

          {/* Target side */}
          <div className="flex min-w-0 flex-1 items-stretch justify-end overflow-x-auto">
            {targetTabs.map((code) => (
              <LangTab
                key={code}
                active={targetLang === code}
                onClick={() => selectTarget(code)}
              >
                {langName(code)}
              </LangTab>
            ))}
            <div
              className="relative flex-shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                aria-label="More target languages"
                onClick={() => {
                  setShowTargetPicker((v) => !v);
                  setShowSourcePicker(false);
                }}
                className="flex h-full items-center px-2 text-ink-soft transition-colors hover:text-ink"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
                  <path d="M7 10l5 5 5-5z" />
                </svg>
              </button>
              {showTargetPicker && (
                <LangPicker
                  selected={targetLang}
                  onSelect={selectTarget}
                  alignRight
                />
              )}
            </div>
          </div>
        </div>

        {/* ── Translation panels ── */}
        <div className="flex flex-col sm:flex-row sm:min-h-[220px]">
          {/* Left / source panel */}
          <div className="relative flex min-w-0 flex-1 flex-col border-b border-line bg-paper sm:border-b-0 sm:border-r">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, MAX_CHARS))}
              placeholder="Enter text"
              rows={7}
              aria-label="Source text"
              className="flex-1 resize-none bg-transparent p-5 pb-2 text-xl leading-relaxed text-ink outline-none placeholder:text-ink-soft/60"
            />

            {/* Source romanization */}
            {result?.srcRomanization && (
              <p className="px-5 pb-2 text-sm italic text-ink-soft/60">
                {result.srcRomanization}
              </p>
            )}

            {/* Clear (×) button — absolute top-right */}
            {text && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  clear();
                }}
                aria-label="Clear text"
                className="absolute right-3 top-3 rounded-full p-1.5 text-ink-soft/60 transition-colors hover:bg-paper-2 hover:text-ink-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                </svg>
              </button>
            )}

            {/* Source panel footer: speaker + mic left, char count right */}
            <div className="flex items-center justify-between border-t border-line/50 px-4 py-2">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => speak(text, detectedCode ?? sourceLang)}
                  disabled={!text}
                  title="Listen"
                  aria-label="Listen to source text"
                  className="rounded-full p-1.5 text-ink-soft transition-colors hover:bg-paper-2 hover:text-accent disabled:cursor-default disabled:opacity-30"
                >
                  <SpeakerIcon />
                </button>
                <button
                  onClick={toggleListening}
                  title={isListening ? "Stop listening" : "Speak to translate"}
                  aria-label={isListening ? "Stop listening" : "Voice input"}
                  className={`rounded-full p-1.5 transition-colors hover:bg-paper-2 ${
                    isListening
                      ? "animate-pulse text-red-500"
                      : "text-ink-soft hover:text-accent"
                  }`}
                >
                  <MicIcon />
                </button>
              </div>
              <span
                className={`select-none text-xs tabular-nums ${
                  nearLimit ? "text-orange-500" : "text-ink-soft/60"
                }`}
              >
                {charCount} / {MAX_CHARS}
              </span>
            </div>
          </div>

          {/* Right / target panel */}
          <div className="relative flex min-w-0 flex-1 flex-col bg-paper-2">
            {/* Translation output */}
            <div className="flex-1 p-5 pb-2">
              {loading ? (
                <p className="animate-pulse text-xl text-ink-soft/60">
                  Translating…
                </p>
              ) : error ? (
                <p className="text-sm text-red-500">{error}</p>
              ) : result?.translation ? (
                <p className="whitespace-pre-wrap text-lg leading-relaxed text-accent sm:text-xl">
                  {result.translation}
                </p>
              ) : (
                <p className="select-none text-lg text-ink-soft/40 sm:text-xl">
                  Translation
                </p>
              )}

              {/* Romanization of translation */}
              {result?.romanization && (
                <p className="mt-1.5 text-sm italic text-ink-soft/60">
                  {result.romanization}
                </p>
              )}
            </div>

            {/* Target panel footer: speaker + copy left */}
            <div className="flex items-center gap-1 border-t border-line px-4 py-2">
              <button
                onClick={() => speak(result?.translation ?? "", targetLang)}
                disabled={!result?.translation}
                title="Listen to translation"
                aria-label="Listen to translation"
                className="rounded-full p-1.5 text-ink-soft transition-colors hover:bg-paper-2 hover:text-accent disabled:cursor-default disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <SpeakerIcon />
              </button>
              <button
                onClick={copy}
                disabled={!result?.translation}
                title={copied ? "Copied!" : "Copy translation"}
                aria-label={copied ? "Copied!" : "Copy translation"}
                className={`rounded-full p-1.5 transition-colors hover:bg-paper-2 disabled:cursor-default disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                  copied ? "text-accent" : "text-ink-soft hover:text-accent"
                }`}
              >
                {copied ? <CheckIcon /> : <CopyIcon />}
              </button>
              <button
                onClick={quickSave}
                disabled={!result?.translation}
                title={starred ? "Saved to Favorites!" : "Save to Favorites"}
                aria-label={
                  starred ? "Saved to Favorites" : "Save to Favorites"
                }
                className={`rounded-full p-1.5 transition-colors hover:bg-paper-2 disabled:cursor-default disabled:opacity-30 ${
                  starred
                    ? "text-yellow-500"
                    : "text-ink-soft hover:text-yellow-500"
                }`}
              >
                <StarIcon filled={starred} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Dictionary + alternatives panel ── */}
      {result &&
        !!(
          result.dict?.length ||
          result.alternatives?.length ||
          result.examples?.length
        ) && <TranslationResultPanel result={result} />}

      {/* ── See dictionary toggle ── */}
      {hasTranslation && (
        <div className="mt-2 flex items-center gap-2 px-1">
          <button
            onClick={handleOpenDictionary}
            disabled={dictLoading}
            className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-default disabled:opacity-50 ${
              dictOpen
                ? "border-accent bg-accent/10 text-accent hover:bg-accent/20"
                : "border-line text-ink-soft hover:border-accent hover:text-accent"
            }`}
          >
            {dictLoading ? (
              <span className="animate-pulse">Loading…</span>
            ) : (
              <>
                <svg
                  viewBox="0 0 24 24"
                  className="h-3.5 w-3.5 fill-current"
                  aria-hidden="true"
                >
                  <path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 18H6V4h2v8l2.5-1.5L13 12V4h5v16z" />
                </svg>
                {dictOpen ? "Hide dictionary" : "See dictionary"}
              </>
            )}
          </button>
        </div>
      )}

      {/* ── Dictionary drawer (right-side slide-in) ── */}
      {dictOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-ink/20 backdrop-blur-[1px]"
            onClick={() => setDictOpen(false)}
            aria-hidden="true"
          />
          <div
            className={`fixed right-0 top-0 z-50 h-full w-full max-w-sm overflow-y-auto bg-paper shadow-2xl transition-transform duration-300 ${
              dictOpen ? "translate-x-0" : "translate-x-full"
            }`}
            role="dialog"
            aria-modal="true"
            aria-label="Dictionary"
          >
            {dictLoading ? (
              <p className="p-5 text-sm text-ink-soft/60 animate-pulse">
                Loading dictionary…
              </p>
            ) : dictEntry ? (
              <DictionaryPanel
                entry={dictEntry}
                headword={text.trim()}
                sourceLang={
                  sourceLang === "auto"
                    ? (result?.detectedLang ?? "en")
                    : sourceLang
                }
                onAddCard={saveWithCustomBack}
                onClose={() => setDictOpen(false)}
              />
            ) : null}
          </div>
        </>
      )}

      {/* ── Save-to-deck row — shown only when there is a translation result ── */}
      {hasTranslation && (
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-2 px-1">
          <span className="text-xs text-ink-soft/60">Save to deck:</span>
          {decks.map((d) => (
            <button
              key={d.id}
              onClick={() => save(d.id)}
              className="rounded-full border border-line px-3 py-2 text-xs text-ink-soft transition-colors hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:py-1"
            >
              {d.name}
            </button>
          ))}
          <button
            onClick={saveToNew}
            className="rounded-full bg-accent px-3 py-2 text-xs font-medium text-white transition-colors hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:py-1"
          >
            + New deck
          </button>
          {savedMsg && (
            <span className="text-xs text-green-600" role="status">
              {savedMsg}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function LangTab({
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
      className={`whitespace-nowrap px-2 py-2.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent sm:px-4 sm:py-3 sm:text-sm ${
        active
          ? "border-b-2 border-accent text-accent"
          : "border-b-2 border-transparent text-ink-soft hover:bg-paper-2 hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function LangPicker({
  selected,
  onSelect,
  exclude = [],
  alignRight = false,
}: {
  selected: string;
  onSelect: (code: string) => void;
  exclude?: string[];
  alignRight?: boolean;
}) {
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = LANGUAGES.filter(
    (l) =>
      !exclude.includes(l.code) &&
      l.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div
      className={`absolute top-full z-50 mt-1 w-64 rounded-xl border border-line bg-paper shadow-lg ${
        alignRight ? "right-0" : "left-0"
      }`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Search input */}
      <div className="border-b border-line/50 p-2">
        <input
          ref={inputRef}
          autoFocus
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search languages…"
          aria-label="Search languages"
          className="w-full rounded-lg bg-paper-2 px-3 py-1.5 text-sm text-ink outline-none focus:ring-2 focus:ring-accent/20 placeholder:text-ink-soft/60"
        />
      </div>

      {/* Language list */}
      <ul className="max-h-60 overflow-y-auto py-1" role="listbox">
        {filtered.map((l) => (
          <li key={l.code} role="option" aria-selected={l.code === selected}>
            <button
              onClick={() => onSelect(l.code)}
              className={`w-full px-4 py-2 text-left text-sm transition-colors hover:bg-paper-2 focus-visible:bg-paper-2 focus-visible:outline-none ${
                l.code === selected ? "font-medium text-accent" : "text-ink"
              }`}
            >
              {l.name}
            </button>
          </li>
        ))}
        {filtered.length === 0 && (
          <li
            className="px-4 py-3 text-sm text-ink-soft/60"
            role="option"
            aria-selected={false}
          >
            No languages found
          </li>
        )}
      </ul>
    </div>
  );
}

// ── Icon components (inline SVG, no external deps) ────────────────────────────

function SpeakerIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5 fill-current"
      aria-hidden="true"
    >
      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5 fill-current"
      aria-hidden="true"
    >
      <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5 fill-current"
      aria-hidden="true"
    >
      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5 fill-current"
      aria-hidden="true"
    >
      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
    </svg>
  );
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5 fill-current"
      aria-hidden="true"
    >
      {filled ? (
        <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
      ) : (
        <path d="M22 9.24l-7.19-.62L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.63-7.03L22 9.24zM12 15.4l-3.76 2.27 1-4.28-3.32-2.88 4.38-.38L12 6.1l1.71 4.04 4.38.38-3.32 2.88 1 4.28L12 15.4z" />
      )}
    </svg>
  );
}

// ── Translation result panel (inline dict / alternatives from translate.ts) ───

function TranslationResultPanel({ result }: { result: TranslationResult }) {
  const [expanded, setExpanded] = useState(true);
  const hasDict = (result.dict?.length ?? 0) > 0;
  const hasAlts = (result.alternatives?.length ?? 0) > 0;
  const hasExamples = (result.examples?.length ?? 0) > 0;

  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-paper shadow-sm">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-3 text-left hover:bg-paper-2"
      >
        <span className="text-sm font-medium text-ink">
          {hasDict ? "Dictionary" : hasAlts ? "More translations" : "Examples"}
        </span>
        <svg
          viewBox="0 0 24 24"
          className={`h-4 w-4 fill-current text-ink-soft/60 transition-transform ${expanded ? "rotate-180" : ""}`}
        >
          <path d="M7 10l5 5 5-5z" />
        </svg>
      </button>

      {expanded && (
        <div className="space-y-5 border-t border-line/50 px-5 py-4">
          {/* Dictionary by part of speech */}
          {hasDict &&
            result.dict!.map((entry: DictEntry, i: number) => (
              <div key={i}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-soft/60">
                  {entry.pos}
                </p>
                <div className="space-y-2">
                  {entry.words.map((w, j) => (
                    <div key={j} className="flex items-start gap-3">
                      <span className="min-w-[80px] text-sm font-medium text-accent sm:min-w-[130px]">
                        {w.word}
                      </span>
                      {w.reverseTranslation.length > 0 && (
                        <span className="text-sm text-ink-soft">
                          {w.reverseTranslation.join(", ")}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}

          {/* Alternative translations */}
          {hasAlts && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-soft/60">
                More translations
              </p>
              <div className="flex flex-wrap gap-2">
                {result.alternatives!.map(
                  (alt: AlternativeTranslation, i: number) => (
                    <span
                      key={i}
                      className="rounded-full border border-line bg-paper-2 px-3 py-1 text-sm text-ink"
                    >
                      {alt.word}
                      {alt.score > 0.1 && (
                        <span className="ml-1.5 text-xs text-ink-soft/60">
                          {Math.round(alt.score * 100)}%
                        </span>
                      )}
                    </span>
                  ),
                )}
              </div>
            </div>
          )}

          {/* Example sentences */}
          {hasExamples && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-soft/60">
                Examples
              </p>
              <ul className="space-y-2">
                {result.examples.map((ex, i) => (
                  <li key={i} className="text-sm text-ink-soft">
                    <span className="mr-2 text-ink-soft/40">›</span>
                    {ex.source}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
