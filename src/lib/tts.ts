// Module-level ref so we can stop previous audio before starting a new one.
let current: HTMLAudioElement | null = null;

export function speak(text: string, lang: string): void {
  if (!text || typeof window === "undefined") return;

  if (current) {
    current.pause();
    current = null;
  }

  const url = `/api/tts?text=${encodeURIComponent(text)}&lang=${encodeURIComponent(lang)}`;

  const audio = new Audio(url);
  current = audio;
  audio.play().catch(() => {
    // Silently ignore — autoplay blocked or network error
  });
}
