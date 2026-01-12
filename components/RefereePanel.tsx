
import React, { useState, useEffect } from 'react';
import { MatchSession, MatchStatus, GameResult } from '../types.ts';
import { storageService } from '../services/storage.ts';

interface RefereePanelProps {
  sessions: MatchSession[];
  onResultSubmitted: () => void;
}

const STORAGE_NAME_KEY = 'mrms_remembered_referee_name';

const RefereePanel: React.FC<RefereePanelProps> = ({ sessions, onResultSubmitted }) => {
  const [refereeName, setRefereeName] = useState('');
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [selectedTableNumber, setSelectedTableNumber] = useState<number | ''>('');
  const [result, setResult] = useState<GameResult>(GameResult.PENDING);
  
  const currentSession = sessions.find(s => s.id === selectedSessionId);
  const currentTable = currentSession?.tables.find(t => t.tableNumber === selectedTableNumber);

  // 初始化載入記憶的姓名
  useEffect(() => {
    const savedName = localStorage.getItem(STORAGE_NAME_KEY);
    if (savedName) setRefereeName(savedName);
  }, []);

  useEffect(() => {
    setSelectedTableNumber('');
    setResult(GameResult.PENDING);
  }, [selectedSessionId]);

  const handleNameSelect = (name: string) => {
    setRefereeName(name);
    localStorage.setItem(STORAGE_NAME_KEY, name);
  };

  const switchIdentity = () => {
    if (window.confirm('確定要切換裁判身份嗎？')) {
      setRefereeName('');
      localStorage.removeItem(STORAGE_NAME_KEY);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSession) return alert('請先選擇比賽場次');
    if (!refereeName) return alert('請先選擇您的姓名');
    if (currentSession.status !== MatchStatus.OPEN) return alert('此場次已截止回報資料');
    if (selectedTableNumber === '') return alert('請選擇桌號');
    if (result === GameResult.PENDING) return alert('請點選勝負結果');

    const updatedTables = currentSession.tables.map(t => {
      if (t.tableNumber === selectedTableNumber) {
        return {
          ...t,
          result,
          submittedBy: refereeName,
          updatedAt: new Date().toISOString()
        };
      }
      return t;
    });

    storageService.updateSession({
      ...currentSession,
      tables: updatedTables
    });

    onResultSubmitted();
    alert('結果已成功同步更新！');
    setSelectedTableNumber('');
    setResult(GameResult.PENDING);
  };

  // 檢查當前選取的姓名是否在場次的名單內
  const isNameInPool = currentSession?.referees.includes(refereeName);

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="bg-white rounded-3xl shadow-xl p-6 border border-emerald-50 overflow-hidden">
        <div className="flex justify-between items-start mb-8">
          <h2 className="text-2xl font-black text-gray-800 flex items-center">
            <i className="fas fa-clipboard-check text-emerald-500 mr-2"></i>
            裁判結果回報
          </h2>
          {refereeName && (
             <div className="flex flex-col items-end">
               <span className="text-[10px] font-bold text-gray-400 uppercase">目前裁判</span>
               <div className="flex items-center space-x-2">
                 <span className="font-bold text-emerald-600">{refereeName}</span>
                 <button onClick={switchIdentity} className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-500 hover:bg-red-50 hover:text-red-500 transition">
                   切換身份
                 </button>
               </div>
             </div>
          )}
        </div>

        <div className="space-y-8">
          {/* 1. 比賽場次選擇 (按鈕) */}
          <section>
            <label className="block text-sm font-bold text-gray-600 mb-3 flex items-center">
              <span className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center text-[10px] mr-2">1</span>
              選擇比賽場次
            </label>
            <div className="flex flex-wrap gap-2">
              {sessions.map(s => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelectedSessionId(s.id)}
                  className={`px-4 py-2.5 rounded-xl text-[16px] font-bold transition-all border-2 ${
                    selectedSessionId === s.id
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-md ring-2 ring-emerald-100'
                      : 'bg-white text-gray-500 border-gray-100 hover:border-emerald-200'
                  }`}
                >
                  {s.title}
                  {s.status === MatchStatus.CLOSED && <span className="ml-1 opacity-60">(止)</span>}
                </button>
              ))}
            </div>
          </section>

          {/* 2. 姓名選取 (若無記憶時才顯示) */}
          {selectedSessionId && currentSession && (!refereeName || !isNameInPool) && (
            <section className="animate-in fade-in slide-in-from-top-4">
              <label className="block text-sm font-bold text-gray-600 mb-3 flex items-center">
                <span className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center text-[10px] mr-2">2</span>
                您的姓名
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {currentSession.referees.map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => handleNameSelect(r)}
                    className="px-4 py-3 bg-white border border-gray-100 rounded-xl font-bold text-gray-700 hover:bg-emerald-50 hover:border-emerald-200 transition text-[16px]"
                  >
                    {r}
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* 3. 桌號選擇 (僅顯示桌號數字，精簡網格) */}
          {selectedSessionId && refereeName && isNameInPool && (
            <section className="animate-in fade-in slide-in-from-top-4">
              <label className="block text-sm font-bold text-gray-600 mb-3 flex items-center">
                <span className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center text-[10px] mr-2">2</span>
                選擇桌號
              </label>
              {/* 移除內部滾動條 max-h-60 overflow-y-auto */}
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 p-1">
                {currentSession.tables.map(t => (
                  <button
                    key={t.tableNumber}
                    type="button"
                    onClick={() => setSelectedTableNumber(t.tableNumber)}
                    className={`py-3 rounded-xl transition-all border-2 flex items-center justify-center ${
                      selectedTableNumber === t.tableNumber
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-md scale-105'
                        : t.result !== GameResult.PENDING 
                          ? 'bg-gray-100 text-gray-400 border-gray-100 cursor-default opacity-50'
                          : 'bg-white text-gray-600 border-gray-100 hover:border-emerald-300 hover:bg-emerald-50'
                    }`}
                  >
                    <span className="text-[18px] font-black">{t.tableNumber}</span>
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-gray-400 mt-2 text-center">※ 淺灰色桌號代表已有結果，仍可點擊修改</p>
            </section>
          )}

          {/* 4. 結果回報區 */}
          {currentTable && (
            <form onSubmit={handleSubmit} className="animate-in zoom-in duration-300 space-y-6 pt-4 border-t border-slate-50">
              <div className="bg-slate-50 p-6 rounded-2xl border border-dashed border-slate-200">
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-4 text-center">正在登錄 第 {currentTable.tableNumber} 桌 結果</p>
                <div className="flex items-center justify-between text-center gap-2">
                  <div className="flex-1">
                    <p className="text-xs text-indigo-500 font-bold mb-1">#{currentTable.player1.id}</p>
                    <p className="font-black text-gray-800 text-xl">{currentTable.player1.name}</p>
                    <p className="text-[10px] text-gray-400 mt-1">先手</p>
                  </div>
                  <div className="px-2 text-slate-300 font-light italic text-xl">VS</div>
                  <div className="flex-1">
                    <p className="text-xs text-indigo-500 font-bold mb-1">#{currentTable.player2.id}</p>
                    <p className="font-black text-gray-800 text-xl">{currentTable.player2.name}</p>
                    <p className="text-[10px] text-gray-400 mt-1">後手</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-center text-sm font-bold text-gray-600 mb-4">比分結果 (先手狀態)</label>
                <div className="grid grid-cols-3 gap-3">
                  {[GameResult.WIN, GameResult.LOSS, GameResult.DRAW].map(res => (
                    <button
                      key={res}
                      type="button"
                      onClick={() => setResult(res)}
                      className={`py-5 rounded-2xl font-black text-xl border-4 transition-all ${
                        result === res 
                          ? 'bg-emerald-600 text-white border-emerald-400 shadow-lg scale-105' 
                          : 'bg-white text-gray-400 border-gray-100 hover:border-emerald-200 hover:text-emerald-500'
                      }`}
                    >
                      {res}
                    </button>
                  ))}
                </div>
              </div>

              <button 
                type="submit"
                disabled={currentSession?.status === MatchStatus.CLOSED}
                className={`w-full py-5 rounded-2xl font-black text-xl shadow-xl transition-all active:scale-95 flex items-center justify-center space-x-2 ${
                  currentSession?.status === MatchStatus.CLOSED 
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none'
                    : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-100'
                }`}
              >
                <i className="fas fa-check-circle"></i>
                <span>{currentSession?.status === MatchStatus.CLOSED ? '目前已截止傳送' : '確認送出結果'}</span>
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="text-center">
        <p className="text-[10px] text-gray-300">
          <i className="fas fa-history mr-1"></i> 
          本裝置已鎖定為裁判身份：{refereeName || '未選取'}
        </p>
      </div>
    </div>
  );
};

export default RefereePanel;
