import { queryOptions } from "@tanstack/react-query";
import { getLessonByYoutubeId } from "./ingest.functions";

export const lessonQueryOptions = (youtubeId: string) =>
  queryOptions({
    queryKey: ["lesson", youtubeId],
    queryFn: () => getLessonByYoutubeId({ data: { youtubeId } }),
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    retry: false,
  });