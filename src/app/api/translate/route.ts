import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const q = searchParams.get("q");
  const sl = searchParams.get("sl") || "auto";
  const tl = searchParams.get("tl") || "en";

  if (!q) {
    return Response.json({ error: "Missing query" }, { status: 400 });
  }

  const url = new URL("https://translate.googleapis.com/translate_a/single");
  url.searchParams.set("client", "gtx");
  url.searchParams.set("sl", sl);
  url.searchParams.set("tl", tl);
  url.searchParams.set("dt", "t"); // translation
  url.searchParams.append("dt", "bd"); // bilingual dict
  url.searchParams.append("dt", "ex"); // examples
  url.searchParams.append("dt", "rm"); // romanization / transliteration
  url.searchParams.append("dt", "at"); // additional translations
  url.searchParams.append("dt", "ss"); // synonyms in source language
  url.searchParams.set("dj", "1"); // named-key JSON
  url.searchParams.set("q", q);

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "Mozilla/5.0" },
  });

  if (!res.ok) {
    return Response.json(
      { error: `Google Translate returned ${res.status}` },
      { status: res.status },
    );
  }

  const data = await res.json();
  return Response.json(data);
}
