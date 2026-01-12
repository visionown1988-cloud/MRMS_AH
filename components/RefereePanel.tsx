
import React, { useState, useEffect } from 'react';
import { MatchSession, MatchStatus, TableMatch, GameResult } from '../types';
import { storageService } from '../services/storage';

interface RefereePanelProps {
  sessions: MatchSession[];
  onResultSubmitted: () => void;
}

const RefereePanel: React.FC<RefereePanelProps> = ({ sessions, onResultSubmitted }) => {
  const [refereeName, setRefereeName] = useState('');
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [selectedTableNumber, setSelectedTableNumber] = useState<number | ''>('');
  const [result, setResult] = useState<GameResult>(GameResult.PENDING);
  
  const currentSession = sessions.find(s => s.id === selectedSessionId);
  const currentTable = currentSession?.tables.find(t => t.tableNumber === selectedTableNumber);

  // Reset selections when session changes
  useEffect(() => {
    setSelectedTableNumber('');
    setResult(GameResult.PENDING);
    setRefereeName('');
  }, [selectedSessionId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSession) return alert('請選擇比賽場次');
    if (!refereeName) return alert('請先選擇您的姓名');
    if (currentSession.status !== MatchStatus.OPEN) return alert('此場次已截止，無法傳送資料');
    if (selectedTableNumber === '') return alert('請選擇桌號');
    if (result === GameResult.PENDING) return alert('請選擇比賽結果');

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
    alert('結果已成功傳送！');
    // Reset selections for next table
    setSelectedTableNumber('');
    setResult(GameResult.PENDING);
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="bg-white rounded-xl shadow-md p-6 border border-emerald-100">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
          <i className="fas fa-clipboard-check text-emerald-500 mr-2"></i>
          裁判結果回報
        </h2>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Step 1: Select Session */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">選擇比賽場次</label>
            <select 
              value={selectedSessionId}
              onChange={(e) => setSelectedSessionId(e.target.value)}
              className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none transition bg-white"
            >
              <option value="">-- 請選擇場次 --</option>
              {sessions.map(s => (
                <option key={s.id} value={s.id}>
                  {s.title} {s.status === MatchStatus.CLOSED ? '(已截止)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Step 2: Select Referee Name (from pool) */}
          {selectedSessionId && currentSession && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-300">
              <label className="block text-sm font-semibold text-gray-700 mb-1">您的姓名</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                  <i className="fas fa-user-tie"></i>
                </span>
                <select 
                  value={refereeName}
                  onChange={(e) => setRefereeName(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none transition bg-white"
                >
                  <option value="">-- 請選擇您的姓名 --</option>
                  {currentSession.referees.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                  <option value="other_manual">其他 (手動輸入...)</option>
                </select>
              </div>
              {refereeName === 'other_manual' && (
                <input 
                  type="text" 
                  placeholder="請輸入姓名"
                  className="w-full mt-2 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  onBlur={(e) => setRefereeName(e.target.value)}
                />
              )}
            </div>
          )}

          {/* Step 3: Select Table */}
          {selectedSessionId && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-400">
              <label className="block text-sm font-semibold text-gray-700 mb-1">選擇桌號</label>
              <select 
                value={selectedTableNumber}
                onChange={(e) => setSelectedTableNumber(parseInt(e.target.value))}
                className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none transition bg-white"
              >
                <option value="">-- 請選擇桌號 --</option>
                {currentSession?.tables.map(t => (
                  <option key={t.tableNumber} value={t.tableNumber}>
                    第 {t.tableNumber} 桌 ({t.player1.name} vs {t.player2.name})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Table Details */}
          {currentTable && (
            <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-100 animate-in zoom-in duration-300">
              <p className="text-xs text-emerald-600 font-bold uppercase tracking-wider mb-2">對弈資訊</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500">先手選手 (P1)</p>
                  <p className="font-bold text-gray-800">{currentTable.player1.id} - {currentTable.player1.name}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">後手選手 (P2)</p>
                  <p className="font-bold text-gray-800">{currentTable.player2.id} - {currentTable.player2.name}</p>
                </div>
              </div>
            </div>
          )}

          {/* Result Selection */}
          {currentTable && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <label className="block text-sm font-semibold text-gray-700 mb-3">比賽結果 (先手狀態)</label>
              <div className="grid grid-cols-3 gap-3">
                {[GameResult.WIN, GameResult.LOSS, GameResult.DRAW].map(res => (
                  <button
                    key={res}
                    type="button"
                    onClick={() => setResult(res)}
                    className={`py-3 rounded-lg font-bold border-2 transition ${
                      result === res 
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-md scale-105' 
                        : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-200'
                    }`}
                  >
                    {res}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button 
            type="submit"
            disabled={!currentTable || currentSession?.status === MatchStatus.CLOSED}
            className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg transition active:transform active:scale-95 flex items-center justify-center space-x-2 ${
              currentSession?.status === MatchStatus.CLOSED 
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-emerald-600 text-white hover:bg-emerald-700'
            }`}
          >
            <i className="fas fa-paper-plane"></i>
            <span>正式傳送結果</span>
          </button>
          
          {currentSession?.status === MatchStatus.CLOSED && (
            <p className="text-center text-red-500 text-sm font-medium">該比賽場次已截止接收資料</p>
          )}
        </form>
      </div>
    </div>
  );
};

export default RefereePanel;
