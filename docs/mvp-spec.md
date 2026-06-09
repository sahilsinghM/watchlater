# MVP Specification

## Goal

WatchLater turns one supported YouTube video into a compact interactive lesson. The MVP is successful when a user can paste a supported public English YouTube video, wait for real processing, complete the generated lesson and quiz, ask grounded follow-up questions, and rate the lesson useful.

## Primary Journey

1. Paste URL
   - User lands on the current hero screen from `src/routes/index.tsx`.
   - User pastes a public YouTube URL.
   - Client validates that the URL is a normal YouTube watch or share URL and extracts the video ID.
   - Invalid URLs show an inline error in the current brutal input area.

2. Processing
   - App creates or resumes an anonymous session.
   - App creates a processing job for the video.
   - Backend validates the video policy: public YouTube, English, 5 to 90 minutes, transcript available, not Shorts.
   - Backend fetches metadata and transcript chunks.
   - Backend captures 3 to 5 key screenshots.
   - Backend calls OpenAI to generate a lesson against the schema.
   - UI renders the existing stepped progress card style, but each step maps to persisted job state.

3. Generated lesson hero
   - User sees the current two-column lesson hero from `src/routes/lesson.$videoId.tsx`.
   - Hero includes embedded video, title, channel, duration, "This video in 30 seconds", best part, skip part, Watch Score, score reason, difficulty, and recommendation.
   - Primary CTA starts the 5-minute lesson.
   - Secondary action jumps to the best part in the video.

4. Timeline
   - User sees the current segmented `AttentionTimeline`.
   - Timeline segments classify parts as skip, watch, core, or demo.
   - Clicking a segment seeks the embedded video to that timestamp.
   - Segment list includes title, timestamp range, blurb, and visual kind label.

5. Lesson cards
   - User enters the player route from `src/routes/lesson.$videoId.player.tsx`.
   - User progresses through generated lesson cards.
   - Cards use the existing stacked brutal card treatment from `LessonCardView`.
   - Cards may include concepts, analogies, quotes, insights, recaps, timestamp links, and embedded video at the relevant timestamp.
   - Quick actions capture lightweight usefulness signals per card where practical.

6. Quiz
   - User completes a short quiz generated from the lesson and transcript.
   - Quiz records score, selected answers, correctness, and explanations.
   - Completion route receives the score and displays the mastery card.

7. Completion
   - Completion uses the current mascot-led completion page.
   - User sees mastery percentage, score summary, and the best section to watch for more depth.
   - User can process another video or return to the lesson hero.

8. Tutor and feedback
   - Tutor remains available from lesson surfaces.
   - Tutor answers must be grounded in transcript and generated lesson context.
   - User can rate whether the lesson was useful.
   - Feedback is persisted with lesson ID, anonymous session ID, rating, optional reason, and completion context.

## Supported Inputs

- Public YouTube videos.
- English language.
- Duration between 5 and 90 minutes.
- Transcript available and usable.

## Out Of Scope

- Login and user accounts.
- Non-YouTube sources.
- Non-English videos.
- Shorts.
- Videos shorter than 5 minutes or longer than 90 minutes.
- Full visual transcript extraction.
- Multi-video playlists.
- Sharing, teams, billing, or long-term personal library.
- Synthetic fallback lessons in production MVP.

## Required Failure States

- Invalid URL: URL cannot be parsed as a supported YouTube video URL.
- Shorts: URL or metadata indicates a YouTube Short.
- Private or blocked: video is private, deleted, age-restricted, region-blocked, embedding-blocked, or otherwise unavailable.
- No transcript: no English transcript can be fetched.
- Too long: duration is greater than 90 minutes.
- Too short: duration is less than 5 minutes.
- Non-English: language is not English or cannot be confidently treated as English.
- Generation failure: OpenAI lesson generation fails or output does not validate against schema.
- Screenshot failure: 3 to 5 key frames cannot be captured or stored.
- Persistence failure: Supabase cannot create/update required records.

Each failure state must use the current visual language: centered mascot/error layout, brutal bordered details card where useful, clear title, short plain-language body, and a strong return-to-paste CTA.

## Acceptance Criteria

- A supported video produces a persisted lesson without synthetic fallback content.
- Generated lesson data validates against the lesson schema before display.
- User can navigate paste, processing, hero, timeline, player, quiz, completion, tutor, and feedback without leaving the current visual style.
- Processing progress survives refresh and reflects backend job state.
- Quiz result and usefulness feedback are persisted for the anonymous session.
- Unsupported videos fail with the correct explicit state.
- A new engineer can implement the backend, AI generation, screenshots, feedback, and job-status behavior from these docs without choosing a backend, AI provider, screenshot policy, account policy, or design direction.
