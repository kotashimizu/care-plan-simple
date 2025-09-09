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
  const lastViewRef = useRef<'input' | 'results'>('input');
  const cameFromResultsRef = useRef(false);
  
  // Session autosave settings
  const STORAGE_KEY = 'careplan:interviewRecord:v1';
  const SUPPORT_ITEMS_KEY = 'careplan:lastSupportItems:v1';
  const LAST_INPUT_KEY = 'careplan:lastGeneratedInput:v1';
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Restore from sessionStorage on mount
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      const saved = window.sessionStorage.getItem(STORAGE_KEY);
      if (saved && !interviewRecord) {
        setInterviewRecord(saved);
      }
      // Restore last generated input and support items for forward button availability
      const savedItems = window.sessionStorage.getItem(SUPPORT_ITEMS_KEY);
      const savedLastInput = window.sessionStorage.getItem(LAST_INPUT_KEY);
      if (savedItems) {
        try {
          const parsed = JSON.parse(savedItems);
          if (Array.isArray(parsed) && parsed.length > 0 && 
              parsed.every(item => 
                item && 
                typeof item === 'object' && 
                typeof item.title === 'string' &&
                typeof item.goal === 'string' && 
                typeof item.userRole === 'string' && 
                typeof item.supportContent === 'string' &&
                typeof item.category === 'string'
              )) {
            setSupportItems(parsed as SupportItem[]);
          }
        } catch {
          // ignore parse error
        }
      }
      if (savedLastInput) {
        setLastGeneratedInput(savedLastInput);
      }
    } catch {
      // Ignore storage errors silently
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle browser Back/Forward between views
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Initialize history state
    try {
      if (!window.history.state || !window.history.state.view) {
        window.history.replaceState({ view: 'input' }, '', window.location.href);
      }
    } catch (error) {
      console.warn('Failed to initialize history state:', error);
    }

    const onPopState = (e: PopStateEvent) => {
      const state = e.state as { view?: 'input' | 'results' } | null;
      if (state?.view) {
        const nextView = state.view;
        // Detect if we came back from results -> input to enable forward
        if (lastViewRef.current === 'results' && nextView === 'input') {
          cameFromResultsRef.current = true;
        } else {
          cameFromResultsRef.current = false;
        }
        lastViewRef.current = nextView;
        setView(nextView);
      }
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
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
      } catch {
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
      try {
        window.sessionStorage.setItem(SUPPORT_ITEMS_KEY, JSON.stringify(data.supportItems));
        window.sessionStorage.setItem(LAST_INPUT_KEY, interviewRecord);
      } catch {
        // ignore
      }
      setView('results');
      try {
        window.history.pushState({ view: 'results' }, '', window.location.href);
      } catch (error) {
        console.warn('Failed to push history state:', error);
      }
      lastViewRef.current = 'results';
      cameFromResultsRef.current = false;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, index: number) => {
    try {
      if (!navigator.clipboard) {
        throw new Error('Clipboard API not supported');
      }
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => {
        setCopiedIndex(null);
      }, 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      // Fallback: show user feedback about copy failure
      setError('コピーに失敗しました。手動で選択してコピーしてください。');
      setTimeout(() => setError(''), 3000);
    }
  };

  const copyAllToExcel = async () => {
    try {
      if (!navigator.clipboard) {
        throw new Error('Clipboard API not supported');
      }
      const excelData = supportItems.map((item, index) => 
        `${item.title || `項目${index + 1}`}\t${item.goal}\t${item.userRole}\t${item.supportContent}`
      ).join('\n');
      
      await navigator.clipboard.writeText(excelData);
      setCopiedAll(true);
      setTimeout(() => {
        setCopiedAll(false);
      }, 2000);
    } catch (error) {
      console.error('Failed to copy all to clipboard:', error);
      setError('コピーに失敗しました。手動で選択してコピーしてください。');
      setTimeout(() => setError(''), 3000);
    }
  };

  const normalize = (s: string) => s.replace(/\r\n/g, '\n').trim();
  const canReturnToPreviousResult =
    supportItems.length > 0 && normalize(interviewRecord) === normalize(lastGeneratedInput);

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      {/* ヘッダー */}
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold mb-3" style={{ color: 'var(--color-primary-dark)' }}>
          個別支援計画書作成ツール
        </h1>
        <p className="text-lg" style={{ color: 'var(--color-text-secondary)' }}>
          面談内容から支援内容を自動生成
        </p>
      </div>

      {/* 入力セクション */}
      {(view === 'input' || supportItems.length === 0) && (
        <div className="p-8 rounded-2xl" style={{ backgroundColor: 'var(--color-surface)', boxShadow: '0 4px 24px var(--color-shadow)' }}>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>面談内容の入力</h3>
            {canReturnToPreviousResult && (
              <button
                onClick={() => {
                  if (cameFromResultsRef.current) {
                    // We previously navigated back from results; prefer real forward
                    try {
                      window.history.forward();
                      cameFromResultsRef.current = false;
                      return;
                    } catch {
                      // fall through to manual switch
                    }
                  }
                  setView('results');
                  try {
                    window.history.pushState({ view: 'results' }, '', window.location.href);
                  } catch (error) {
                    console.warn('Failed to push history state:', error);
                  }
                  lastViewRef.current = 'results';
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200"
                style={{ color: 'var(--color-accent)', backgroundColor: 'rgba(0, 169, 157, 0.08)' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 169, 157, 0.12)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 169, 157, 0.08)'}
                title="進む（結果へ）"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                進む（結果へ） {'>'}
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
              className="w-full h-48 p-5 rounded-xl resize-vertical text-base transition-all duration-200"
              style={{ 
                backgroundColor: 'var(--color-background)', 
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
                outline: 'none'
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--color-accent)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--color-border)'}
            />
          </div>

          {error && (
            <div className="mt-4 p-4 rounded-lg" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FEE2E2' }}>
              <p className="text-sm" style={{ color: '#DC2626' }}>{error}</p>
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={loading}
            className="mt-8 w-full py-4 px-6 text-white rounded-xl font-semibold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02]"
            style={{ 
              backgroundColor: loading ? 'var(--color-text-secondary)' : 'var(--color-accent)',
              boxShadow: loading ? 'none' : '0 4px 16px rgba(0, 169, 157, 0.2)'
            }}
          >
            {loading ? '生成中...' : '支援内容を生成する'}
          </button>
        </div>
      )}

      {/* 結果セクション */}
      {view === 'results' && supportItems.length > 0 && (
        <div>
          {/* 注意書きセクション */}
          <div className="mb-6 p-4 rounded-lg flex items-center gap-3" style={{ backgroundColor: 'rgba(0, 169, 157, 0.04)' }}>
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--color-accent)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              生成された内容は参考としてご利用ください。行政提出前に必ず内容をご確認ください。
            </p>
          </div>

          {/* アクションバー */}
          <div className="flex justify-between items-center mb-8 p-5 rounded-xl" style={{ backgroundColor: 'var(--color-surface)', boxShadow: '0 2px 12px var(--color-shadow)' }}>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  // Use browser back if history state is available, otherwise manual switch
                  try {
                    if (window.history.state && window.history.state.view === 'results') {
                      window.history.back();
                    } else {
                      setView('input');
                      window.history.pushState({ view: 'input' }, '', window.location.href);
                    }
                  } catch (error) {
                    console.warn('Failed to navigate back:', error);
                    setView('input');
                  }
                }}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200"
                style={{ color: 'var(--color-text-secondary)', backgroundColor: 'var(--color-background)' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-border)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-background)'}
                title="入力画面に戻る"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                戻る
              </button>
              <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                生成された支援内容（{supportItems.length}項目）
              </h3>
            </div>
            <div className="flex gap-2">
              <button
                onClick={copyAllToExcel}
                className="px-5 py-2.5 text-white text-sm font-medium rounded-lg transition-all duration-200 flex items-center gap-2 transform hover:scale-[1.02]"
                style={{ 
                  backgroundColor: 'var(--color-accent)',
                  boxShadow: '0 2px 8px rgba(0, 169, 157, 0.2)'
                }}
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
                className="px-5 py-2.5 text-sm font-medium rounded-lg transition-all duration-200"
                style={{ 
                  backgroundColor: 'var(--color-primary-dark)',
                  color: 'white'
                }}
              >
                新規作成
              </button>
            </div>
          </div>

          {/* カード一覧 */}
          <div className="space-y-6">
            {supportItems.map((item, index) => (
              <div
                key={index}
                className="p-6 rounded-2xl transition-all duration-300 hover:transform hover:scale-[1.01]"
                style={{ 
                  backgroundColor: 'var(--color-surface)',
                  boxShadow: '0 2px 12px var(--color-shadow)',
                  border: '1px solid var(--color-border)'
                }}
              >
                {/* カードヘッダー */}
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold"
                      style={{ 
                        backgroundColor: index === 9 ? 'var(--color-primary-dark)' : 'rgba(0, 169, 157, 0.1)',
                        color: index === 9 ? 'white' : 'var(--color-accent)'
                      }}>
                      {index + 1}
                    </span>
                    <h4 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                      {item.title || `項目 ${index + 1}`}
                    </h4>
                  </div>
                  <button
                    onClick={() => copyToClipboard(
                      `${item.goal}\t${item.userRole}\t${item.supportContent}`,
                      index * 10
                    )}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200"
                    style={{ color: 'var(--color-text-secondary)', backgroundColor: 'var(--color-background)' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-border)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-background)'}
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
                      <h5 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>
                        到達目標
                      </h5>
                      <button
                        onClick={() => copyToClipboard(item.goal, index * 10 + 1)}
                        className="p-2 rounded-lg transition-all duration-200"
                        style={{ color: 'var(--color-text-secondary)' }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = 'var(--color-accent)';
                          e.currentTarget.style.backgroundColor = 'rgba(0, 169, 157, 0.08)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = 'var(--color-text-secondary)';
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                        title="到達目標をコピー"
                      >
                        {copiedIndex === index * 10 + 1 ? (
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--color-accent)' }}>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        )}
                      </button>
                    </div>
                    <p className="text-sm p-4 rounded-lg min-h-[80px]"
                      style={{ 
                        backgroundColor: 'var(--color-background)',
                        color: 'var(--color-text-primary)',
                        lineHeight: '1.8'
                      }}>
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
                        className="p-2 rounded-lg transition-all duration-200"
                        style={{ color: 'var(--color-text-secondary)' }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = 'var(--color-accent)';
                          e.currentTarget.style.backgroundColor = 'rgba(0, 169, 157, 0.08)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = 'var(--color-text-secondary)';
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                        title="本人の役割をコピー"
                      >
                        {copiedIndex === index * 10 + 2 ? (
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--color-accent)' }}>
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
                        className="p-2 rounded-lg transition-all duration-200"
                        style={{ color: 'var(--color-text-secondary)' }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = 'var(--color-accent)';
                          e.currentTarget.style.backgroundColor = 'rgba(0, 169, 157, 0.08)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = 'var(--color-text-secondary)';
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                        title="支援内容をコピー"
                      >
                        {copiedIndex === index * 10 + 3 ? (
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--color-accent)' }}>
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
