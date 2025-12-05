import { GoogleGenAI, Chat } from "@google/genai";
import { ChatMessage } from "../types";

// Initialize Gemini Client
// Note: In a real production app, this key should be proxied or user-provided if not using a secure backend.
const apiKey = process.env.API_KEY || ''; 
const ai = new GoogleGenAI({ apiKey });

const MODEL_NAME = 'gemini-2.5-flash';

let chatSession: Chat | null = null;

export const initializeCoachChat = () => {
  chatSession = ai.chats.create({
    model: MODEL_NAME,
    config: {
      systemInstruction: `You are an energetic, encouraging, and brief Juggling Coach named "Juggler Joe". 
      Your goal is to help a player playing a virtual juggling game where they use their hands (webcam tracked) to bounce virtual balls.
      
      Rules:
      1. Keep advice very short (under 2 sentences).
      2. Be enthusiastic! Use emojis like 🤹, 🔥, ✨.
      3. Explain concepts like "The Cascade Pattern", "Scooping motion", and "Height control" simply.
      4. If the user says they dropped a ball, tell them it's part of learning.
      `,
    },
  });
};

export const sendCoachMessage = async (message: string): Promise<string> => {
  if (!apiKey) return "API Key missing. Cannot connect to Coach.";
  if (!chatSession) initializeCoachChat();

  try {
    const result = await chatSession!.sendMessage({ message });
    return result.text || "Keep it up!";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Oops, I dropped my train of thought. Try again!";
  }
};

export const getGameSummary = async (score: number, duration: number): Promise<string> => {
    if (!apiKey) return "Great job!";
    try {
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: `The player just finished a game. Score: ${score}. Duration: ${duration} seconds. Give them a quick specific compliment or challenge for next time.`
        });
        return response.text || "Good game!";
    } catch (e) {
        return "Nice juggling session!";
    }
}
