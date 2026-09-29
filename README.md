# Exam Prep MVP

Exam Prep is a personal APPSC mock-test workspace built around a reusable question bank. This dependency-free MVP uses browser local storage so the core flows can be tried immediately; it is deliberately shaped for a later Firebase adapter.

## Current MVP

- Dashboard with study-cycle progress and capture targets.
- Manual question creation and searchable/filterable question bank.
- Review-first image, PDF, and CSV import staging flow.
- Randomized daily paper preview with browser print / Save as PDF.
- Online weekly exam surface with timer, palette, mark-for-review, clear response, submission review, and result analysis.
- Mistake and performance views based on question-attempt metadata.

## Project Structure

```text
index.html       App shell
styles.css       Responsive academic UI and print rules
app.js           Views, local persistence, paper selection, exam state
assets/          Product visual assets
serve.mjs        Zero-dependency local development server
```

## Firebase Transition

Replace the `questions` local-storage read/write in `app.js` with a repository interface. The view layer should consume repository methods such as `listQuestions`, `createQuestion`, `createMock`, and `saveAttempt`, keeping Firebase-specific calls outside page code.

Suggested Firestore collections:

```text
users/{uid}
questions/{questionId}                 ownerId, subject, topic, difficulty, options, answer, source, createdAt
dailyMocks/{mockId}                    ownerId, questionIds, configuration, generatedAt
weeklyMocks/{mockId}                   ownerId, questionIds, configuration, generatedAt
attempts/{attemptId}                   ownerId, mockId, answers, markedForReviewIds, submittedAt, score
mistakes/{uid_questionId}              ownerId, questionId, wrongCount, lastWrongAt
subjects/{subjectId}
topics/{topicId}
studySessions/{sessionId}
```

Each document should include `ownerId`. Firestore rules should require `request.auth != null` and `request.auth.uid == resource.data.ownerId` for reads and writes, with a separate creation check against `request.resource.data.ownerId`.

## Quiz Algorithm

1. Filter questions by requested subject, topic, difficulty, and attempt status.
2. Shuffle each eligible subject pool and select the requested count without replacement.
3. Combine selected question IDs, shuffle final order, and persist IDs in the generated mock.
4. Shuffle options only where the correct-answer index is updated in the immutable attempt snapshot.
5. On submit, persist answer IDs, calculate totals and section/topic analysis, then update the mistake bank for incorrect answers.

## PDF Flow

The MVP uses the browser print surface so it is immediately usable as a printable daily paper. The production adapter should generate a `dailyMock` record first, resolve its stored question IDs, and use a server-side renderer such as `@react-pdf/renderer` to create the paper, answer key, and solutions as separate files.

## Run Locally

```powershell
node serve.mjs
```

Open `http://localhost:4173`.

## Deploy To Vercel

This project is deployable as a static site. Import the GitHub repository in Vercel, keep the framework preset as `Other`, and leave the build command and output directory empty. The committed `vercel.json` applies cache and security headers.

No environment variables are required for the current MVP because data stays in the visitor's browser. The planned Firebase variables are listed, commented out, in `.env.example`; add real values only after Firebase integration, using Vercel Project Settings > Environment Variables for Production, Preview, and Development. Redeploy after changing any Vercel environment variable.
