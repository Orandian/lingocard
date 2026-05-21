export interface Language {
  code: string;
  name: string;
}

export interface ExampleSentence {
  source: string;
  target: string;
}

export interface Card {
  id: string;
  front: string; // source text
  back: string; // translation
  sourceLang: string;
  targetLang: string;
  examples: ExampleSentence[];
  createdAt: number;
  // Spaced-repetition state for practice mode
  box: number; // Leitner box (1..5)
  due: number; // timestamp when next due
  lastReviewed: number | null;
}

export interface Deck {
  id: string;
  name: string;
  cards: Card[];
  createdAt: number;
  dailyLimit?: number; // max new cards per session (undefined = unlimited)
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
  score: number; // 0–1 frequency
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
  register?: string; // e.g. "informal"
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
  jlpt?: string; // e.g. "N2"
}
