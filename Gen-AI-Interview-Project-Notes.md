# Gen AI Interview — Project Notes

A full-stack app that takes a candidate's resume, self-description, and a job description, and uses Google Gemini to generate a personalized interview prep report: match score, technical and behavioral questions with coaching-style answers, skill gaps, a day-by-day prep roadmap, and a tailored, ATS-friendly resume PDF.

Repo: `https://github.com/JeetKumbhar/Gen-AI-Interview`

---

## 1. Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 8, React Router 7 (data APIs), Sass (Dart Sass, `@use` modules), axios |
| Backend | Node.js, Express, MongoDB + Mongoose, JWT auth (cookie-based) |
| AI | Google Gemini (`@google/genai` SDK) via API key, structured JSON output |
| File handling | Multer (resume upload, in-memory), `pdf-parse` (resume text extraction), Puppeteer (HTML → PDF for the tailored resume) |
| Auth | bcrypt (password hashing), JWT (signed session token in an httpOnly cookie), a Mongo-backed token blacklist for logout |

---

## 2. Architecture at a glance

The Frontend is a client-only React SPA (Vite dev server on `:5173`). It never talks to MongoDB or Gemini directly — every request goes through the Backend Express API (`:3000`), which is the only thing that holds credentials for MongoDB and Gemini. Auth is a signed JWT stored in an httpOnly cookie, so the frontend calls the API with `withCredentials: true` rather than managing tokens in JS.

*(See the diagram above this document for the visual breakdown of containers and data flow.)*

---

## 3. Complete file structure

### Backend (`/Backend`)

```
Backend/
├── server.js                          # Entry point: loads .env, connects DB, starts Express on :3000
├── src/
│   ├── app.js                         # Express app: JSON body parsing, cookies, CORS, mounts routers
│   ├── config/
│   │   └── database.js                # mongoose.connect() using MONGO_URI
│   ├── routes/
│   │   ├── auth.routes.js             # /api/auth/*  (register, login, logout, get-me)
│   │   └── interview.routes.js        # /api/interview/*  (generate, fetch, list, resume PDF)
│   ├── middlewares/
│   │   ├── auth.middleware.js         # Verifies JWT cookie, checks blacklist, sets req.user
│   │   └── file.middleware.js         # Multer config — in-memory storage, 5MB limit
│   ├── controllers/
│   │   ├── auth.controller.js         # register / login / logout / getMe handlers
│   │   └── interview.controller.js    # Orchestrates: parse resume → call AI → save → respond
│   ├── models/
│   │   ├── user.model.js              # username, email, hashed password
│   │   ├── interviewReport.model.js   # Full report schema (questions, skillGaps, prep plan…)
│   │   └── blacklist.model.js         # Logged-out JWTs, so a stolen old cookie can't be reused
│   └── services/
│       └── ai.service.js              # All Gemini calls: report generation + resume HTML generation + Puppeteer PDF render
```

### Frontend (`/Frontend`)

```
Frontend/
├── index.html                         # Vite entry HTML, mounts #root
├── vite.config.js
├── src/
│   ├── main.jsx                       # createRoot().render(<App/>), imports global style.scss
│   ├── App.jsx                        # Wraps the app in AuthProvider → InterviewProvider → RouterProvider
│   ├── app.routes.jsx                 # Route table: /login, /register, / (Home), /interview/:id
│   ├── style.scss                     # Global resets, base colors, font
│   ├── style/
│   │   └── button.scss                # Shared button styles
│   └── features/
│       ├── auth/
│       │   ├── auth.context.jsx       # AuthContext: user, loading
│       │   ├── auth.form.scss
│       │   ├── components/
│       │   │   └── Protected.jsx      # Route guard — redirects to /login if not authenticated
│       │   ├── hooks/
│       │   │   └── useAuth.js         # login/register/logout + auto getMe() on mount
│       │   ├── pages/
│       │   │   ├── Login.jsx
│       │   │   └── Register.jsx
│       │   └── services/
│       │       └── auth.api.js        # axios client for /api/auth/*
│       └── interview/
│           ├── interview.context.jsx  # InterviewContext: loading, report, reports
│           ├── hooks/
│           │   └── useInterview.js    # generateReport, getReportById, getReports, getResumePdf
│           ├── pages/
│           │   ├── Home.jsx           # Upload form: resume file / self-description + job description
│           │   └── Interview.jsx      # Report viewer: technical/behavioral Qs, skill gaps, roadmap
│           ├── services/
│           │   └── interview.api.js   # axios client for /api/interview/*
│           └── style/
│               ├── home.scss
│               └── interview.scss
```

---

## 4. Step-by-step process to build this project

### Backend

