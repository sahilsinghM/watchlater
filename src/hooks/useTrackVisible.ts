import { useEffect, useRef } from "react";
import { trackSectionVisible, type SectionName } from "@/lib/analytics";

export function useTrackVisible(
  ref: React.RefObject<Element | null>,
  section: SectionName,
  props?: Record<string, unknown>,
  threshold = 0.3,
) {
  const fired = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !fired.current) {
          fired.current = true;
          trackSectionVisible(section, props);
        }
      },
      { threshold },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, section, threshold]); // props intentionally omitted — stable on first render
}
