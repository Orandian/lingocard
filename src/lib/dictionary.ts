import {
  DictionaryEntry,
  DictionaryAlternative,
  DictionaryPosGroup,
  DictionarySense,
} from "@/types";

// ── MyMemory shape ────────────────────────────────────────────────────────────
interface MyMemoryMatch {
  segment?: string;
  translation?: string;
  match?: number;
}

interface MyMemoryResponse {
  matches?: MyMemoryMatch[];
}

// ── dictionaryapi.dev shape ───────────────────────────────────────────────────
interface FreeDictPhonetic {
  text?: string;
}

interface FreeDictDefinitionItem {
  definition?: string;
  example?: string;
  synonyms?: string[];
}

interface FreeDictMeaning {
  partOfSpeech?: string;
  definitions?: FreeDictDefinitionItem[];
}

interface FreeDictEntry {
  phonetics?: FreeDictPhonetic[];
  meanings?: FreeDictMeaning[];
}

// ── Jisho shape ───────────────────────────────────────────────────────────────
interface JishoJapanese {
  reading?: string;
}

interface JishoSense {
  parts_of_speech?: string[];
  english_definitions?: string[];
}

interface JishoWord {
  japanese?: JishoJapanese[];
  tags?: string[];
  senses?: JishoSense[];
}

interface JishoResponse {
  data?: JishoWord[];
}

// ── Tier 1: MyMemory alternatives (all language pairs) ────────────────────────
async function fetchAlternatives(
  text: string,
  sourceLang: string,
  targetLang: string,
): Promise<DictionaryAlternative[]> {
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceLang}|${targetLang}`;
    const res = await fetch(url);
    if (!res.ok) return [];

    const data = (await res.json()) as MyMemoryResponse;
    if (!Array.isArray(data.matches)) return [];

    const seen = new Set<string>();
    const results: DictionaryAlternative[] = [];

    for (const match of data.matches) {
      if ((match.match ?? 0) <= 0.5) continue;
      const translation = (match.translation ?? "").trim();
      if (!translation) continue;

      const key = translation.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      results.push({ text: translation });
      if (results.length >= 8) break;
    }

    return results;
  } catch {
    return [];
  }
}

// ── Tier 2a: English definitions (dictionaryapi.dev) ─────────────────────────
async function fetchEnglishDefinitions(word: string): Promise<{
  phonetic?: string;
  defsByPos: DictionaryPosGroup[];
  examples: { source: string; target: string }[];
}> {
  try {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
    );
    if (!res.ok) return { defsByPos: [], examples: [] };

    const data = (await res.json()) as FreeDictEntry[];
    if (!Array.isArray(data) || data.length === 0)
      return { defsByPos: [], examples: [] };

    const entry = data[0];
    const phonetic = entry.phonetics?.find((p) => p.text)?.text ?? undefined;

    const defsByPos: DictionaryPosGroup[] = [];
    const examples: { source: string; target: string }[] = [];

    for (const meaning of entry.meanings ?? []) {
      const pos = meaning.partOfSpeech ?? "";
      const senses: DictionarySense[] = (meaning.definitions ?? [])
        .slice(0, 4)
        .map((d) => ({
          definition: d.definition ?? "",
          example: d.example ?? undefined,
          synonyms: (d.synonyms ?? []).slice(0, 5),
        }));

      if (senses.length > 0) {
        defsByPos.push({ pos, senses });
      }

      // Gather examples from definitions
      for (const d of meaning.definitions ?? []) {
        if (d.example && examples.length < 5) {
          examples.push({ source: d.example, target: "" });
        }
      }
    }

    return { phonetic, defsByPos, examples };
  } catch {
    return { defsByPos: [], examples: [] };
  }
}

// ── Tier 2b: Japanese (Jisho) ─────────────────────────────────────────────────
async function fetchJapaneseData(word: string): Promise<{
  readings: string[];
  jlpt?: string;
  defsByPos: DictionaryPosGroup[];
}> {
  try {
    const res = await fetch(
      `https://jisho.org/api/v1/search/words?keyword=${encodeURIComponent(word)}`,
    );
    if (!res.ok) return { readings: [], defsByPos: [] };

    const json = (await res.json()) as JishoResponse;
    const results = json.data ?? [];
    if (results.length === 0) return { readings: [], defsByPos: [] };

    const first = results[0];

    const readings = (first.japanese ?? [])
      .map((j) => j.reading)
      .filter((r): r is string => Boolean(r))
      .slice(0, 3);

    const jlptTag = (first.tags ?? []).find((t) => /^jlpt-/.test(t));
    const jlpt = jlptTag
      ? jlptTag.replace("jlpt-", "").toUpperCase()
      : undefined;

    const defsByPos: DictionaryPosGroup[] = (first.senses ?? [])
      .slice(0, 3)
      .map((sense) => ({
        pos: sense.parts_of_speech?.[0] ?? "",
        senses: (sense.english_definitions ?? []).map((d) => ({
          definition: d,
        })),
      }))
      .filter((g) => g.senses.length > 0);

    return { readings, jlpt, defsByPos };
  } catch (err) {
    if (err instanceof TypeError) {
      // CORS: Jisho blocked client-side
    }
    return { readings: [], defsByPos: [] };
  }
}

// ── Main export ───────────────────────────────────────────────────────────────
export async function getDictionary(
  text: string,
  sourceLang: string,
  targetLang: string,
): Promise<DictionaryEntry> {
  const entry: DictionaryEntry = {};

  // Tier 1 — alternatives for all language pairs
  try {
    const alts = await fetchAlternatives(text, sourceLang, targetLang);
    if (alts.length > 0) entry.alternatives = alts;
  } catch {
    // partial failure — continue
  }

  // Tier 2 — single-word only
  const isSingleWord = text.trim().split(/\s+/).length === 1;
  if (!isSingleWord) return entry;

  const word = text.trim();
  const involvesEnglish = sourceLang === "en" || targetLang === "en";
  const involvesJapanese = sourceLang === "ja" || targetLang === "ja";

  if (involvesEnglish) {
    try {
      const { phonetic, defsByPos, examples } =
        await fetchEnglishDefinitions(word);
      if (phonetic) entry.phonetic = phonetic;
      if (defsByPos.length > 0) entry.defsByPos = defsByPos;
      if (examples.length > 0) entry.examples = examples;
    } catch {
      // partial failure — continue
    }
  }

  if (involvesJapanese) {
    try {
      const { readings, jlpt, defsByPos } = await fetchJapaneseData(word);
      if (readings.length > 0) entry.readings = readings;
      if (jlpt) entry.jlpt = jlpt;
      if (defsByPos.length > 0 && !entry.defsByPos) {
        entry.defsByPos = defsByPos;
      }
    } catch {
      // partial failure — continue
    }
  }

  return entry;
}
