import { GoogleGenAI, Type } from "@google/genai";
import { GeminiMovieResponse } from "../types";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export const fetchMovieMetadata = async (title: string): Promise<GeminiMovieResponse | null> => {
  if (!apiKey) {
    console.warn("No API Key provided");
    return null;
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Provide metadata for the media title "${title}". Identify if it is a "movie" or "tv" series. Return JSON. ensure the summary, genre, country and director are in Chinese (Simplified). If it is a TV series, estimate the total number of episodes and the average runtime per episode (in minutes). If it is a movie, provide the runtime (in minutes).`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "Official Chinese title if available, otherwise original title" },
            year: { type: Type.STRING },
            country: { type: Type.STRING, description: "Country or region of origin in Chinese (e.g. 美国, 中国大陆)" },
            genre: { type: Type.STRING, description: "Primary genre in Chinese (e.g., 科幻, 剧情)" },
            director: { type: Type.STRING, description: "Director or Creator name in Chinese" },
            summary: { type: Type.STRING, description: "A very short one-sentence plot summary in Chinese." },
            suggestedColorHex: { type: Type.STRING, description: "A hex color code representing the mood." },
            mediaType: { type: Type.STRING, enum: ["movie", "tv"], description: "Whether it is a movie or tv series" },
            totalEpisodes: { type: Type.INTEGER, description: "Total episodes if TV series, otherwise 0 or null" },
            duration: { type: Type.INTEGER, description: "Runtime in minutes (per episode for TV)" }
          },
          required: ["title", "year", "country", "genre", "director", "summary", "suggestedColorHex", "mediaType"],
        },
      },
    });

    if (response.text) {
      return JSON.parse(response.text) as GeminiMovieResponse;
    }
    return null;
  } catch (error) {
    console.error("Gemini API Error:", error);
    return null;
  }
};

export const generateAiReview = async (title: string, rating: number, mediaType: string = 'movie'): Promise<string> => {
    if (!apiKey) return "缺少 API Key。";
    
    const typeText = mediaType === 'tv' ? "TV series" : "movie";
    
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Write a short, casual, 2-sentence review for the ${typeText} "${title}" in Chinese (Simplified) giving it a rating of ${rating}/5 stars. Focus on the vibe.`
        });
        return response.text || "";
    } catch (error) {
        console.error("Gemini Review Error:", error);
        return "无法生成影评。";
    }
}