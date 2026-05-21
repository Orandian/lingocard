import { Deck } from "@/types";

export interface ExportOptions {
  tags: boolean;
  reversed: boolean;
}

/**
 * Build an Anki-importable TSV string.
 *
 * Columns: Front, Back, Examples[, Tags]
 *
 * tags:     adds a `lingocard lingocard::en-ja` tag column so users can filter
 *           by language pair inside Anki.
 * reversed: emits a second row per card with Front/Back swapped, giving both
 *           recognition and production notes on import.
 */
export function deckToAnkiTsv(
  deck: Deck,
  options: ExportOptions = { tags: false, reversed: false },
): string {
  const lines: string[] = [];
  lines.push("#separator:tab");
  lines.push("#html:true");

  const cols = ["Front", "Back", "Examples"];
  if (options.tags) cols.push("Tags");
  lines.push(`#columns:${cols.join("\t")}`);
  if (options.tags) lines.push("#tags column:Tags");

  for (const card of deck.cards) {
    const front = sanitize(card.front);
    const back = sanitize(card.back);
    const examples = card.examples
      .map((e) => `${sanitize(e.source)} → ${sanitize(e.target)}`)
      .join("<br>");

    const fwdTag = options.tags
      ? `lingocard lingocard::${card.sourceLang}-${card.targetLang}`
      : null;
    lines.push(row([front, back, examples], fwdTag));

    if (options.reversed) {
      const revTag = options.tags
        ? `lingocard lingocard::${card.targetLang}-${card.sourceLang} lingocard::reversed`
        : null;
      lines.push(row([back, front, examples], revTag));
    }
  }

  return lines.join("\n");
}

function row(fields: string[], tag: string | null): string {
  return tag ? [...fields, tag].join("\t") : fields.join("\t");
}

function sanitize(s: string): string {
  return s.replace(/\t/g, " ").replace(/\r?\n/g, " ").trim();
}

export function downloadDeck(deck: Deck, options: ExportOptions): void {
  const tsv = deckToAnkiTsv(deck, options);
  const blob = new Blob([tsv], {
    type: "text/tab-separated-values;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${deck.name.replace(/[^a-z0-9-_]+/gi, "_")}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
