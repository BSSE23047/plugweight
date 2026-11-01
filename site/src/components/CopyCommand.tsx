"use client";

import { Check, Copy } from "@phosphor-icons/react";
import { useState } from "react";

export function CopyCommand({ command, label }: { command: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={label}
      className="group inline-flex max-w-full items-center gap-3 bg-accent px-4 py-3 text-left font-mono text-sm text-accent-ink transition-transform active:scale-[0.98]"
    >
      <span className="truncate">{command}</span>
      {copied ? <Check size={16} weight="bold" aria-hidden /> : <Copy size={16} weight="bold" aria-hidden />}
      <span className="sr-only" aria-live="polite">{copied ? "Copied" : ""}</span>
    </button>
  );
}
