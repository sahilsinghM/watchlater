import { useState } from "react";
import { Menu, X } from "lucide-react";

/**
 * Mobile-only nav toggle. The desktop nav (<nav className="hidden sm:flex …">) lives
 * in the parent header alongside this component and is always in the DOM.
 * This component renders:
 *   - a hamburger button (visible only below sm)
 *   - a dropdown of the same links (only in DOM when open, so tests can assert presence)
 */
export function HomeNav() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label={isOpen ? "Close navigation" : "Open navigation"}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((v) => !v)}
        className="sm:hidden flex items-center justify-center min-h-[44px] min-w-[44px] rounded-xl hover:bg-foreground/5 transition"
      >
        {isOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {isOpen && (
        <div className="sm:hidden absolute top-[72px] left-0 right-0 z-50 bg-background border-b-2 border-foreground/10 px-4 py-3 flex flex-col gap-1">
          <a
            href="#how"
            onClick={() => setIsOpen(false)}
            className="flex items-center min-h-[44px] px-3 text-sm font-medium text-muted-foreground hover:text-foreground transition rounded-lg hover:bg-foreground/5"
          >
            How it works
          </a>
          <a
            href="#what"
            onClick={() => setIsOpen(false)}
            className="flex items-center min-h-[44px] px-3 text-sm font-medium text-muted-foreground hover:text-foreground transition rounded-lg hover:bg-foreground/5"
          >
            What you get
          </a>
        </div>
      )}
    </>
  );
}
