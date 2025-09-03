'use client';

import { useEffect, useRef, useState } from 'react';
import { SupportItem } from '@/lib/openai';

export default function SupportPlanGenerator() {
  const [interviewRecord, setInterviewRecord] = useState('');
  const [loading, setLoading] = useState(false);
  const [supportItems, setSupportItems] = useState<SupportItem[]>([]);
  const [error, setError] = useState('');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [view, setView] = useState<'input' | 'results'>('input');
  const [lastGeneratedInput, setLastGeneratedInput] = useState('');
  
  // Session autosave settings
  const STORAGE_KEY = 'careplan:interviewRecord:v1';
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Restore from sessionStorage on mount
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      const saved = window.sessionStorage.getItem(STORAGE_KEY);
      if (saved && !interviewRecord) {
        setInterviewRecord(saved);
      }
    } catch (_) {
      // Ignore storage errors silently
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autosave to sessionStorage with debounce when interviewRecord changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      try {
        if (interviewRecord.trim() === '') {
          window.sessionStorage.removeItem(STORAGE_KEY);
        } else {
          window.sessionStorage.setItem(STORAGE_KEY, interviewRecord);
        }
      } catch (_) {
        // Ignore storage errors silently
      }
    }, 500);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [interviewRecord]);
  
  const handleGenerate = async () => {
    if (!interviewRecord.trim()) {
      setError('面談内容を入力してください');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ interviewRecord }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'エラーが発生しました');
      }

      const data = await response.json();
      setSupportItems(data.supportItems);
      setLastGeneratedInput(interviewRecord);
      setView('results');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIndex(index);
      setTimeout(() => {
        setCopiedIndex(null);
      }, 2000);
    });
  };

  const copyAllToExcel = () => {
    const excelData = supportItems.map((item, index) => 
      `${item.title || `項目${index + 1}`}\t${item.goal}\t${item.userRole}\t${item.supportContent}`
    ).join('\n');
    
    navigator.clipboard.writeText(excelData).then(() => {
      setCopiedAll(true);
      setTimeout(() => {
        setCopiedAll(false);
      }, 2000);
    });
  };

  const canReturnToPreviousResult =
    supportItems.length > 0 && interviewRecord === lastGeneratedInput;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* ヘッダー */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 text-center">
          個別支援計画書作成ツール
        </h1>
        <p className="text-gray-600 text-center mt-2">
          面談内容から支援内容を自動生成
        </p>
      </div>

      {/* 入力セクション */}
      {(view === 'input' || supportItems.length === 0) && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">面談内容の入力</h3>
            {canReturnToPreviousResult && (
              <button
                onClick={() => setView('results')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors duration-200"
                title="前の結果に戻る"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                前の結果に戻る
              </button>
            )}
          </div>
          <div className="relative">
            <textarea
              value={interviewRecord}
              onChange={(e) => setInterviewRecord(e.target.value)}
              placeholder="面談の文字起こしデータをここに貼り付けてください...

例：
利用者さんは毎日通所したいと話されています。現在は週3回の通所ですが、体力面での不安があります。作業については軽作業から始めたいとのことです..."
              className="w-full h-40 p-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical text-sm text-gray-900 placeholder-gray-400"
            />
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={loading}
            className="mt-6 w-full py-3 px-6 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '生成中...' : '支援内容を生成する'}
          </button>
        </div>
      )}

      {/* 結果セクション */}
      {view === 'results' && supportItems.length > 0 && (
        <div>
          {/* アクションバー */}
          <div className="flex justify-between items-center mb-6 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setView('input')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors duration-200"
                title="入力画面に戻る"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                戻る
              </button>
              <h3 className="text-lg font-semibold text-gray-900">
                生成された支援内容（{supportItems.length}項目）
              </h3>
            </div>
            <div className="flex gap-2">
              <button
                onClick={copyAllToExcel}
                className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center gap-2"
              >
                {copiedAll ? (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    コピー完了
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Excel用に全てコピー
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setSupportItems([]);
                  setInterviewRecord('');
                }}
                className="px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors duration-200"
              >
                新規作成
              </button>
            </div>
          </div>

          {/* カード一覧 */}
          <div className="space-y-4">
            {supportItems.map((item, index) => (
              <div
                key={index}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow duration-200"
              >
                {/* カードヘッダー */}
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center justify-center w-7 h-7 bg-blue-100 text-blue-600 rounded-full text-sm font-semibold">
                      {index + 1}
                    </span>
                    <h4 className="text-base font-semibold text-gray-900">
                      {item.title || `項目 ${index + 1}`}
                    </h4>
                  </div>
                  <button
                    onClick={() => copyToClipboard(
                      `${item.goal}\t${item.userRole}\t${item.supportContent}`,
                      index * 10
                    )}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors duration-200"
                  >
                    {copiedIndex === index * 10 ? (
                      <>
                        <svg className="w-3.5 h-3.5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        コピー済
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        全てコピー
                      </>
                    )}
                  </button>
                </div>

                {/* カード内容 */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* 到達目標 */}
                  <div className="md:col-span-1">
                    <div className="flex justify-between items-center mb-1.5">
                      <h5 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        到達目標
                      </h5>
                      <button
                        onClick={() => copyToClipboard(item.goal, index * 10 + 1)}
                        className="p-1 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-all duration-200"
                        title="到達目標をコピー"
                      >
                        {copiedIndex === index * 10 + 1 ? (
                          <svg className="w-3.5 h-3.5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        )}
                      </button>
                    </div>
                    <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-md min-h-[80px]">
                      {item.goal}
                    </p>
                  </div>

                  {/* 本人の役割 */}
                  <div className="md:col-span-1">
                    <div className="flex justify-between items-center mb-1.5">
                      <h5 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        本人の役割
                      </h5>
                      <button
                        onClick={() => copyToClipboard(item.userRole, index * 10 + 2)}
                        className="p-1 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-all duration-200"
                        title="本人の役割をコピー"
                      >
                        {copiedIndex === index * 10 + 2 ? (
                          <svg className="w-3.5 h-3.5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        )}
                      </button>
                    </div>
                    <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-md min-h-[80px]">
                      {item.userRole}
                    </p>
                  </div>

                  {/* 支援内容 */}
                  <div className="md:col-span-1">
                    <div className="flex justify-between items-center mb-1.5">
                      <h5 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        支援内容
                      </h5>
                      <button
                        onClick={() => copyToClipboard(item.supportContent, index * 10 + 3)}
                        className="p-1 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-all duration-200"
                        title="支援内容をコピー"
                      >
                        {copiedIndex === index * 10 + 3 ? (
                          <svg className="w-3.5 h-3.5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        )}
                      </button>
                    </div>
                    <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-md min-h-[80px]">
                      {item.supportContent}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
