import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { BrowserRouter, NavLink, Route, Routes } from "react-router-dom";
import "./App.css";

const API_BASE_URL = "http://localhost:3000";
const TOKEN_KEY = "task-manager-token";
const ProjectsPage = lazy(() => import("./pages/ProjectsPage"));
const ContactPage = lazy(() => import("./pages/ContactPage"));

function PageFallback() {
    return <div className="page-fallback" role="status">Loading page…</div>;
}

function App() {
    const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || "");
    const [user, setUser] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [mode, setMode] = useState("login");
    const [loading, setLoading] = useState(Boolean(token));
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [aiSuggestion, setAiSuggestion] = useState("");
    const [aiLoading, setAiLoading] = useState(false);

    const logout = useCallback((notice = "") => {
        localStorage.removeItem(TOKEN_KEY);
        setToken("");
        setUser(null);
        setTasks([]);
        setTitle("");
        setDescription("");
        setError(notice);
        setMessage("");
        setAiSuggestion("");
    }, []);

    const authenticatedFetch = useCallback(async (path, options = {}) => {
        const response = await fetch(`${API_BASE_URL}${path}`, {
            ...options,
            headers: {
                ...options.headers,
                Authorization: `Bearer ${token}`
            }
        });

        if (response.status === 401) {
            logout("Your session has expired. Please sign in again.");
            throw new Error("Session expired");
        }

        return response;
    }, [logout, token]);

    useEffect(() => {
        if (!token) {
            return undefined;
        }

        const controller = new AbortController();

        async function loadAccount() {
            try {
                const profileResponse = await authenticatedFetch("/auth/me", {
                    signal: controller.signal
                });

                if (!profileResponse.ok) {
                    throw new Error("Unable to load your account");
                }

                const profile = await profileResponse.json();
                const tasksResponse = await authenticatedFetch("/tasks", {
                    signal: controller.signal
                });

                if (!tasksResponse.ok) {
                    throw new Error("Unable to load tasks");
                }

                const taskList = await tasksResponse.json();
                setUser(profile.user);
                setTasks(taskList);
            } catch (requestError) {
                if (requestError.name !== "AbortError" && requestError.message !== "Session expired") {
                    setError(requestError.message);
                }
            } finally {
                setLoading(false);
            }
        }

        loadAccount();
        return () => controller.abort();
    }, [token, authenticatedFetch]);

    const submitAuthentication = async (event) => {
        event.preventDefault();
        setError("");
        setMessage("");

        try {
            const response = await fetch(`${API_BASE_URL}/auth/${mode}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password })
            });
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || "Authentication failed");
            }

            if (mode === "register") {
                setMode("login");
                setPassword("");
                setMessage("Registration successful. Please sign in.");
                return;
            }

            localStorage.setItem(TOKEN_KEY, data.token);
            setToken(data.token);
            setUser(data.user);
            setPassword("");
        } catch (requestError) {
            setError(requestError.message);
        }
    };

    const addTask = async (event) => {
        event.preventDefault();

        if (!title.trim()) {
            setError("Task title is required");
            return;
        }

        try {
            setLoading(true);
            setError("");
            const response = await authenticatedFetch("/tasks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title, description, completed: false })
            });
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || "Failed to create task");
            }

            setTasks((currentTasks) => [data.task, ...currentTasks]);
            setTitle("");
            setDescription("");
            setMessage("Task created successfully");
        } catch (requestError) {
            if (requestError.message !== "Session expired") {
                setError(requestError.message);
            }
        } finally {
            setLoading(false);
        }
    };

    const generateTaskDescription = async () => {
        if (!title.trim()) {
            setError("Enter a task title before generating a description");
            return;
        }

        try {
            setAiLoading(true);
            setError("");
            setMessage("");
            const response = await authenticatedFetch("/ai/task-suggestion", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title })
            });
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || "Unable to generate an AI suggestion");
            }

            setAiSuggestion(data.suggestion);
            setDescription(data.suggestion);
        } catch (requestError) {
            if (requestError.message !== "Session expired") {
                setError(requestError.message);
            }
        } finally {
            setAiLoading(false);
        }
    };

    const deleteTask = async (id) => {
        if (!window.confirm("Are you sure you want to delete this task?")) {
            return;
        }

        try {
            setLoading(true);
            setError("");
            const response = await authenticatedFetch(`/tasks/${id}`, { method: "DELETE" });
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || "Failed to delete task");
            }

            setTasks((currentTasks) => currentTasks.filter((task) => task.id !== id));
            setMessage("Task deleted successfully");
        } catch (requestError) {
            if (requestError.message !== "Session expired") {
                setError(requestError.message);
            }
        } finally {
            setLoading(false);
        }
    };

    const updateTask = async (task) => {
        const newTitle = window.prompt("Enter new task title:", task.title);

        if (!newTitle || !newTitle.trim()) {
            return;
        }

        const newDescription = window.prompt("Enter new description:", task.description || "");
        const completed = task.completed || window.confirm(
            "Mark this task as completed?\nSelect Cancel to keep it pending."
        );

        try {
            setLoading(true);
            setError("");
            const response = await authenticatedFetch(`/tasks/${task.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: newTitle,
                    description: newDescription || "",
                    completed
                })
            });
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || "Failed to update task");
            }

            setTasks((currentTasks) => currentTasks.map((item) =>
                item.id === task.id ? data.task : item
            ));
            setMessage("Task updated successfully");
        } catch (requestError) {
            if (requestError.message !== "Session expired") {
                setError(requestError.message);
            }
        } finally {
            setLoading(false);
        }
    };

    if (!token) {
        return (
            <main className="container auth-container">
                <h1>Task Manager</h1>
                <h2>{mode === "login" ? "Sign in" : "Create account"}</h2>
                <form onSubmit={submitAuthentication}>
                    <input
                        type="email"
                        placeholder="Email address"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        autoComplete="email"
                        required
                    />
                    <input
                        type="password"
                        placeholder="Password (at least 8 characters)"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        autoComplete={mode === "login" ? "current-password" : "new-password"}
                        minLength="8"
                        required
                    />
                    <button type="submit">{mode === "login" ? "Sign in" : "Register"}</button>
                </form>
                {error && <p className="error">{error}</p>}
                {message && <p className="success">{message}</p>}
                <button
                    type="button"
                    className="link-button"
                    onClick={() => {
                        setMode(mode === "login" ? "register" : "login");
                        setError("");
                        setMessage("");
                    }}
                >
                    {mode === "login" ? "Need an account? Register" : "Already have an account? Sign in"}
                </button>
            </main>
        );
    }

    return (
        <BrowserRouter>
        <main className="container app-container">
            <header className="page-header">
                <div>
                    <h1>Task Manager</h1>
                    {user && <p className="user-email">Signed in as {user.email}</p>}
                </div>
                <button type="button" className="logout-button" onClick={() => logout()}>
                    Log out
                </button>
            </header>

            <nav className="main-nav" aria-label="Main navigation">
                <NavLink to="/" end>Tasks</NavLink>
                <NavLink to="/projects">Projects</NavLink>
                <NavLink to="/contact">Contact</NavLink>
            </nav>

            <Routes>
                <Route path="/" element={<>

            <form onSubmit={addTask}>
                <input
                    type="text"
                    placeholder="Task title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    required
                />
                <input
                    type="text"
                    placeholder="Task description"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                />
                <div className="task-actions">
                    <button type="button" onClick={generateTaskDescription} disabled={loading || aiLoading}>
                        {aiLoading ? "Generating…" : "Generate with AI"}
                    </button>
                    <button type="submit" disabled={loading || aiLoading}>Add task</button>
                </div>
            </form>
            {aiSuggestion && (
                <aside className="ai-suggestion" aria-live="polite">
                    <strong>AI-generated description</strong>
                    <p>{aiSuggestion}</p>
                </aside>
            )}

            <h2>Tasks</h2>
            {loading && <p>Loading…</p>}
            {error && <p className="error">{error}</p>}
            {message && <p className="success">{message}</p>}
            {!loading && tasks.length === 0 && <p>No tasks yet. Add your first one above.</p>}

            {tasks.map((task) => (
                <article className="task" key={task.id}>
                    <h3>{task.title}</h3>
                    {task.description && <p>{task.description}</p>}
                    <p>Status: {task.completed ? "Completed" : "Pending"}</p>
                    <button type="button" onClick={() => updateTask(task)}>Update</button>
                    <button type="button" onClick={() => deleteTask(task.id)}>Delete</button>
                </article>
            ))}
                </>} />
                <Route path="/projects" element={<Suspense fallback={<PageFallback />}><ProjectsPage tasks={tasks} /></Suspense>} />
                <Route path="/contact" element={<Suspense fallback={<PageFallback />}><ContactPage /></Suspense>} />
                <Route path="*" element={<PageFallback />} />
            </Routes>
        </main>
        </BrowserRouter>
    );
}

export default App;
