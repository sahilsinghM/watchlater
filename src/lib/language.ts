// Human-readable language names for UI chrome (lesson hero eyebrow). English
// display names on purpose: the chrome stays English even when lesson content
// is in the video's language.

export function languageLabel(code: string): string {
  if (!code) return "";
  try {
    const label = new Intl.DisplayNames(["en"], { type: "language", fallback: "none" }).of(code);
    if (label && label.toLowerCase() !== code.toLowerCase()) return label;
  } catch {
    // Malformed code — fall through to the raw-code fallback.
  }
  return code.toUpperCase();
}
