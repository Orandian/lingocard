import { NextRequest } from "next/server";
import { DictionaryEntry, DictionaryPosGroup, DictionarySense } from "@/types";

// ── External API shapes ───────────────────────────────────────────────────────

interface FreeDictPhonetic {
  text?: string;
}
interface FreeDictDefinition {
  definition?: string;
  example?: string;
  synonyms?: string[];
}
interface FreeDictMeaning {
  partOfSpeech?: string;
  definitions?: FreeDictDefinition[];
}
interface FreeDictEntry {
  phonetics?: FreeDictPhonetic[];
  meanings?: FreeDictMeaning[];
}

interface JishoJapanese {
  word?: string;
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

interface MyMemoryMatch {
  translation?: string;
  match?: number;
}
interface MyMemoryResponse {
  matches?: MyMemoryMatch[];
}

// ── Dictionary lookup functions (server-side — no CORS restrictions) ──────────

async function lookupEnglish(word: string): Promise<DictionaryEntry> {
  const res = await fetch(
    `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
    { headers: { "User-Agent": "Mozilla/5.0" } },
  );
  // 404 means no entry — valid empty result, not an error
  if (!res.ok) return {};

  const data = (await res.json()) as FreeDictEntry[];
  if (!Array.isArray(data) || data.length === 0) return {};

  const first = data[0];
  const phonetic = first.phonetics?.find((p) => p.text)?.text ?? undefined;
  const defsByPos: DictionaryPosGroup[] = [];
  const examples: { source: string; target: string }[] = [];

  for (const meaning of first.meanings ?? []) {
    const senses: DictionarySense[] = (meaning.definitions ?? [])
      .slice(0, 4)
      .map((d) => ({
        definition: d.definition ?? "",
        example: d.example ?? undefined,
        synonyms: (d.synonyms ?? []).slice(0, 5),
      }));
    if (senses.length > 0)
      defsByPos.push({ pos: meaning.partOfSpeech ?? "", senses });
    for (const d of meaning.definitions ?? []) {
      if (d.example && examples.length < 5)
        examples.push({ source: d.example, target: "" });
    }
  }

  return {
    phonetic,
    defsByPos: defsByPos.length ? defsByPos : undefined,
    examples: examples.length ? examples : undefined,
  };
}

async function lookupJapanese(word: string): Promise<DictionaryEntry> {
  const res = await fetch(
    `https://jisho.org/api/v1/search/words?keyword=${encodeURIComponent(word)}`,
    { headers: { "User-Agent": "Mozilla/5.0" } },
  );
  if (!res.ok) return {};

  const json = (await res.json()) as JishoResponse;
  const results = json.data ?? [];
  if (results.length === 0) return {};

  const first = results[0];

  const readings = (first.japanese ?? [])
    .map((j) => j.reading)
    .filter((r): r is string => Boolean(r))
    .slice(0, 4);

  const jlptTag = (first.tags ?? []).find((t) => /^jlpt-/.test(t));
  const jlpt = jlptTag ? jlptTag.replace("jlpt-", "").toUpperCase() : undefined;

  const defsByPos: DictionaryPosGroup[] = (first.senses ?? [])
    .slice(0, 4)
    .map((sense) => ({
      pos: sense.parts_of_speech?.[0] ?? "",
      senses: (sense.english_definitions ?? []).map((d) => ({ definition: d })),
    }))
    .filter((g) => g.senses.length > 0);

  return {
    readings: readings.length ? readings : undefined,
    jlpt,
    defsByPos: defsByPos.length ? defsByPos : undefined,
  };
}

async function lookupAlternatives(
  word: string,
  source: string,
  target: string,
): Promise<DictionaryEntry["alternatives"]> {
  const res = await fetch(
    `https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=${source}|${target}`,
  );
  if (!res.ok) return undefined;

  const data = (await res.json()) as MyMemoryResponse;
  if (!Array.isArray(data.matches)) return undefined;

  const seen = new Set<string>();
  const results: NonNullable<DictionaryEntry["alternatives"]> = [];

  for (const match of data.matches) {
    if ((match.match ?? 0) <= 0.5) continue;
    const text = (match.translation ?? "").trim();
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    results.push({ text });
    if (results.length >= 8) break;
  }

  return results.length ? results : undefined;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const word = searchParams.get("word")?.trim() ?? "";
  // source = the word's language (caller must resolve "auto" before calling)
  const source = searchParams.get("source") ?? "en";
  const target = searchParams.get("target") ?? "en";

  if (!word) return Response.json({ error: "Missing word" }, { status: 400 });

  const entry: DictionaryEntry = {};

  // Always fetch MyMemory alternatives (works for every language pair)
  try {
    const alts = await lookupAlternatives(word, source, target);
    if (alts) entry.alternatives = alts;
  } catch {
    // non-fatal
  }

  // Dictionary lookup is meaningful for single words only
  const isSingleWord = !word.includes(" ");
  if (!isSingleWord) return Response.json(entry);

  // Language decision: the word is in the SOURCE language.
  // Look it up in that language's own dictionary.
  //
  // source=ja → Jisho  (this is what was broken: 缶詰 was sent to the English API)
  // source=en → Free Dictionary API
  // anything else → return alternatives only; no external dictionary for that language
  if (source === "ja") {
    try {
      Object.assign(entry, await lookupJapanese(word));
    } catch {
      // Jisho failed — alternatives still returned
    }
  } else if (source === "en") {
    try {
      Object.assign(entry, await lookupEnglish(word));
    } catch {
      // Free Dictionary failed — alternatives still returned
    }
  }

  return Response.json(entry);
}