1. **Scaffold the server.** `npm init`, install `express`, `mongoose`, `dotenv`, `cookie-parser`, `cors`. Create `server.js` to load env vars, connect to Mongo, and start listening.
2. **Set up MongoDB models first.** Define `user.model.js` (username, email, hashed password) and `interviewReport.model.js` (job description, resume text, matchScore, arrays of technical/behavioral questions, skill gaps, prep plan, linked to a `user`). Modeling the data shape up front makes the AI schema (step 5) straightforward to mirror.
3. **Build auth.** Install `bcrypt` and `jsonwebtoken`. Write register/login (hash password, sign a JWT, set it as an httpOnly cookie) and a `logout` that blacklists the token in Mongo rather than trying to invalidate it client-side. Write `auth.middleware.js` to read the cookie, check the blacklist, verify the JWT, and attach `req.user`.
4. **Add file upload support.** Install `multer`, configure `memoryStorage()` with a size limit — you don't need to write resumes to disk, just get the buffer and parse it in memory.
5. **Integrate Gemini for structured output.** Install `@google/genai` and `zod`. Define a Zod schema matching your report model, and use Zod v4's native `z.toJSONSchema()` (not the third-party `zod-to-json-schema` package — see §6) to convert it. Call `ai.models.generateContent()` with `responseMimeType: "application/json"` and `responseJsonSchema` set to that schema.
6. **Wire the interview controller.** Parse the uploaded PDF with `pdf-parse`, call your AI service, save the result to MongoDB, and return it. Add endpoints to fetch one report, list all of a user's reports, and generate a tailored resume.
7. **Add PDF generation.** Prompt Gemini to return resume content as an HTML string (same structured-output approach), then use Puppeteer (`page.setContent()` + `page.pdf()`) to render that HTML to a PDF buffer and stream it back with the right `Content-Type`/`Content-Disposition` headers.
8. **Lock down CORS.** Since auth is cookie-based, `cors({ origin: "http://localhost:5173", credentials: true })` is required — a wildcard origin won't work with credentialed requests.

### Frontend

