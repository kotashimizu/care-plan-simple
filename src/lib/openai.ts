import OpenAI from 'openai';
import { systemPrompt, generateUserPrompt } from './prompts';

// OpenAI クライアントの初期化
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface SupportItem {
  category: 'A型事業所向け' | 'B型事業所向け' | '生活介護向け' | '総合判断';
  title: string;
  goal: string;
  userRole: string;
  supportContent: string;
}

export interface GenerateResponse {
  supportItems: SupportItem[];
}

export async function generateSupportPlan(interviewRecord: string): Promise<GenerateResponse> {
  try {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: generateUserPrompt(interviewRecord),
        },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    const result = JSON.parse(content) as GenerateResponse;
    
    // バリデーション
    if (!result.supportItems || result.supportItems.length !== 10) {
      throw new Error('Invalid response format');
    }

    // 内容検証 - 不適切な単語のチェック
    const inappropriateWords = ['子ども', 'こども', '児童', '子供', '保護者', 'キッズ'];
    const allText = result.supportItems.map(item => 
      `${item.title} ${item.goal} ${item.userRole} ${item.supportContent}`
    ).join(' ');
    
    for (const word of inappropriateWords) {
      if (allText.includes(word)) {
        throw new Error(`Inappropriate content detected for adult disability services: ${word}`);
      }
    }

    // カテゴリ検証
    const validCategories = ['A型事業所向け', 'B型事業所向け', '生活介護向け', '総合判断'];
    for (const item of result.supportItems) {
      if (!validCategories.includes(item.category)) {
        throw new Error(`Invalid category: ${item.category}`);
      }
    }

    return result;
  } catch (error) {
    console.error('Error generating support plan:', error);
    throw error;
  }
}