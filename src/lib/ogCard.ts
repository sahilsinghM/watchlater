// Share-card data assembly, pure: lesson fields in, render-ready strings out.
// Both the OG image endpoint and the page meta tags consume this, so the
// unfurl picture and the unfurl text can never disagree.

export type OgCardInput = {
  title: string;
  channel: string;
  watchScore: number;
};

export type OgCard = {
  title: string;
  channel: string | null;
  scoreText: string | null;
  isFallback: boolean;
};

const MAX_TITLE = 60;

function truncateTitle(title: string): string {
  if (title.length <= MAX_TITLE) return title;
  const cut = title.lastIndexOf(" ", MAX_TITLE);
  return (cut > 0 ? title.slice(0, cut) : title.slice(0, MAX_TITLE)) + "…";
}

export function buildOgCard(input: OgCardInput | null): OgCard {
  if (!input) {
    return {
      title: "Learn any YouTube video in 5 minutes.",
      channel: null,
      scoreText: null,
      isFallback: true,
    };
  }
  return {
    title: truncateTitle(input.title),
    channel: input.channel,
    scoreText: `${input.watchScore.toFixed(1)} / 10`,
    isFallback: false,
  };
}
