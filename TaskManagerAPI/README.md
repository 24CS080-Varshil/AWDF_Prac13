# Task Manager API

Express and MongoDB API for the Task Manager application.

## Run

```bash
npm install
Copy-Item .env.example .env
npm start
```

Start a local MongoDB server before running the API. By default, the application connects to `mongodb://127.0.0.1:27017/taskmanager`; change `MONGODB_URI` in `.env` if needed.

Set `JWT_SECRET` in `.env` to a long, random value. The API will not start without it.
Set `GEMINI_API_KEY` to enable AI-generated task descriptions. Keep this key in
the backend `.env` file; it must never be added to the frontend.

The API starts at `http://localhost:3000` after MongoDB connects.

## Endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/tasks` | List tasks |
| `POST` | `/tasks` | Create a task |
| `PUT` | `/tasks/:id` | Update one or more task fields |
| `DELETE` | `/tasks/:id` | Delete a task |
| `GET` | `/tasks/:id` | Get one task |
| `GET` | `/tasks/debug/cache` | Inspect cache hit/miss metrics |
| `POST` | `/ai/task-suggestion` | Generate a description from a task title |

## Authentication

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/auth/register` | Register with an email and password of at least 8 characters |
| `POST` | `/auth/login` | Receive a JWT valid for one hour |
| `GET` | `/auth/me` | Return the user represented by the JWT |

All `/tasks` endpoints require `Authorization: Bearer <token>`. Tasks belong to their creator and are only accessible by that user.

Task data is stored in the local `taskmanager` MongoDB database and persists after an API restart.

The AI suggestion endpoint requires the bearer token and accepts
`{ "title": "Prepare practical file" }` as its JSON body. It returns
`{ "suggestion": "..." }`. AI failures return a clear error without affecting
the regular task endpoints.

## In-memory cache

`node-cache` caches task responses for 60 seconds. Cache keys include the authenticated user's ID, so cached data cannot cross account boundaries:

- `GET /tasks` caches that user's task list.
- `GET /tasks/:id` caches that user's individual task.
- A successful `POST /tasks` invalidates the list cache.
- A successful `PUT` or `DELETE` invalidates both the relevant task and the user's list cache.

The cache is process-local and is cleared whenever the server restarts. It is therefore appropriate for this single-server lab but not for a multi-instance deployment, where a shared cache such as Redis would be needed.

## Docker Compose (Practical 11)

The complete Task Manager application can run as three containers:

- `frontend`: the production React build served by Nginx at `http://localhost:5173`.
- `backend`: the Express API at `http://localhost:3000`.
- `mongodb`: MongoDB 8, with its data persisted in the named `mongodb_data` volume.

The Compose network resolves the database by its service name. Therefore the backend gets
`MONGODB_URI=mongodb://mongodb:27017/taskmanager` inside the container rather than using
`localhost`, which would incorrectly refer to the backend container itself.

### Run the full stack

1. Install and start Docker Desktop.
2. Ensure `TaskManagerAPI/.env` exists. You can copy `.env.example`; set a non-default
   `JWT_SECRET` value.
3. From the repository root, run:

   ```bash
   docker compose up --build
   ```

4. Open `http://localhost:5173`, register or sign in, and create a task.
5. Verify the services and logs:

   ```bash
   docker compose ps
   docker compose logs -f backend
   ```

Stop containers with `docker compose down`. The named MongoDB volume keeps tasks after
containers stop. Use `docker compose down -v` only when you deliberately want to delete
all MongoDB data.

## Event-driven notifications (Practical 10)

Creating a task emits the built-in Node.js `EventEmitter` event `task-created` after the
database write. The listener in `listeners.js` immediately queues a notification with a
two-second `setTimeout`, while the route returns `201 Created` straight away. The server
console therefore shows the API response timestamp before the notification completion
timestamp, demonstrating that the slow side effect is outside the request-response path.

Deleting a task emits `task-deleted` with its own listener. The shared `error` listener
logs failures raised inside the delayed `task-created` notification without crashing the
API process.

To capture the required evidence, start the API, log in, then create a task through the
frontend, Postman, or Thunder Client. Record the `201` response and these console lines:

```text
[Notification] Queued task-created for "Prepare practical file" at <timestamp>
[API] Task creation response sent at <timestamp>
[Notification] Task "Prepare practical file" created at <later timestamp> for assigned user <user-id>
```

### Response-time lab readings

Use the same authenticated request and database state for every sample. Start with an empty cache (restart the API, or wait for its 60-second TTL), record the first `GET /tasks` as uncached, then immediately repeat the request for cached readings. Fill this table from Postman or Thunder Client's **Time** field; real timings depend on the local machine and dataset.

| Condition | Sample 1 | Sample 2 | Sample 3 |
| --- | ---: | ---: | ---: |
| Uncached (`GET /tasks` after cache expiry) | _recorded in client_ | _recorded in client_ | _recorded in client_ |
| Cached (repeat `GET /tasks` within 60 seconds) | _recorded in client_ | _recorded in client_ | _recorded in client_ |

Call `GET /tasks/debug/cache` with the same bearer token to confirm hits and misses while measuring.
