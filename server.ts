import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const getAiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!apiKey || apiKey === "your_api_key_here") {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "5mb" }));

  app.post("/api/gemini/daily-message", async (_req, res) => {
    const ai = getAiClient();
    if (!ai) {
      res.json({
        text: "I hope today is kind to you, Ayoola. You deserve that kind of ease. ✨",
      });
      return;
    }

    try {
      const now = new Date();
      const today = now.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      const timeSalt = now.getTime().toString().slice(-4);

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: `You are Boluwatife, a gentle and thoughtful online buddy for Ayoola. Today is ${today}. 
      Write a short, personal, and warm greeting message for her (1-2 lines). 
      This is a NEW message for a NEW day. Make it feel fresh, unique, and meaningful.
      Avoid repeating standard phrases. Every day should bring a different kind of warmth.
      Sometimes focus on encouragement, sometimes on peace, sometimes on her strength.
      Context code: ${timeSalt} (ignore this code, just use it for randomness).
      Always address her as Ayoola. No hashtags, no emojis other than a yellow heart 💛 if appropriate.`,
        config: {
          temperature: 1.0,
        },
      });

      res.json({
        text:
          response.text ||
          "I hope today is kind to you, Ayoola. You deserve that kind of ease. 💛",
      });
    } catch (error) {
      console.warn(
        "Server Gemini Daily Message Notice:",
        error instanceof Error ? error.message : String(error)
      );
      res.json({
        text: "Just a reminder... you're doing better than you think, Ayoola. 💛",
      });
    }
  });

  app.post("/api/gemini/compliment", async (req, res) => {
    const { base64Image } = req.body || {};
    const ai = getAiClient();
    if (!ai || !base64Image) {
      res.json({ text: "" });
      return;
    }

    try {
      const timeSalt = new Date().getTime().toString().slice(-4);
      const imageData = base64Image.includes(",")
        ? base64Image.split(",")[1]
        : base64Image;

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        config: {
          temperature: 1.0,
        },
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: imageData,
              },
            },
            {
              text: `You are Boluwatife, a gentle and thoughtful online buddy for Ayoola. Analyze this photo she uploaded with emotional intelligence.
            
            Context code for variety: ${timeSalt}.
            
            1. If the photo is blank, dark, or unclear: Say something sweet and reassuring like 'I can't see your face right now, but I can already feel your light, Ayoola. 💛'.
            2. If she is in the photo: Observe the mood (joyful, thoughtful, cozy, energetic), the atmosphere, and her expression. Give a deeply personal and specific compliment that focuses on the 'vibe' she's radiating. Mention a specific detail like the spark in her eyes, her unique style, or the peaceful energy of the moment.
            
            Keep it to 1-2 warm, natural sentences. Always address her as Ayoola. Use a yellow heart 💛. 
            CRITICAL: Be extremely creative and poetic. Avoid standard "you look beautiful" phrases. Every photo tells a different story—find that unique story and tell it. 
            Do not mention any imperfections. Avoid being generic or robotic.`,
            },
          ],
        },
      });

      res.json({ text: response.text || "" });
    } catch (error) {
      console.warn(
        "Server Gemini Compliment Notice:",
        error instanceof Error ? error.message : String(error)
      );
      res.json({ text: "" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
