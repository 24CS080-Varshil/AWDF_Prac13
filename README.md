[![CI Pipeline](https://github.com/24CS080-Varshil/AWDF_Prac12/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/24CS080-Varshil/AWDF_Prac12/actions/workflows/ci.yml)

# Task Manager

Task Manager is a full-stack task-tracking application built with React, Vite,
Express, MongoDB, and JWT authentication. Users can create an account, sign in,
and manage their own tasks through the browser.

## Features

- Register and sign in with email and password
- JWT-based authentication with one-hour tokens
- Create, view, update, and delete personal tasks
- Task completion tracking and a projects overview
- Contact and getting-started information pages
- Lazy-loaded Projects and Contact routes
- User-scoped in-memory task caching
- AI-generated task descriptions from task titles
- Event-driven notifications for task creation and deletion
- Local development and Docker Compose workflows

## Repository layout

```text
.
├── TaskManager-frontend/   # React and Vite client
├── TaskManagerAPI/         # Express and MongoDB API
├── docker-compose.yml      # Frontend, API, and MongoDB services
└── .github/workflows/      # Continuous integration workflow
```

See the component documentation for implementation details:

- [Frontend README](./TaskManager-frontend/README.md)
- [API README](./TaskManagerAPI/README.md)

## Requirements

- Node.js 20 or later
- npm
- MongoDB 7 or later for local API development, or Docker Desktop for the full
  containerized stack

## Run locally

### 1. Configure and start the API

Open a terminal in `TaskManagerAPI` and create a local environment file:

```powershell
cd TaskManagerAPI
Copy-Item .env.example .env
```

Edit `.env` and replace `JWT_SECRET` with a long, random value. The default
configuration expects MongoDB at `mongodb://127.0.0.1:27017/taskmanager`.
To enable AI task descriptions, also set `GEMINI_API_KEY` in this file. The key
is read only by the API and is never sent to the frontend.

Then install dependencies and start the API:

```powershell
npm install
npm start
```

The API listens on [http://localhost:3000](http://localhost:3000).

For automatic restarts during development, use:

```powershell
npm run dev
```

### 2. Start the frontend

In a second terminal:

```powershell
cd TaskManager-frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The Vite client is
configured to call the API at `http://localhost:3000`.

## Run with Docker Compose

Docker Compose starts the frontend, API, and MongoDB together:

```powershell
docker compose up --build
```

Open [http://localhost:5173](http://localhost:5173) after the services start.
The API is also exposed at [http://localhost:3000](http://localhost:3000).

Useful commands:

```powershell
docker compose ps
docker compose logs -f backend
docker compose down
```

MongoDB data is stored in the named `mongodb_data` volume and survives
`docker compose down`. To deliberately remove the database volume as well:

```powershell
docker compose down -v
```

The Compose backend reads `TaskManagerAPI/.env`; ensure that file exists and
contains a non-default `JWT_SECRET` before starting the stack.

## API overview

All `/tasks` routes require an `Authorization: Bearer <token>` header. Tasks
are scoped to the authenticated user.

### Authentication

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/auth/register` | Create an account |
| `POST` | `/auth/login` | Sign in and receive a JWT |
| `GET` | `/auth/me` | Return the current authenticated user |

### Tasks

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/tasks` | List the current user's tasks |
| `POST` | `/tasks` | Create a task |
| `GET` | `/tasks/:id` | Get one task |
| `PUT` | `/tasks/:id` | Update a task |
| `DELETE` | `/tasks/:id` | Delete a task |
| `GET` | `/tasks/debug/cache` | Inspect cache hit/miss statistics |
| `POST` | `/ai/task-suggestion` | Generate a task description from its title |

Example registration request:

```json
{
  "email": "user@example.com",
  "password": "at-least-8-characters"
}
```

## Testing and quality checks

Run the API test suite:

```powershell
cd TaskManagerAPI
npm test
```

Run frontend linting and create a production build:

```powershell
cd TaskManager-frontend
npm run lint
npm run build
```

The GitHub Actions workflow runs the API tests on pushes to the `main` branch.

## Implementation notes

- Passwords are hashed with `bcryptjs`; plaintext passwords are never stored.
- JWTs are signed with `JWT_SECRET` and expire after one hour.
- Task responses are cached per authenticated user for 60 seconds.
- Task mutations invalidate the affected user and task cache entries.
- Creating and deleting tasks emit application events for asynchronous
  notification handling.
- The frontend stores the login token in browser local storage and clears it
  when the API reports an expired session.
- The authenticated `POST /ai/task-suggestion` endpoint calls Gemini on the
  backend with a ten-second timeout. The React task form displays the returned
  description and copies it into the editable description field. If Gemini is
  unavailable or not configured, the API returns an explanatory error and
  normal task creation remains available.

## Security

Do not commit `.env` files, real JWT secrets, or production credentials. Use
`.env.example` only as a template and generate a unique secret for each
environment.
