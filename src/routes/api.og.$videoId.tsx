import { createFileRoute } from "@tanstack/react-router";
import { buildOgCard } from "@/lib/ogCard";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Route = (createFileRoute as any)("/api/og/$videoId")({
  component: () => null,
  server: {
    handlers: {
      GET: async ({ params }: { params: { videoId: string } }) => {
        const { videoId } = params;

        let ogInput = null;
        try {
          const { getLessonByYoutubeId } = await import("@/lib/ingest.functions");
          const lesson = await getLessonByYoutubeId({ data: { youtubeId: videoId } });
          ogInput = {
            title: lesson.video.title,
            channel: lesson.video.channel,
            watchScore: lesson.watchScore,
          };
        } catch {
          // unknown video id — fall through to generic card
        }

        const card = buildOgCard(ogInput);

        // Dynamic import keeps satori + @resvg/resvg-js out of the client bundle.
        const { renderOgImage } = await import("@/lib/ogImage.server");
        const png = await renderOgImage(card);

        return new Response(png as BodyInit, {
          headers: {
            "Content-Type": "image/png",
            "Cache-Control": "public, max-age=86400, s-maxage=86400",
          },
        });
      },
    },
  },
});
