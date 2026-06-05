# PRD: VideoSense MVP

Status: ready-for-agent

## Problem Statement

People open long YouTube videos because they want to understand something, but they do not know whether the video is worth their time until they have already spent that time. Existing summaries often flatten the content, hide the evidence, or produce confident-looking output that is not grounded in the source.

The user needs a fast, trustworthy way to understand what a video says, what matters, which parts deserve attention, and whether the full video is worth watching. If the video is mostly fluff, repetitive, unsupported, or low-value, the product should say that plainly. If the video is useful, the product should compress it into a short lesson and point the user to the sections worth watching deeply.

## Solution

VideoSense turns a supported public English YouTube video into a grounded interactive lesson. The user pastes a URL, waits while the system validates and processes the video, then receives a lesson hero with a Watch Score, verdict, best section, skip section, timeline, lesson cards, quiz, completion state, tutor, and usefulness feedback.

The product promise is: understand the video fast enough to decide what is worth watching deeply.

The MVP must prioritize trust over speed when they conflict. It should fail clearly for unsupported videos instead of inventing lessons, validate generated output before display, and ground major claims in transcript timestamps and visual context where available. The current Tactile Field Guide design direction remains locked: cream background, heavy black borders, hard offset shadows, playful mascot, bold display typography, compact brutal cards, and blue/yellow/green accents.

## User Stories

1. As a busy learner, I want to paste a YouTube URL, so that I can quickly start understanding a video.
2. As a busy learner, I want the app to reject invalid URLs immediately, so that I do not wait on a video that cannot be processed.
3. As a busy learner, I want the app to reject YouTube Shorts, so that the product stays focused on long-form videos.
4. As a busy learner, I want the app to clearly reject private or blocked videos, so that I know the failure is not my fault.
5. As a busy learner, I want the app to reject videos without English transcripts, so that I am not shown a fake lesson.
6. As a busy learner, I want the app to reject videos shorter than 5 minutes or longer than 90 minutes, so that the lesson format stays reliable.
7. As a busy learner, I want processing progress to reflect real backend work, so that I can trust what the app says is happening.
8. As a busy learner, I want processing to survive refresh, so that I do not lose work if I reload the page.
9. As a busy learner, I want to see the video title, channel, and duration, so that I can confirm the app processed the right video.
10. As a busy learner, I want a short explanation of what the video is really about, so that I can orient myself before starting the lesson.
11. As a busy learner, I want a Watch Score, so that I can quickly judge whether the video deserves more attention.
12. As a busy learner, I want the Watch Score to include a reason, so that I do not have to trust a naked number.
13. As a busy learner, I want a clear verdict such as skip, lesson only, watch core section, or watch full video, so that I can decide what to do next.
14. As a busy learner, I want the app to be honest when a video is low-value, so that I do not waste time on weak content.
15. As a busy learner, I want the best section identified with timestamps, so that I can jump straight to the most useful part.
16. As a busy learner, I want the skip section identified with timestamps, so that I can avoid setup, repetition, or filler.
17. As a busy learner, I want the recommendation to be grounded in source evidence, so that I know why the app reached its verdict.
18. As a busy learner, I want a timeline of the video, so that I can see how the video is structured.
19. As a busy learner, I want timeline segments labeled as skip, watch, core, or demo, so that I can scan the video quickly.
20. As a busy learner, I want to click a timeline segment, so that I can jump the video to that section.
21. As a busy learner, I want the lesson to be fixed-length and predictable, so that I know it will fit into a short break.
22. As a busy learner, I want six focused lesson cards, so that the lesson gives me the main comprehension path without becoming another long video.
23. As a busy learner, I want the cards to cover thesis, concept, mechanism, example or analogy, nuance, and recap, so that I understand the argument rather than memorizing fragments.
24. As a busy learner, I want cards to include timestamps where relevant, so that I can verify claims against the original video.
25. As a busy learner, I want cards to include quotes only when they are actually useful, so that quote cards do not become decorative filler.
26. As a busy learner, I want visual frames tied to important moments when useful, so that visually dependent ideas are easier to understand.
27. As a busy learner, I want the app to say when visual context is unavailable or incomplete, so that I understand the limits of the lesson.
28. As a busy learner, I want a short quiz after the lesson, so that I can check whether I understood the video.
29. As a busy learner, I want the quiz to test the main idea, supporting evidence, and one application question, so that it measures comprehension instead of trivia.
30. As a busy learner, I want quiz explanations to include timestamp grounding, so that I can see where the answer came from.
31. As a busy learner, I want a completion page, so that I know I finished the lesson.
32. As a busy learner, I want my quiz result recorded, so that the product can understand whether the lesson helped.
33. As a busy learner, I want to rate whether the lesson was useful, so that I can give quick feedback.
34. As a busy learner, I want to leave an optional reason with my rating, so that I can explain what worked or failed.
35. As a busy learner, I want to ask a tutor follow-up questions about the video, so that I can clarify confusing parts.
36. As a busy learner, I want the tutor to answer only from the video context, so that it does not drift into generic chatbot behavior.
37. As a busy learner, I want the tutor to refuse unsupported questions, so that I can trust its boundaries.
38. As a busy learner, I want the tutor to help me decide whether to watch the full video, so that I can make an informed attention decision.
39. As a busy learner, I want the same visual style across all states, so that the app feels coherent and polished.
40. As a busy learner, I want failure states to be clear and friendly, so that I know whether to retry or choose another video.
41. As a product owner, I want every completed lesson connected to an anonymous session, so that success can be measured without requiring accounts.
42. As a product owner, I want feedback connected to the lesson and session, so that I can identify which generated lessons are useful.
43. As a product owner, I want low Watch Scores to be possible and meaningful, so that the score remains trustworthy.
44. As a product owner, I want generated lessons stored with model and schema metadata, so that poor outputs can be audited.
45. As a product owner, I want unsupported inputs tracked separately from low-quality videos, so that product analytics are not misleading.
46. As an implementer, I want strict schema validation, so that invalid generated lessons never reach the UI.
47. As an implementer, I want bounded retries for generation repair, so that generation failures are handled predictably.
48. As an implementer, I want transcript quality checks before generation, so that noisy captions do not produce bad lessons.
49. As an implementer, I want screenshot capture to be stored and linked to key moments, so that visual context can be reused and audited.
50. As an implementer, I want route rendering to use the existing visual components, so that MVP backend work does not cause design drift.

