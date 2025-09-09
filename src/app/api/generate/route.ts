import { NextRequest, NextResponse } from 'next/server';
import { generateSupportPlan } from '@/lib/openai';

export async function POST(request: NextRequest) {
  try {
    const { interviewRecord } = await request.json();

    if (!interviewRecord) {
      return NextResponse.json(
        { error: '面談記録を入力してください' },
        { status: 400 }
      );
    }

    // OpenAI APIキーの確認
    if (!process.env.OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY is not set');
      return NextResponse.json(
        { error: 'サーバー設定エラー: APIキーが設定されていません' },
        { status: 500 }
      );
    }

    // 支援計画の生成
    const result = await generateSupportPlan(interviewRecord);

    return NextResponse.json(result);
  } catch (error) {
    console.error('API Error:', error);
    
    // エラーメッセージの詳細化
    let errorMessage = '支援計画の生成中にエラーが発生しました';
    
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        errorMessage = 'APIキーの設定を確認してください';
      } else if (error.message.includes('rate limit')) {
        errorMessage = 'API利用制限に達しました。しばらく待ってから再試行してください';
      }
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}