import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const text = searchParams.get("text")?.trim() ?? "";
  const lang = searchParams.get("lang") ?? "en";

  if (!text) return new Response("Missing text", { status: 400 });

  const url = new URL("https://translate.googleapis.com/translate_tts");
  url.searchParams.set("ie", "UTF-8");
  url.searchParams.set("q", text.slice(0, 200)); // unofficial API cap
  url.searchParams.set("tl", lang);
  url.searchParams.set("client", "gtx");
  url.searchParams.set("ttsspeed", "1");
  url.searchParams.set("total", "1");
  url.searchParams.set("idx", "0");
  url.searchParams.set("textlen", String(Math.min(text.length, 200)));

  const res = await fetch(url.toString(), {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Referer: "https://translate.google.com/",
    },
  });

  if (!res.ok)
    return new Response("TTS upstream failed", { status: res.status });

  const audio = await res.arrayBuffer();
  return new Response(audio, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
