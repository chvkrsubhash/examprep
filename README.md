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

## Sample CSV

Use [`assets/exam-prep-sample-questions.csv`](assets/exam-prep-sample-questions.csv) as an import template. It contains three practice questions only and is never loaded into the question bank automatically. The Import Questions page also provides a `Download sample CSV` button.

## Deploy To Vercel

This project is deployable as a static site. Import the GitHub repository in Vercel, keep the framework preset as `Other`, and leave the build command and output directory empty. The committed `vercel.json` applies cache and security headers.

No environment variables are required for local question and notes storage. To enable the required sign-in screen, create a Firebase web app and add its values from `.env.example` in Vercel Project Settings > Environment Variables for Production, Preview, and Development:

```text
FIREBASE_API_KEY
FIREBASE_AUTH_DOMAIN
FIREBASE_PROJECT_ID
FIREBASE_STORAGE_BUCKET
FIREBASE_MESSAGING_SENDER_ID
FIREBASE_APP_ID
```

In Firebase Authentication, enable the `Email/Password` provider. Users can then create their own account from the Exam Prep sign-in page, sign in, and receive Firebase password-reset emails from `Forgot password?`. Add the deployed Vercel domain to Firebase Authentication's Authorized domains list. Redeploy after changing any Vercel environment variable.

### Weekly Rough-Work Archive

During a weekly mock, the pencil icon opens a canvas booklet with one writable rough-work page per question. The app saves changed pages in browser storage, so the `Weekly Rough Notes` page remains available after submission. It can also export the full booklet as a PDF, with every question printed above its corresponding canvas page.

To enable the optional private S3 archive, add these Vercel variables and redeploy:

```text
AWS_REGION
AWS_S3_BUCKET
AWS_S3_PREFIX=weekly-rough-work
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
```

The supplied Vercel function writes only `PutObject` requests to the configured bucket and prefix. Use a dedicated IAM identity restricted to that prefix; do not expose AWS credentials in frontend code or commit them to the repository.
