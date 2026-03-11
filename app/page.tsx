"use client";

import { useState } from "react";
import {
  Languages,
  FileText,
  Type,
  Loader2,
  AlertCircle,
  Download,
  Globe,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import LanguageSelector from "@/app/components/language-selector";
import FileUpload from "@/app/components/file-upload";
import TranslationResults from "@/app/components/translation-results";
import { Language } from "@/app/lib/languages";

type Mode = "text" | "file";

interface TranslationResult {
  language: string;
  languageCode: string;
  translatedText: string;
}

interface FileTranslation {
  languageCode: string;
  languageName: string;
  fileName: string;
  blob: Blob;
  status: "pending" | "translating" | "done" | "error";
  error?: string;
}

export default function Home() {
  const [mode, setMode] = useState<Mode>("text");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [selectedLanguages, setSelectedLanguages] = useState<Language[]>([]);
  const [translating, setTranslating] = useState(false);
  const [textResults, setTextResults] = useState<TranslationResult[]>([]);
  const [fileTranslations, setFileTranslations] = useState<FileTranslation[]>(
    []
  );
  const [error, setError] = useState<string | null>(null);

  async function handleTextTranslation() {
    if (!text.trim() || selectedLanguages.length === 0) return;

    setTranslating(true);
    setError(null);
    setTextResults([]);

    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          targetLanguages: selectedLanguages.map((l) => ({
            code: l.code,
            name: l.name,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Translation failed");
      setTextResults(data.translations);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Translation failed");
    } finally {
      setTranslating(false);
    }
  }

  async function handleFileTranslation() {
    if (!file || selectedLanguages.length === 0) return;

    setTranslating(true);
    setError(null);

    const initial: FileTranslation[] = selectedLanguages.map((lang) => ({
      languageCode: lang.code,
      languageName: lang.name,
      fileName: "",
      blob: new Blob(),
      status: "pending",
    }));
    setFileTranslations(initial);

    for (let i = 0; i < selectedLanguages.length; i++) {
      const lang = selectedLanguages[i];

      setFileTranslations((prev) =>
        prev.map((ft, idx) =>
          idx === i ? { ...ft, status: "translating" } : ft
        )
      );

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("languageCode", lang.code);
        formData.append("languageName", lang.name);

        const res = await fetch("/api/translate-file", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || "Translation failed");
        }

        const blob = await res.blob();
        const fileName =
          res.headers.get("X-Translated-Filename") ||
          `translated_${lang.code}.txt`;

        setFileTranslations((prev) =>
          prev.map((ft, idx) =>
            idx === i ? { ...ft, status: "done", blob, fileName } : ft
          )
        );
      } catch (err) {
        setFileTranslations((prev) =>
          prev.map((ft, idx) =>
            idx === i
              ? {
                ...ft,
                status: "error",
                error:
                  err instanceof Error ? err.message : "Translation failed",
              }
              : ft
          )
        );
      }
    }

    setTranslating(false);
  }

  function downloadFile(ft: FileTranslation) {
    const url = URL.createObjectURL(ft.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = ft.fileName;
    a.click();
    URL.revokeObjectURL(url);
  }

  const canTranslate =
    mode === "text"
      ? text.trim().length > 0 && selectedLanguages.length > 0
      : file !== null && selectedLanguages.length > 0;

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Ambient background orbs */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="ambient-float absolute -top-[25%] -left-[10%] w-[55%] h-[55%] rounded-full bg-indigo-500/[0.03] blur-[150px]" />
        <div className="ambient-float-slow absolute -bottom-[20%] -right-[10%] w-[45%] h-[45%] rounded-full bg-violet-500/[0.025] blur-[120px]" />
        <div className="ambient-float absolute top-[35%] left-[55%] w-[30%] h-[30%] rounded-full bg-blue-500/[0.02] blur-[100px]" />
      </div>

      {/* Subtle dot grid */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.02]"
        style={{
          backgroundImage:
            "radial-gradient(circle, #eaeaef 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      {/* Header */}
      <header className="relative z-10 border-b border-[var(--border)] bg-[var(--bg)]/60 backdrop-blur-xl sticky top-0">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Languages size={15} className="text-white" />
            </div>
            <span className="text-[15px] font-semibold tracking-tight text-[var(--text-primary)]">
              Lingua
            </span>
          </div>

        </div>
      </header>

      {/* Main */}
      <main className="relative z-10 flex-1 max-w-6xl mx-auto w-full px-6 pt-16 pb-20">
        <div className="absolute top-0 -left-[40%] w-[300px] h-[300px] bg-indigo-500/20 rounded-full blur-3xl opacity-50">

        </div>
        {/* Hero */}
        <div className="text-center mb-16">
          <div
            className="fade-up inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-indigo-400/10 bg-indigo-400/[0.06] text-indigo-300 text-xs font-medium mb-6"
          >
            <Globe size={12} />
            AI-Powered Translation
          </div>
          <h1
            className="fade-up font-display text-5xl sm:text-6xl lg:text-[4.25rem] tracking-tight text-[var(--text-primary)] leading-[1.08] mb-5"
            style={{ animationDelay: "0.06s" }}
          >
            Translate{" "}
            <em className="italic text-indigo-400">Anything</em>
          </h1>
          <p
            className="fade-up text-[var(--text-secondary)] text-base sm:text-[1.1rem] max-w-xl mx-auto leading-relaxed"
            style={{ animationDelay: "0.12s" }}
          >
            Translate text or documents into multiple languages instantly.
            <br className="hidden sm:block" />
            Supports TXT, DOC, DOCX, PDF, XLSX, HTML, and more.
          </p>
        </div>

        {/* Content Grid */}
        <div className="grid lg:grid-cols-2 gap-8 items-start">
          {/* ── Input Panel ── */}
          <div
            className="fade-up rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80 backdrop-blur-sm p-6 space-y-5"
            style={{ animationDelay: "0.18s" }}
          >
            {/* Mode Toggle */}
            <div className="flex rounded-xl bg-[var(--bg)] p-1 gap-1">
              <button
                onClick={() => {
                  setMode("text");
                  setError(null);
                }}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-[10px] text-sm font-medium transition-all duration-200 ${mode === "text"
                  ? "bg-[var(--surface-2)] text-[var(--text-primary)] shadow-sm"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                  }`}
              >
                <Type size={14} />
                Text
              </button>
              <button
                onClick={() => {
                  setMode("file");
                  setError(null);
                }}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-[10px] text-sm font-medium transition-all duration-200 ${mode === "file"
                  ? "bg-[var(--surface-2)] text-[var(--text-primary)] shadow-sm"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                  }`}
              >
                <FileText size={14} />
                File
              </button>
            </div>

            {/* Text Input */}
            {mode === "text" && (
              <div className="fade-in">
                <label className="block text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-widest mb-2.5">
                  Source Text
                </label>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Enter or paste text to translate..."
                  rows={7}
                  maxLength={50000}
                  className="w-full px-4 py-3.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-500/30 transition-all leading-relaxed"
                />
                <div className="flex justify-end mt-1.5">
                  <span className="text-[11px] text-[var(--text-muted)] tabular-nums">
                    {text.length.toLocaleString()} / 50,000
                  </span>
                </div>
              </div>
            )}

            {/* File Input */}
            {mode === "file" && (
              <div className="fade-in">
                <FileUpload file={file} onFileChange={setFile} />
              </div>
            )}

            {/* Language Selector */}
            <LanguageSelector
              selected={selectedLanguages}
              onChange={setSelectedLanguages}
            />

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-500/[0.06] border border-red-500/10 fade-in">
                <AlertCircle
                  size={15}
                  className="text-red-400 mt-0.5 flex-shrink-0"
                />
                <p className="text-sm text-red-300/90">{error}</p>
              </div>
            )}

            {/* Translate Button */}
            <button
              onClick={
                mode === "text" ? handleTextTranslation : handleFileTranslation
              }
              disabled={!canTranslate || translating}
              className="group w-full py-3.5 rounded-xl text-sm font-semibold transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 text-white shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 active:scale-[0.98]"
            >
              {translating ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 size={15} className="spinner" />
                  Translating...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Languages size={15} />
                  Translate {mode === "text" ? "Text" : "File"}
                  <ArrowRight
                    size={14}
                    className="transition-transform duration-200 group-hover:translate-x-0.5"
                  />
                </span>
              )}
            </button>
          </div>

          {/* ── Results Panel ── */}
          <div
            className="fade-up space-y-4"
            style={{ animationDelay: "0.24s" }}
          >
            {/* Text — empty state */}
            {mode === "text" && textResults.length === 0 && !translating && (
              <div className="h-full flex items-center justify-center rounded-2xl border border-dashed border-[var(--border)] min-h-[460px]">
                <div className="text-center px-8">
                  <div className="w-14 h-14 rounded-2xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center mx-auto mb-4">
                    <Languages
                      size={24}
                      className="text-[var(--text-muted)]"
                    />
                  </div>
                  <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                    Your translations will appear here
                  </p>
                </div>
              </div>
            )}

            {/* Text — loading skeletons */}
            {mode === "text" && translating && (
              <div className="space-y-4">
                {selectedLanguages.map((lang, i) => (
                  <div
                    key={lang.code}
                    className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden fade-in"
                    style={{ animationDelay: `${i * 0.08}s` }}
                  >
                    <div className="px-5 py-3.5 border-b border-[var(--border)]">
                      <div className="shimmer h-4 w-24 rounded-md" />
                    </div>
                    <div className="p-5 space-y-2.5">
                      <div className="shimmer h-3 w-full rounded-md" />
                      <div className="shimmer h-3 w-4/5 rounded-md" />
                      <div className="shimmer h-3 w-3/5 rounded-md" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Text — results */}
            {mode === "text" && textResults.length > 0 && (
              <div className="fade-in">
                <TranslationResults results={textResults} />
              </div>
            )}

            {/* File — empty state */}
            {mode === "file" &&
              fileTranslations.length === 0 &&
              !translating && (
                <div className="h-full flex items-center justify-center rounded-2xl border border-dashed border-[var(--border)] min-h-[460px]">
                  <div className="text-center px-8">
                    <div className="w-14 h-14 rounded-2xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center mx-auto mb-4">
                      <FileText
                        size={24}
                        className="text-[var(--text-muted)]"
                      />
                    </div>
                    <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                      Translated files will be available for download here
                    </p>
                  </div>
                </div>
              )}

            {/* File — translations list */}
            {mode === "file" && fileTranslations.length > 0 && (
              <div className="space-y-3 fade-in">
                <h2 className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-widest mb-4">
                  Translated Files
                </h2>
                {fileTranslations.map((ft, i) => (
                  <div
                    key={ft.languageCode}
                    className="flex items-center gap-3.5 p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] transition-colors duration-200 hover:border-[var(--border-hover)] fade-in"
                    style={{ animationDelay: `${i * 0.06}s` }}
                  >
                    <div
                      className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{
                        background:
                          ft.status === "done"
                            ? "rgba(52, 211, 153, 0.08)"
                            : ft.status === "error"
                              ? "rgba(248, 113, 113, 0.08)"
                              : "rgba(129, 140, 248, 0.06)",
                      }}
                    >
                      {ft.status === "translating" ? (
                        <Loader2
                          size={17}
                          className="text-indigo-400 spinner"
                        />
                      ) : ft.status === "error" ? (
                        <AlertCircle size={17} className="text-red-400" />
                      ) : ft.status === "done" ? (
                        <FileText size={17} className="text-emerald-400" />
                      ) : (
                        <FileText
                          size={17}
                          className="text-[var(--text-muted)]"
                        />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--text-primary)]">
                        {ft.languageName}
                      </p>
                      {ft.status === "translating" && (
                        <p className="text-xs text-[var(--text-muted)]">
                          Translating...
                        </p>
                      )}
                      {ft.status === "done" && (
                        <p className="text-xs text-emerald-400/80">
                          {ft.fileName}
                        </p>
                      )}
                      {ft.status === "error" && (
                        <p className="text-xs text-red-400/80">{ft.error}</p>
                      )}
                      {ft.status === "pending" && (
                        <p className="text-xs text-[var(--text-muted)]">
                          Queued
                        </p>
                      )}
                    </div>

                    {ft.status === "done" && (
                      <button
                        onClick={() => downloadFile(ft)}
                        className="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-500/[0.08] text-emerald-400 text-xs font-medium hover:bg-emerald-500/[0.14] transition-colors duration-200 border border-emerald-500/10"
                      >
                        <Download size={12} />
                        Download
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-[var(--border)] py-6 mt-auto">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between text-xs text-[var(--text-muted)]">
          <span>Lingua AI Translation</span>
          <span className="hidden sm:inline">
            Files are processed locally and never stored
          </span>
        </div>
      </footer>
    </div>
  );
}
