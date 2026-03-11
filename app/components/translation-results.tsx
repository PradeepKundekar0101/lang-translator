"use client";

import { useState } from "react";
import { Copy, Check, Download } from "lucide-react";

interface TranslationResult {
  language: string;
  languageCode: string;
  translatedText: string;
}

interface TranslationResultsProps {
  results: TranslationResult[];
}

export default function TranslationResults({
  results,
}: TranslationResultsProps) {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  async function copyToClipboard(text: string, idx: number) {
    await navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  }

  function downloadAsText(text: string, lang: string) {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `translation_${lang}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (results.length === 0) return null;

  return (
    <div className="space-y-4">
      <h2 className="text-[11px] font-medium text-text-muted uppercase tracking-widest">
        Translations
      </h2>
      {results.map((result, idx) => (
        <div
          key={result.languageCode}
          className="rounded-2xl border border-border bg-surface overflow-hidden transition-colors duration-200 hover:border-border-hover fade-in"
          style={{ animationDelay: `${idx * 0.06}s` }}
        >
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
            <span className="text-sm font-medium text-indigo-400">
              {result.language}
            </span>
            <div className="flex items-center gap-0.5">
              <button
                onClick={() =>
                  downloadAsText(result.translatedText, result.languageCode)
                }
                className="p-1.5 rounded-lg hover:bg-white/4 text-text-muted hover:text-text-primary transition-colors duration-150"
                title="Download as text file"
              >
                <Download size={14} />
              </button>
              <button
                onClick={() => copyToClipboard(result.translatedText, idx)}
                className="p-1.5 rounded-lg hover:bg-white/4 text-text-muted hover:text-text-primary transition-colors duration-150"
                title="Copy to clipboard"
              >
                {copiedIdx === idx ? (
                  <Check size={14} className="text-emerald-400" />
                ) : (
                  <Copy size={14} />
                )}
              </button>
            </div>
          </div>
          <div className="p-5">
            <p className="text-sm text-text-primary whitespace-pre-wrap leading-relaxed">
              {result.translatedText}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
