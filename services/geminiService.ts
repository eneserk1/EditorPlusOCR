import { GoogleGenAI } from "@google/genai";
import { AiAction } from "../types";

const getSystemInstruction = (action: AiAction): string => {
  switch (action) {
    case AiAction.SUMMARIZE:
      return "Sen kurumsal bir iş asistanısın. Verilen metni Türkçe olarak, profesyonel, net ve maddeler halinde özetle. Önemli finansal verileri veya tarihleri vurgula.";
    case AiAction.TRANSLATE_EN:
      return "Sen profesyonel bir çevirmensin. Verilen metni akıcı ve kurumsal bir İngilizceye (Business English) çevir. Formatı koru.";
    case AiAction.TRANSLATE_TR:
      return "Sen profesyonel bir çevirmensin. Verilen metni akıcı ve kurumsal bir Türkçeye çevir. Formatı koru.";
    case AiAction.PROOFREAD:
      return "Sen bir editörsün. Verilen metni dilbilgisi hatalarından arındır ve daha kurumsal, profesyonel bir dile çevir.";
    default:
      return "Sen yararlı bir asistansın.";
  }
};

export const processTextWithGemini = async (text: string, action: AiAction): Promise<string> => {
  if (!process.env.API_KEY) {
    throw new Error("API Anahtarı bulunamadı.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: text,
      config: {
        systemInstruction: getSystemInstruction(action),
        temperature: 0.3, // Low temperature for more deterministic/professional results
      }
    });

    return response.text || "Bir hata oluştu, yanıt alınamadı.";
  } catch (error) {
    console.error("Gemini Error:", error);
    throw new Error("AI işlem sırasında bir hata oluştu.");
  }
};