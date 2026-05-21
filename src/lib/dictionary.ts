import { DictionaryEntry } from "@/types";

// All external API calls go through /api/dictionary (server-side).
// The browser never touches dictionaryapi.dev or jisho.org directly.
export async function getDictionary(
  text: string,
  sourceLang: string,
  targetLang: string,
): Promise<DictionaryEntry> {
  const url =
    `/api/dictionary` +
    `?word=${encodeURIComponent(text.trim())}` +
    `&source=${encodeURIComponent(sourceLang)}` +
    `&target=${encodeURIComponent(targetLang)}`;

  const res = await fetch(url);
  if (!res.ok) return {};
  return (await res.json()) as DictionaryEntry;
}
