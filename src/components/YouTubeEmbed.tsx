import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export type YouTubePlayerHandle = {
  seekTo: (seconds: number) => void;
  play: () => void;
  pause: () => void;
};

let apiPromise: Promise<void> | null = null;
function loadYouTubeAPI(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.YT && window.YT.Player) return Promise.resolve();
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  });
  return apiPromise;
}

type Props = {
  videoId: string;
  startSeconds?: number;
  className?: string;
};

export const YouTubeEmbed = forwardRef<YouTubePlayerHandle, Props>(
  function YouTubeEmbed({ videoId, startSeconds = 0, className }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const playerRef = useRef<any>(null);

    useImperativeHandle(ref, () => ({
      seekTo: (s: number) => {
        playerRef.current?.seekTo?.(s, true);
        playerRef.current?.playVideo?.();
      },
      play: () => playerRef.current?.playVideo?.(),
      pause: () => playerRef.current?.pauseVideo?.(),
    }));

    useEffect(() => {
      let cancelled = false;
      loadYouTubeAPI().then(() => {
        if (cancelled || !containerRef.current || !window.YT?.Player) return;
        playerRef.current = new window.YT.Player(containerRef.current, {
          videoId,
          playerVars: { start: Math.floor(startSeconds), modestbranding: 1, rel: 0 },
        });
      });
      return () => {
        cancelled = true;
        try {
          playerRef.current?.destroy?.();
        } catch {
          /* noop */
        }
        playerRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [videoId]);

    return (
      <div
        className={
          "relative aspect-video overflow-hidden rounded-2xl brutal-border bg-black " +
          (className ?? "")
        }
      >
        <div ref={containerRef} className="absolute inset-0 h-full w-full" />
      </div>
    );
  },
);