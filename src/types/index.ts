export interface Language {
  code: string;
  name: string;
}

export interface ExampleSentence {
  source: string;
  target: string;
}

// ── SM-2 card state ───────────────────────────────────────────────────────────
export type CardState = "new" | "learning" | "review" | "lapsed";

export interface Card {
  id: string;
  front: string;
  back: string;
  sourceLang: string;
  targetLang: string;
  examples: ExampleSentence[];
  createdAt: number;
  // SM-2 scheduling
  state: CardState;
  ease: number; // SM-2 ease factor (starts at 2.5, floor 1.3)
  interval: number; // days until next review; 0 while in learning steps
  reps: number; // consecutive correct reviews; also step index during learning
  lapses: number; // times the card was forgotten
  due: number; // unix ms timestamp when card is next due
  lastReviewed: number | null;
  // Legacy Leitner field — preserved so v1 data can be migrated without loss
  box?: number;
}

export interface DeckConfig {
  newPerDay: number; // max new cards introduced per calendar day
  maxReviewsPerDay: number; // max review/learning/lapsed cards shown per day
}

export interface Deck {
  id: string;
  name: string; // use "::" for hierarchy, e.g. "Japanese::N2::Verbs"
  cards: Card[];
  createdAt: number;
  dailyLimit?: number; // legacy — superseded by config.newPerDay
  config: DeckConfig;
}

export interface DictWord {
  word: string;
  reverseTranslation: string[];
}

export interface DictEntry {
  pos: string;
  terms: string[];
  words: DictWord[];
}

export interface AlternativeTranslation {
  word: string;
  score: number;
}

export interface TranslationResult {
  translation: string;
  romanization?: string;
  srcRomanization?: string;
  dict?: DictEntry[];
  alternatives?: AlternativeTranslation[];
  examples: ExampleSentence[];
  detectedLang?: string;
}

export interface DictionarySense {
  definition: string;
  example?: string;
  synonyms?: string[];
  register?: string;
}

export interface DictionaryPosGroup {
  pos: string;
  senses: DictionarySense[];
}

export interface DictionaryAlternative {
  pos?: string;
  text: string;
  backTranslations?: string[];
}

export interface DictionaryEntry {
  phonetic?: string;
  defsByPos?: DictionaryPosGroup[];
  examples?: { source: string; target: string }[];
  alternatives?: DictionaryAlternative[];
  readings?: string[];
  jlpt?: string;
}
