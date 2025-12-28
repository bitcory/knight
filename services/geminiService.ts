import { GoogleGenAI } from "@google/genai";
import { Weapon, WeaponType } from "../types";

const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;

if (apiKey) {
  ai = new GoogleGenAI({ apiKey });
}

const TEXT_MODEL_ID = 'gemini-3-flash-preview';

const WEAPON_TYPE_KR: Record<string, string> = {
  'Sword': '검',
  'Axe': '도끼',
  'Hammer': '망치',
  'Spear': '창'
};

export const generateEnhancementFlavor = async (
  weapon: Weapon,
  success: boolean,
  newLevel: number
): Promise<{ quote: string; weaponName: string; description: string }> => {

  const weaponTypeKr = WEAPON_TYPE_KR[weapon.type] || weapon.type;

  const prompt = `
    당신은 "기사의 전투" 게임의 판타지 대장장이입니다.
    플레이어가 방금 ${weaponTypeKr}을(를) 강화했습니다.

    상황:
    - 현재 무기 이름: ${weapon.name}
    - 결과: ${success ? '성공' : '실패'}
    - 새 레벨: +${newLevel}

    할 일:
    1. 대장장이의 짧고 극적인 대사를 작성하세요 (최대 2문장, 한국어).
       성공하고 레벨이 높으면 감탄, 실패하면 미안해하거나 냉소적으로.
    2. 무기 레벨에 맞는 멋진 판타지 이름을 생성하세요 (한국어, 예: "그림자칼날", "신을 베는 도끼").
       무기 종류(${weaponTypeKr})와 일관되게 유지하세요.
    3. 이 무기 상태에 대한 아주 짧은 설명을 작성하세요 (1문장, 한국어).

    JSON 형식으로 반환:
    {
      "quote": "string",
      "weaponName": "string",
      "description": "string"
    }
  `;

  try {
    if (!ai) throw new Error("API key not configured");

    const response = await ai.models.generateContent({
      model: TEXT_MODEL_ID,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response");

    return JSON.parse(text);
  } catch {
    // Fallback if API fails
    return {
      quote: success ? "망치가 정확히 내려쳤다! 완성이다." : "젠장! 금속이 너무 약했군.",
      weaponName: success ? `강화된 ${weaponTypeKr}` : weapon.name,
      description: "용감한 기사를 위한 튼튼한 무기입니다."
    };
  }
};

export const generateBattleLog = async (
  weapon: Weapon,
  enemyName: string,
  result: 'win' | 'loss'
): Promise<string> => {
  const prompt = `
    Write a 1-sentence action log for a battle log.
    Player Weapon: ${weapon.name} (+${weapon.level})
    Enemy: ${enemyName}
    Result: Player ${result}
    Language: Korean (Hangul)
    Make it sound like an RPG log.
  `;

  try {
    if (!ai) throw new Error("API key not configured");

    const response = await ai.models.generateContent({
      model: TEXT_MODEL_ID,
      contents: prompt,
    });
    return response.text?.trim() || (result === 'win' ? '승리했습니다!' : '패배했습니다...');
  } catch {
    return result === 'win' ? '적을 물리쳤습니다!' : '전투에서 패배했습니다.';
  }
};