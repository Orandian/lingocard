import {
  TranslationResult,
  ExampleSentence,
  DictEntry,
  AlternativeTranslation,
} from "@/types";

export async function translate(
  text: string,
  sourceLang: string,
  targetLang: string,
): Promise<TranslationResult> {
  const trimmed = text.trim();
  if (!trimmed) return { translation: "", examples: [] };

  const url = `/api/translate?q=${encodeURIComponent(trimmed)}&sl=${sourceLang}&tl=${targetLang}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Translation failed (HTTP ${res.status})`);

  const data = await res.json();
  if (data.error) throw new Error(data.error);

  // Main translation
  const translation = Array.isArray(data.sentences)
    ? (data.sentences as { trans?: string }[])
        .map((s) => s.trans ?? "")
        .join("")
    : "";

  // Romanization of translation output
  const romanization = Array.isArray(data.sentences)
    ? (data.sentences as { translit?: string }[])
        .map((s) => s.translit ?? "")
        .join("") || undefined
    : undefined;

  // Romanization of source text
  const srcRomanization = Array.isArray(data.sentences)
    ? (data.sentences as { src_translit?: string }[])
        .map((s) => s.src_translit ?? "")
        .join("") || undefined
    : undefined;

  // Dictionary entries (bilingual dict — single words)
  const dict: DictEntry[] = Array.isArray(data.dict)
    ? (
        data.dict as {
          pos?: string;
          terms?: string[];
          entry?: {
            word?: string;
            reverse_translation?: string[];
            score?: number;
          }[];
        }[]
      )
        .filter((d) => d.pos && Array.isArray(d.terms) && d.terms.length > 0)
        .map((d) => ({
          pos: d.pos!,
          terms: d.terms!.slice(0, 4),
          words: (d.entry ?? [])
            .filter((e) => e.word)
            .slice(0, 4)
            .map((e) => ({
              word: e.word!,
              reverseTranslation: (e.reverse_translation ?? []).slice(0, 3),
            })),
        }))
    : [];

  // Alternative translations (from `at` data type)
  const alternatives: AlternativeTranslation[] = [];
  if (Array.isArray(data.alternative_translations)) {
    for (const group of data.alternative_translations as {
      alternative?: {
        word_postproc?: string;
        score_info?: { score?: number };
      }[];
    }[]) {
      for (const alt of group.alternative ?? []) {
        const word = alt.word_postproc;
        const score = alt.score_info?.score ?? 0;
        if (word && word !== translation) {
          alternatives.push({ word, score });
        }
      }
    }
  }

  // Example sentences
  const examples: ExampleSentence[] = [];
  for (const ex of (data.examples?.example ?? []) as { text?: string }[]) {
    if (!ex.text) continue;
    examples.push({ source: ex.text.replace(/<\/?b>/g, ""), target: "" });
    if (examples.length >= 3) break;
  }

  const detectedLang =
    sourceLang === "auto" ? (data.src ?? undefined) : undefined;

  return {
    translation,
    romanization,
    srcRomanization,
    dict,
    alternatives,
    examples,
    detectedLang,
  };
}
