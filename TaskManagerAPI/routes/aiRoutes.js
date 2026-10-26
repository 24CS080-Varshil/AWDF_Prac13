const express = require("express");
const authenticate = require("../middleware/auth");

const router = express.Router();
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-flash-lite-latest";
const GEMINI_TIMEOUT_MS = 30000;

router.use(authenticate);

router.post("/task-suggestion", async (req, res) => {
    const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";

    if (!title) {
        return res.status(400).json({ message: "A task title is required" });
    }

    if (!process.env.GEMINI_API_KEY) {
        return res.status(503).json({
            message: "AI suggestions are not configured. Add GEMINI_API_KEY to the API environment."
        });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

    try {
        const response = await fetch(
            "https://generativelanguage.googleapis.com/v1beta/interactions",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-goog-api-key": process.env.GEMINI_API_KEY
                },
                body: JSON.stringify({
                    model: GEMINI_MODEL,
                    input: [
                        "Create a concise, actionable task description for a task manager.",
                        `Task title: ${title}`,
                        "Return only the description, in one or two sentences. Do not use markdown."
                    ].join("\n")
                }),
                signal: controller.signal
            }
        );

        const data = await response.json();
        if (!response.ok) {
            console.error("Gemini request failed:", data.error?.message || response.statusText);
            return res.status(502).json({
                message: "The AI service is temporarily unavailable. You can still create tasks normally."
            });
        }

        const suggestion = data.steps
            ?.find((step) => step.type === "model_output")
            ?.content
            ?.filter((part) => part.type === "text")
            ?.map((part) => part.text)
            ?.join("")
            ?.trim();
        if (!suggestion) {
            console.error("Gemini returned no task suggestion");
            return res.status(502).json({
                message: "The AI did not return a suggestion. You can still enter a description manually."
            });
        }

        return res.status(200).json({ suggestion });
    } catch (error) {
        const message = error.name === "AbortError"
            ? "The AI request timed out. You can still enter a description manually."
            : "The AI service could not be reached. You can still enter a description manually.";
        console.error("AI task suggestion failed:", error.message);
        return res.status(502).json({ message });
    } finally {
        clearTimeout(timeout);
    }
});

module.exports = router;
