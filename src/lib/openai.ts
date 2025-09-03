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
      temperature: 0.7,
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

    return result;
  } catch (error) {
    console.error('Error generating support plan:', error);
    throw error;
  }
}