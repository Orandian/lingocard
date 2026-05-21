"use client";

import { useEffect, useState } from "react";

export type ThemeId = "warm" | "dark" | "nord" | "slate";

export const THEMES: {
  id: ThemeId;
  label: string;
  paper: string;
  accent: string;
}[] = [
  { id: "warm", label: "Warm", paper: "#f4efe6", accent: "#c2410c" },
  { id: "dark", label: "Dark", paper: "#1c1917", accent: "#fb923c" },
  { id: "nord", label: "Nord", paper: "#2e3440", accent: "#88c0d0" },
  { id: "slate", label: "Slate", paper: "#f0f4f9", accent: "#0284c7" },
];

const STORAGE_KEY = "lingocard.theme";

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeId>("warm");

  useEffect(() => {
    const saved = (localStorage.getItem(STORAGE_KEY) as ThemeId) || "warm";
    setThemeState(saved);
    document.documentElement.setAttribute("data-theme", saved);
  }, []);

  const setTheme = (t: ThemeId) => {
    document.documentElement.setAttribute("data-theme", t);
    localStorage.setItem(STORAGE_KEY, t);
    setThemeState(t);
  };

  return { theme, setTheme };
}
