import { Brand } from "@/components/Brand";
import { Skeleton } from "@/components/ui/skeleton";

// Cold-load placeholders for the lesson routes. Each skeleton mirrors its
// real screen's containers 1:1 (same grid, same card radii/borders, same
// heights) so content arriving causes no layout shift — only the grey bones
// inside the cards get replaced. Shimmer comes from the Skeleton primitive,
// which already disables itself under prefers-reduced-motion.

/** Matches the /lesson/$videoId hero: title block + summary card + embed,
 *  then the attention-map bar and segment cards. */
export function LessonHeroSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto max-w-6xl px-4 sm:px-6 pt-6 pb-4 flex items-center justify-between gap-4 flex-wrap">
        <Brand />
        <Skeleton className="h-10 w-36 rounded-full" />
      </header>

      <main className="mx-auto max-w-6xl px-4 sm:px-6 pb-24 space-y-10">
        <section className="grid grid-cols-1 gap-8 lg:grid-cols-5">
          <div className="lg:col-span-3 flex flex-col gap-6">
            <div className="space-y-3">
              <Skeleton className="h-3 w-44" />
              <Skeleton className="h-10 w-full max-w-xl rounded-xl" />
              <Skeleton className="h-10 w-3/4 rounded-xl" />
            </div>

            <div className="rounded-3xl brutal-border bg-card p-5 sm:p-6 brutal-shadow-sm space-y-4">
              <Skeleton className="h-3 w-40" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-11/12" />
              <Skeleton className="h-5 w-2/3" />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 pt-2">
                <Skeleton className="h-24 rounded-2xl" />
                <Skeleton className="h-24 rounded-2xl" />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Skeleton className="h-[58px] w-56 rounded-2xl" />
              <Skeleton className="h-[50px] w-48 rounded-2xl" />
            </div>
          </div>

          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="aspect-video w-full rounded-3xl brutal-border" />
            <Skeleton className="hidden sm:block h-20 w-full rounded-3xl" />
          </div>
        </section>

        <section className="space-y-5">
          <div>
            <Skeleton className="h-7 w-48 rounded-lg" />
            <Skeleton className="mt-2 h-4 w-72" />
          </div>
          {/* The attention-map bar: same h-10 brutal pill as the real one. */}
          <Skeleton className="h-10 w-full rounded-2xl brutal-border" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-3xl brutal-border bg-card p-4 space-y-2">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl brutal-border bg-card p-5 sm:p-6 brutal-shadow-sm space-y-4">
          <Skeleton className="h-3 w-36" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-3/5" />
        </section>
      </main>
    </div>
  );
}

/** Matches the /lesson/$videoId/player stack: progress bar, lesson card,
 *  reaction buttons. */
export function LessonPlayerSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto max-w-5xl px-4 sm:px-6 pt-6 pb-2 flex items-center justify-between gap-4 flex-wrap">
        <Brand size="sm" />
        <Skeleton className="h-10 w-36 rounded-full" />
      </header>

      <main className="mx-auto max-w-2xl px-4 sm:px-6 pb-32 sm:pb-24 space-y-6">
        <div className="space-y-2">
          <div className="flex justify-between items-end px-1">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-4 w-20" />
          </div>
          <Skeleton className="h-3 w-full rounded-full brutal-border" />
        </div>

        <div className="rounded-[28px] brutal-border bg-card p-6 sm:p-8 brutal-shadow space-y-4">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-8 w-5/6 rounded-xl" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-2/3" />
        </div>

        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[88px] rounded-2xl brutal-border" />
          ))}
        </div>
      </main>
    </div>
  );
}
