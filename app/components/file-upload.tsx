"use client";

import { useRef, useState, DragEvent } from "react";
import { Upload, FileText, X } from "lucide-react";

const ACCEPTED_TYPES = [
  ".txt",
  ".doc",
  ".docx",
  ".pdf",
  ".xlsx",
  ".xls",
  ".html",
  ".htm",
  ".csv",
];

interface FileUploadProps {
  file: File | null;
  onFileChange: (file: File | null) => void;
}

export default function FileUpload({ file, onFileChange }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) validateAndSet(droppedFile);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (selected) validateAndSet(selected);
  }

  function validateAndSet(f: File) {
    const ext = "." + f.name.split(".").pop()?.toLowerCase();
    if (!ACCEPTED_TYPES.includes(ext)) {
      alert(`Unsupported file type. Accepted: ${ACCEPTED_TYPES.join(", ")}`);
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      alert("File size must be under 10MB");
      return;
    }
    onFileChange(f);
  }

  function formatSize(bytes: number) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  return (
    <div>
      <label className="block text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-widest mb-2.5">
        Upload File
      </label>

      {!file ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`relative cursor-pointer border border-dashed rounded-xl p-10 text-center transition-all duration-200 ${
            dragOver
              ? "border-indigo-400/50 bg-indigo-400/[0.04]"
              : "border-[var(--border-hover)] hover:border-indigo-400/30 hover:bg-[var(--bg)]"
          }`}
        >
          <div className="w-11 h-11 rounded-xl bg-indigo-400/[0.06] border border-indigo-400/10 flex items-center justify-center mx-auto mb-3.5">
            <Upload size={20} className="text-indigo-400/70" />
          </div>
          <p className="text-sm text-[var(--text-primary)] font-medium mb-1">
            Drop a file here or click to browse
          </p>
          <p className="text-xs text-[var(--text-muted)]">
            TXT, DOC, DOCX, PDF, XLSX, HTML, CSV — up to 10MB
          </p>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(",")}
            onChange={handleChange}
            className="hidden"
          />
        </div>
      ) : (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-[var(--border)] bg-[var(--bg)] transition-colors duration-200 hover:border-[var(--border-hover)]">
          <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-indigo-400/[0.06] flex items-center justify-center">
            <FileText size={17} className="text-indigo-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[var(--text-primary)] truncate">
              {file.name}
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              {formatSize(file.size)}
            </p>
          </div>
          <button
            onClick={() => onFileChange(null)}
            className="flex-shrink-0 p-1.5 rounded-lg hover:bg-red-500/[0.08] text-[var(--text-muted)] hover:text-red-400 transition-colors duration-200"
          >
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
