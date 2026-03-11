"use client";

import { useState, useRef, useEffect } from "react";
import { LANGUAGES, Language } from "@/app/lib/languages";
import { Check, ChevronDown, Search, X } from "lucide-react";

interface LanguageSelectorProps {
  selected: Language[];
  onChange: (languages: Language[]) => void;
}

export default function LanguageSelector({
  selected,
  onChange,
}: LanguageSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = LANGUAGES.filter(
    (lang) =>
      lang.name.toLowerCase().includes(search.toLowerCase()) ||
      lang.nativeName.toLowerCase().includes(search.toLowerCase())
  );

  function toggle(lang: Language) {
    const exists = selected.find((s) => s.code === lang.code);
    if (exists) {
      onChange(selected.filter((s) => s.code !== lang.code));
    } else {
      onChange([...selected, lang]);
    }
  }

  function removeLanguage(code: string) {
    onChange(selected.filter((s) => s.code !== code));
  }

  return (
    <div ref={ref} className="relative">
      <label className="block text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-widest mb-2.5">
        Target Languages
      </label>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2.5">
          {selected.map((lang) => (
            <span
              key={lang.code}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-indigo-400/[0.08] text-indigo-300 border border-indigo-400/10"
            >
              {lang.name}
              <button
                onClick={() => removeLanguage(lang.code)}
                className="hover:text-red-400 transition-colors duration-150"
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-left text-sm transition-all duration-200 hover:border-indigo-400/20 focus:outline-none focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-500/30"
      >
        <span
          className={
            selected.length === 0
              ? "text-[var(--text-muted)]"
              : "text-[var(--text-primary)]"
          }
        >
          {selected.length === 0
            ? "Select languages..."
            : `${selected.length} language${selected.length > 1 ? "s" : ""} selected`}
        </span>
        <ChevronDown
          size={15}
          className={`text-[var(--text-muted)] transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute z-50 mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl shadow-black/30 overflow-hidden fade-in">
          <div className="p-2 border-b border-[var(--border)]">
            <div className="relative">
              <Search
                size={13}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
              />
              <input
                type="text"
                placeholder="Search languages..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-indigo-500/20"
              />
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto p-1">
            {filtered.map((lang) => {
              const isSelected = selected.some((s) => s.code === lang.code);
              return (
                <button
                  key={lang.code}
                  onClick={() => toggle(lang)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors duration-150 ${
                    isSelected
                      ? "bg-indigo-400/[0.08] text-indigo-300"
                      : "hover:bg-[var(--bg)] text-[var(--text-primary)]"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span>{lang.name}</span>
                    <span className="text-[var(--text-muted)] text-xs">
                      {lang.nativeName}
                    </span>
                  </span>
                  {isSelected && (
                    <Check size={14} className="text-indigo-400" />
                  )}
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="text-center text-sm text-[var(--text-muted)] py-4">
                No languages found
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
