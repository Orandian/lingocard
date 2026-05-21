import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LingoCard — translate, save, practice",
  description:
    "A local translation app with Anki export and flashcard practice.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Apply saved theme before paint to prevent flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('lingocard.theme')||'warm';document.documentElement.setAttribute('data-theme',t);})();`,
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin=""
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,900&family=Spline+Sans:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="relative min-h-screen">
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}