1. **Scaffold with Vite.** `npm create vite@latest` (React template), install `react-router-dom`, `axios`, `sass`.
2. **Set up global providers.** Create `AuthContext` and `InterviewContext` (plain `useState`-based, no reducer needed at this scale), and wrap the app: `AuthProvider > InterviewProvider > RouterProvider`.
3. **Define routes.** `createBrowserRouter` with `/login`, `/register`, `/` (Home), `/interview/:interviewId`. Wrap the protected ones in a `<Protected>` component that checks auth state and redirects to `/login` if there's no user.
4. **Build the auth API client and hook.** A small `axios.create({ baseURL, withCredentials: true })` instance, thin wrapper functions per endpoint, and a `useAuth()` hook that exposes `login`/`register`/`logout` plus an effect that calls `getMe()` once on mount to restore the session from the cookie.
5. **Build the Home page.** A resume dropzone (file input) or a self-description textarea, plus a job description textarea, feeding a "Generate" button. Keep every input **controlled** (`value` + `onChange`) — see §6 for why this matters more than it looks.
6. **Build the interview API client and hook**, mirroring the auth one: `generateInterviewReport` (multipart `FormData`, since a file is involved), `getInterviewReportById`, `getAllInterviewReports`, `generateResumePdf` (expects a `blob` response, since it's binary PDF data, not JSON).
7. **Build the Interview (report) page.** Sidebar with match score + skill gaps, a section switcher for Technical Questions / Behavioral Questions / Roadmap, and a "Download Resume" button that calls `getResumePdf` and triggers a browser download via a generated object URL.
8. **Style last.** Get the data flow working with unstyled HTML first, then layer in the dark theme, cards, and layout — much easier to debug a blank-data bug without also fighting CSS.

---

## 5. Complete application flow

**Registration / login**
1. User submits the register or login form → `POST /api/auth/register` or `/login`.
2. Backend hashes/verifies the password, signs a JWT (`{ id: user._id }`, 1-day expiry), and sets it as a cookie on the response.
3. Frontend's `AuthContext` doesn't store the token — it just stores `user`. On every fresh app load, `useAuth`'s mount effect calls `GET /api/auth/get-me`, which the backend resolves from the cookie, so the session survives a refresh without any token juggling in JS.

**Route protection**
4. `<Protected>` reads `{ user, loading }` from `AuthContext`. While `loading` it shows a loading state; once resolved, no `user` → redirect to `/login` via React Router's `<Navigate>` (client-side, no full page reload).

**Generating a report**
5. On `Home`, the user fills in a job description and either uploads a resume PDF or types a self-description, then clicks Generate.
6. Frontend builds a `FormData` (file + text fields) and `POST`s to `/api/interview/`, authenticated via the cookie (`withCredentials: true`).
7. Backend: `auth.middleware` verifies the user → `multer` reads the uploaded file into memory → `pdf-parse` extracts resume text → `ai.service.generateInterviewReport()` builds a prompt and calls Gemini with a Zod-derived JSON schema, forcing back a JSON object matching `matchScore`, `technicalQuestions`, `behavioralQuestions`, `skillGaps`, `preparationPlan`, `title`.
8. The result is saved as a new `interviewReport` document (linked to `req.user.id`) and returned to the frontend.
9. Frontend navigates to `/interview/:id` with the new report's `_id`.

**Viewing a report**
10. `Interview.jsx` reads `:interviewId` from the URL, and `useInterview`'s effect calls `getReportById`, hitting `GET /api/interview/report/:interviewId` (scoped to `req.user.id`, so users can't view each other's reports by guessing IDs).
11. The page renders the match score (color-coded by threshold), skill gap tags, and lets the user switch between Technical Questions, Behavioral Questions, and the day-by-day Roadmap.

**Downloading a tailored resume**
12. "Download Resume" calls `POST /api/interview/resume/pdf/:interviewReportId`.
13. Backend loads the saved report, sends its resume/job description/self-description back through Gemini (a second, separate prompt asking for resume HTML instead of a report), and pipes the returned HTML through Puppeteer to render a PDF buffer.
14. The PDF streams back with `Content-Disposition: attachment`, and the frontend turns the response `blob` into an object URL, creates a temporary `<a download>` link, and clicks it programmatically to trigger the browser's save dialog.

**Viewing report history**
15. The Home page (when no `:interviewId` is present) calls `GET /api/interview/`, which returns a lightweight list of the user's past reports (title, match score, timestamps — the heavy fields like `technicalQuestions` are excluded via `.select("-...")` to keep the list fast).

---

## 6. Key lessons learned while building this

These are real issues hit and fixed during development — worth keeping in mind if you extend this project or build something similar.

- **`zod-to-json-schema` (the npm package) silently breaks on Zod v4.** It's built for Zod v3's internals and returns an essentially empty schema on v4 — no error, just no constraints. Use Zod v4's own native `z.toJSONSchema()` instead; no extra dependency needed.
- **Gemini's structured-output config field depends on your auth method.** With a plain API key (`GoogleGenAI({ apiKey })`), `@google/genai`'s request-building path only recognizes `responseMimeType` + `responseSchema`/`responseJsonSchema` — the newer `responseFormat: { text: { mimeType, schema } }` shape shown in some docs is wired up for the Vertex AI auth path only, and gets silently dropped otherwise.
- **Controlled inputs aren't optional if a component can re-render a different tree.** An `onChange`-only textarea (no `value`) looks fine until the parent conditionally returns a structurally different JSX tree (e.g. a full-screen loading state) — React unmounts and remounts the DOM node, and any unsaved-to-state text is gone. File inputs have the same failure mode but can't be fixed with `value` at all (browser restriction) — the real fix is to not unmount the form in the first place (render loading as an overlay, not a tree swap).
- **Sass's `@use "sass:color";` is per-file, not global.** Every `.scss` file that calls `color.adjust()` needs its own `@use` line at the very top, before any other rule — including before variable declarations.
- **A `catch` block that only logs doesn't stop the error.** Several bugs in this project traced back to a function catching an error, logging it, and then still trying to use a variable that was never assigned because of that error (e.g. `return response.interviewReport` when `response` stayed `null`). A caught error should be handled all the way through — return a safe fallback (`null`, `undefined`) rather than letting the "happy path" code run anyway.
- **A copy-pasted file can silently break an entire SPA.** A frontend "API client" file that accidentally contained backend controller code (`require(...)`, Express `req`/`res`, `module.exports`) caused a completely blank page with no visible error, because it broke the whole import chain from `main.jsx` down. When a page is blank with nothing in the terminal, checking whether the app *builds* (`vite build`) surfaces import-resolution errors that dev mode can sometimes swallow.

---

## 7. API reference

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/register` | Public | Create account, sets session cookie |
| POST | `/api/auth/login` | Public | Verify credentials, sets session cookie |
| GET | `/api/auth/logout` | Public | Blacklists current token, clears cookie |
| GET | `/api/auth/get-me` | Private | Resolve current user from cookie |
| POST | `/api/interview/` | Private | Generate a new interview report (multipart: resume file + text fields) |
| GET | `/api/interview/report/:interviewId` | Private | Fetch one report by id |
| GET | `/api/interview/` | Private | List current user's reports (lightweight) |
| POST | `/api/interview/resume/pdf/:interviewReportId` | Private | Generate and stream a tailored resume PDF |

## 8. Environment variables (Backend `.env`)

| Variable | Purpose |
|---|---|
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret used to sign/verify session JWTs |
| `GOOGLE_GENAI_API_KEY` | Gemini API key for `@google/genai` |
