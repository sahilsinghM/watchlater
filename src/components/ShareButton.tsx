import { useState } from "react";
import { Share2 } from "lucide-react";

type Props = {
  /** Path to share, e.g. `/lesson/abc123`. Combined with the current origin. */
  path: string;
  /** Title handed to the native share sheet. */
  title?: string;
  /** Supporting text handed to the native share sheet. */
  text?: string;
  /** Button label. Defaults to "Share". */
  label?: string;
  className?: string;
};

// Secondary control: inverts to ink on hover, sinks on press — the brand
// interaction physics. Native share sheet on mobile, copy-link fallback on
// desktop with a brief "Link copied ✓" confirmation.
const baseClass =
  "inline-flex items-center gap-2 rounded-2xl bg-card brutal-border px-5 py-3 font-bold transition " +
  "hover:-translate-y-0.5 hover:-translate-x-0.5 hover:bg-foreground hover:text-background " +
  "active:translate-x-0 active:translate-y-0";

export function ShareButton({ path, title, text, label = "Share", className }: Props) {
  const [copied, setCopied] = useState(false);

  async function onShare() {
    const url =
      typeof window !== "undefined" ? `${window.location.origin}${path}` : path;

    // Prefer the native share sheet where available (mobile).
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (error) {
        // User dismissed the sheet — not an error worth surfacing.
        if (error instanceof DOMException && error.name === "AbortError") return;
        // Otherwise fall through to copy.
      }
    }

    // Fallback: copy the link to the clipboard.
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (e.g. insecure context) — last-ditch prompt.
      window.prompt("Copy this link:", url);
    }
  }

  return (
    <button type="button" onClick={onShare} className={`${baseClass} ${className ?? ""}`}>
      <Share2 className="size-4" aria-hidden />
      {copied ? "Link copied ✓" : label}
    </button>
  );
}
