const COMPLIMENT_FALLBACKS = [
  "You look really beautiful here, Ayoola. Effortlessly so. 💛",
  "There's such a peaceful energy in this photo of you, Ayoola. 💛",
  "You look absolutely glowing here, Ayoola. 💛",
  "I love the vibe of this moment you captured. You look amazing. 💛",
  "You carry so much grace, Ayoola. Truly. 💛"
];

const DAILY_MESSAGE_FALLBACKS = [
  "I hope today is kind to you, Ayoola. You deserve that kind of ease. 💛",
  "Just a reminder... you're doing better than you think, Ayoola. 💛",
  "You carry so much warmth and grace into every room, Ayoola. 💛",
  "May today bring you quiet moments of peace and reasons to smile, Ayoola. 💛"
];

function getRandomComplimentFallback() {
  return COMPLIMENT_FALLBACKS[Math.floor(Math.random() * COMPLIMENT_FALLBACKS.length)];
}

function getRandomDailyFallback() {
  return DAILY_MESSAGE_FALLBACKS[Math.floor(Math.random() * DAILY_MESSAGE_FALLBACKS.length)];
}

export async function getCompliment(base64Image: string): Promise<string> {
  try {
    const response = await fetch("/api/gemini/compliment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ base64Image }),
    });
    if (!response.ok) {
      return getRandomComplimentFallback();
    }
    const data = await response.json();
    return (data?.text && data.text.trim()) || getRandomComplimentFallback();
  } catch (error) {
    console.warn("Compliment fallback used:", error instanceof Error ? error.message : String(error));
    return getRandomComplimentFallback();
  }
}

export async function getDailyMessage(): Promise<string> {
  try {
    const response = await fetch("/api/gemini/daily-message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) {
      return getRandomDailyFallback();
    }
    const data = await response.json();
    return (data?.text && data.text.trim()) || getRandomDailyFallback();
  } catch (error) {
    console.warn("Daily message fallback used:", error instanceof Error ? error.message : String(error));
    return getRandomDailyFallback();
  }
}