## Implementation Decisions

- The MVP promise is fast, grounded understanding that helps users decide what is worth watching deeply.
- The MVP scope is the full product journey, not a one-video demo.
- Supported videos are public English YouTube videos from 5 to 90 minutes with an available transcript.
- Unsupported cases include invalid URL, Shorts, private or blocked video, no transcript, too short, too long, non-English, generation failure, screenshot failure when screenshots are essential, and persistence failure.
- The backend is Supabase.
- The AI provider is OpenAI only.
- Accounts and login are out of scope. The MVP uses anonymous sessions.
- Generated lessons must be persisted and connected to video records, transcript chunks, screenshots, quiz results, and feedback.
- The current in-memory lesson cache is prototype-only and must be replaced by persistence.
- Synthetic fallback lessons are not allowed in production MVP.
- The public sample shortcut should be removed or hidden behind an explicit development-only path.
- Processing status must be based on persisted backend job state, not only local timers.
- The lesson is fixed-length for MVP: six cards plus a short quiz.
- The default card roles are thesis, key concept, mechanism, example or analogy, important nuance, and recap.
- The quiz has three questions: main idea, source-support/detail, and application.
- Every major generated claim should have timestamp grounding in the data.
- The recommendation verdict should use explicit outcome categories: skip it, do the lesson only, watch the core section, or watch the full video.
- Watch Score remains part of the hero and must include a grounded reason.
- Low Watch Scores must be possible and meaningful.
- The product should be blunt about low-value videos without becoming snarky or insulting.
- Screenshot capture is minimal: 3 to 5 key frames per video, tied to cards or key moments.
- Screenshot failure should be handled according to trust: continue with a degraded visual-context state when transcript is enough, but fail or mark low confidence when visuals are essential.
- Transcript quality must be validated before generation using language, cue density, duration coverage, repeated-caption noise, and text volume.
- OpenAI output must validate against a strict versioned lesson schema before display.
- Invalid generated output may be retried or repaired within a bounded policy, then must fail clearly.
- The tutor is source-grounded and should refuse unsupported answers.
- The tutor may advise whether to watch the full video, but only from transcript, lesson, and visual context.
- The current Tactile Field Guide design is locked and must be preserved exactly.
- New states must reuse the current fonts, cream background, heavy borders, hard shadows, mascot identity, compact cards, rounded controls, and blue/yellow/green accents.
- The product must not drift into a generic SaaS dashboard, minimal gray interface, purple gradient/orb aesthetic, or mascot-free brand.

## Testing Decisions

- Tests should verify external behavior and user-visible outcomes rather than implementation details.
- The highest-value seam is the paste-to-completion journey: valid video creates a job, produces a validated lesson, renders the hero, supports card progression, records quiz result, and captures feedback.
- The next seam is processing failure mapping: each unsupported input or backend failure maps to the correct user-visible failure state.
- The generation seam should test schema validation, bounded retry/repair behavior, and rejection of invalid OpenAI output.
- The transcript seam should test support validation, language detection, duration policy, cue quality, and no-transcript behavior.
- The persistence seam should test anonymous session creation, job lifecycle updates, lesson storage, quiz result storage, and feedback storage.
- The tutor seam should test grounded answers, timestamp-backed explanations, and refusal for unsupported questions.
- The visual seam should use route-level screenshot or snapshot checks on landing, processing, lesson hero, player, quiz, completion, tutor, and failure states to catch design drift.
- URL parsing tests should cover normal watch URLs, share URLs, invalid URLs, Shorts URLs, missing IDs, and malformed IDs.
- Watch verdict tests should verify low-value videos can produce low scores and explicit skip or lesson-only recommendations.
- Quiz tests should verify main idea, support/detail, and application question types, including persisted answers and explanations.
- Degraded visual-context tests should verify that screenshot failure does not silently invent visual evidence.
- Build verification should remain part of acceptance because this project is currently frontend-heavy and route rendering can break quickly.

## Out of Scope

- User accounts, login, teams, billing, and saved personal libraries.
- Non-YouTube sources.
- Non-English videos.
- YouTube Shorts.
- Videos shorter than 5 minutes or longer than 90 minutes.
- Playlists and multi-video synthesis.
- Full visual transcript extraction.
- A general-purpose chatbot unrelated to the source video.
- Synthetic production lessons.
- A redesign away from the current Tactile Field Guide visual style.
- Long-form course generation.
- Creator-facing analytics.

## Further Notes

- The current prototype already has the major visual surfaces in place: landing, processing, lesson hero, timeline, player, quiz, completion, tutor, and core components.
- The main MVP work is replacing prototype behavior with persisted, grounded processing while preserving the current visual system.
- Trust is the dominant product constraint. When the system lacks sufficient source data, it should fail, degrade visibly, or state uncertainty instead of inventing.
- MVP success is a completed generated lesson with usefulness feedback. Quiz performance is important supporting evidence, but not the only product success measure.
- The PRD is published to GitHub as issue #1 in `sahilsinghM/watchlater`. The local markdown copy remains as a workspace artifact.
