import { Link } from "@tanstack/react-router";
import mascot from "@/assets/mascot.png";

export function Brand({ size = "md" }: { size?: "sm" | "md" }) {
  const dim = size === "sm" ? "h-8 w-8" : "h-10 w-10";
  return (
    <Link to="/" className="inline-flex items-center gap-2.5 group">
      <img
        src={mascot}
        alt=""
        width={64}
        height={64}
        className={`${dim} object-contain group-hover:-rotate-6 transition-transform`}
      />
      <span className="font-display font-extrabold text-xl tracking-tight">
        WatchLater
      </span>
    </Link>
  );
}

export { mascot };