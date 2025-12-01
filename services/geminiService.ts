import { GoogleGenAI, Type } from "@google/genai";
import { StoryNode, StoryLink } from "../types";

const STORAGE_KEY = "storyweaver:gemini_api_key";
const MODEL_NAME = "gemini-2.5-flash";

let runtimeApiKey = "";
let cachedClient: GoogleGenAI | null = null;
let cachedKey = "";

const readEnvApiKey = () =>
  (import.meta.env.VITE_GEMINI_API_KEY as string) ||
  (import.meta.env.GEMINI_API_KEY as string) ||
  "";

export const getGeminiApiKey = (): string => {
  if (runtimeApiKey) return runtimeApiKey;

  if (typeof localStorage !== "undefined") {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      runtimeApiKey = stored;
      return runtimeApiKey;
    }
  }

  const envKey = readEnvApiKey();
  if (envKey) {
    runtimeApiKey = envKey;
    return runtimeApiKey;
  }

  return "";
};

export const setGeminiApiKey = (key: string) => {
  runtimeApiKey = key.trim();
  if (typeof localStorage !== "undefined") {
    if (runtimeApiKey) {
      localStorage.setItem(STORAGE_KEY, runtimeApiKey);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }
  if (runtimeApiKey !== cachedKey) {
    cachedClient = null;
    cachedKey = "";
  }
};

const getClient = () => {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error("Gemini API Key가 없습니다. 사이드바에서 입력 후 다시 시도하세요.");
  }

  if (!cachedClient || cachedKey !== apiKey) {
    cachedClient = new GoogleGenAI({ apiKey });
    cachedKey = apiKey;
  }

  return cachedClient;
};

export const generateStorySuggestion = async (
  currentNode: StoryNode,
  existingLinks: StoryLink[],
  allNodes: StoryNode[]
): Promise<{ title: string; content: string; choices: string[] }> => {
  const ai = getClient();

  const prompt = `
    당신은 인터랙티브 픽션 게임(Choose Your Own Adventure)을 위한 창의적인 한국어 글쓰기 도우미입니다.
    
    상황:
    사용자는 현재 "${currentNode.title}"라는 제목의 장면을 작성하고 있습니다.
    현재 내용: "${currentNode.content}"
    
    작업:
    1. 현재 내용을 더 흥미롭고 묘사가 생생하게 다듬어 주세요 (한국어로, 100단어 이내).
    2. 플레이어가 다음에 선택할 수 있는 서로 다른 선택지 3가지를 제안해 주세요 (한국어로).
    
    응답은 반드시 JSON 형식으로 반환해야 합니다.
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "이 장면에 어울리는 매력적인 제목" },
            content: { type: Type.STRING, description: "다듬어진 한국어 스토리 텍스트" },
            choices: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "플레이어를 위한 3가지 선택지 목록" 
            }
          },
          required: ["title", "content", "choices"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("AI 응답이 없습니다.");
    return JSON.parse(text);

  } catch (error) {
    console.error("Gemini AI 오류:", error);
    throw error;
  }
};

export const expandStoryNode = async (idea: string): Promise<{ title: string; content: string }> => {
    const ai = getClient();

    const prompt = `이 아이디어를 바탕으로 짧은 인터랙티브 픽션 장면을 한국어로 만들어 주세요: "${idea}". 
    "title"(제목)과 "content"(내용, 최대 80단어)를 포함한 JSON을 반환하세요.`;

    const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING, description: "장면 제목" },
                    content: { type: Type.STRING, description: "장면 내용" }
                }
            }
        }
    });
    
    const text = response.text;
    if(!text) throw new Error("응답 없음");
    return JSON.parse(text);
}
