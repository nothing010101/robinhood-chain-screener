"use client";

import { useLanguage } from "@/lib/i18n/LanguageProvider";

export function LanguageSwitcher() {
  const { locale, setLocale } = useLanguage();

  return (
    <div className="flex items-center rounded-full border border-line bg-panel p-0.5 text-xs font-mono">
      {(["en", "zh", "de"] as const).map((code) => (
        <button
          key={code}
          onClick={() => setLocale(code)}
          className={`rounded-full px-3 py-1 uppercase tracking-wide transition-colors ${
            locale === code ? "bg-acid text-canvas" : "text-muted hover:text-ink"
          }`}
        >
          {code}
        </button>
      ))}
    </div>
  );
}
