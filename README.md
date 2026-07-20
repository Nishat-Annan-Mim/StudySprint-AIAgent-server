# StudySprint API ⚙️ — Backend Server Engine

This is the backend server engine for StudySprint, built using **Express 5** and **TypeScript**. It serves RESTful APIs, handles database orchestrations with **Mongoose 9** (MongoDB Atlas), administers secure session state via **Better Auth**, and manages AI operations via **OpenRouter** LLMs.

---

## 🏗️ Architectural Flow

1. **Environment Initialization:** Environment variables are loaded immediately at the top of the entrypoint `src/index.ts` to ensure that API keys are initialized prior to ES module imports.
2. **Database Connection:** Establishes connection to MongoDB Atlas.
3. **Database Seeding:** Automatically check if the courses collection has data. If not, populates the database with default creators, students, courses, reviews, and links the credential records to the Better Auth `accounts` collection.
4. **App Initialization:** Starts the Express 5 server listening on port `5000`.

---

## 🤖 AI Service Implementations

AI operations are structured under `server/src/routes/ai.ts` and managed via the core `aiService.ts` driver:

### 1. Title & Syllabus Outline Copilot (`POST /api/ai/generate-content`)
* Takes basic prompts and returns JSON structured strings specifying:
  - `shortDescription`: A 1-2 sentence high-impact summary.
  - `fullDescription`: A marketing pitch.
  - `tags`: Auto-suggested relevant categories.
  - `syllabus`: Structured array list containing modules and contents.

### 2. Tailored Study Recommendations (`GET /api/ai/recommendations`)
* Extracts student's targets and enrolled courses (populated with category details).
* Filters out courses dismissed within the last 30 days.
* Boosts categories clicked within the last 30 days.
* Pipes this data into the OpenRouter engine to return a highly tailored, prioritized list of courses.

### 3. Agentic Chat Advisor (`POST /api/ai/chat`)
* Opens a streaming connection supporting partial completion chunks.
* Supports active database queries inside chat prompts via tool resolution callbacks.

---

## 📁 Database Schema Models

The server manages 6 primary schemas located under `src/models/`:

* **`User`** (`User.ts`): Stores user credentials, bio profiles, theme color, and targeted learning goals. Features a pre-save hook to auto-assign a profile background color based on email.
* **`Course`** (`Course.ts`): Stores listings including titles, prices, syllabus structures, creator links, and ratings.
* **`Enrollment`** (`Enrollment.ts`): Links student and course IDs together with dynamic progress tracking.
* **`Review`** (`Review.ts`): Stores ratings and user-submitted feedback remarks.
* **`ChatSession`** (`ChatSession.ts`): Saves AI tutor conversation histories.
* **`RecommendationLog`** (`RecommendationLog.ts`): Logs course recommendations, click boosts, and dismiss states.

---

## 🛠️ API Routing Registry

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| **GET** | `/api/landing/stats` | Fetches homepage metric summaries. |
| **GET** | `/api/landing/featured-courses` | Fetches highly rated featured courses. |
| **GET** | `/api/landing/categories` | Returns category metadata and listings count. |
| **GET** | `/api/courses` | Lists all published courses. |
| **POST** | `/api/courses` | Creates a new course listing (Creators only). |
| **GET** | `/api/courses/:id` | Detailed course listing query. |
| **POST** | `/api/courses/:id/enroll` | Enrolls current student in a course. |
| **POST** | `/api/courses/:id/reviews` | Adds user feedback and updates rating averages. |
| **GET** | `/api/enrollments` | Queries course enrollments for the current student. |
| **PATCH** | `/api/enrollments/:id/progress` | Updates course progress percentage. |
| **GET** | `/api/enrollments/check` | Evaluates if a student is already enrolled. |
| **GET** | `/api/dashboard` | Queries statistics, graphs, and recommendations. |
| **GET** | `/api/profile` | Returns profile fields. |
| **PUT** | `/api/profile` | Updates profile details. |
| **POST** | `/api/ai/generate-content` | AI Outline Generator. |
| **GET** | `/api/ai/recommendations` | Smart AI course recommendation engine. |
| **ALL** | `/api/auth/{*path}` | Mounts the Better Auth Node API handler. |

---

## 🔑 Default Seed accounts (password: `password123`)

* **Student Account:** `emma@student.studysprint.com`
* **Student Account:** `john.doe@student.studysprint.com`
* **Creator Account:** `sarah.jenkins@studysprint.edu`
* **Creator Account:** `alex.design@studysprint.io`
* **Creator Account:** `sophia.lang@studysprint.org`

---

## 🚀 Deployed Environment Configurations (Singapore Location)

To host the backend server engine on platforms like **Render**:

1. **Language/Environment:** `Node`
2. **Root Directory:** `server`
3. **Build Command:** `npm install && npm run build`
4. **Start Command:** `node dist/index.js`
5. **Required Env Variables:**
   * `MONGO_URI`
   * `BETTER_AUTH_SECRET`
   * `BETTER_AUTH_BASE_URL` (Deploved server address e.g. `https://your-backend.onrender.com`)
   * `CLIENT_URL` (Deployed frontend address e.g. `https://your-app.vercel.app`)
   * `OPENROUTER_API_KEY`
