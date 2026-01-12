
import React, { useState, useEffect } from 'react';
import { MatchSession, MatchStatus, TableMatch, GameResult } from '../types.ts';
import { storageService } from '../services/storage.ts';

interface RefereePanelProps {
  sessions: MatchSession[];
  onResultSubmitted: () => void;
}

const RefereePanel: React.FC<RefereePanelProps> = ({ sessions, onResultSubmitted }) => {
  const [refereeName, setRefereeName] = useState('');
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [selectedTableNumber, setSelectedTableNumber] = useState<number | ''>('');
  const [result, setResult] = useState<GameResult>(GameResult.PENDING);
  const [importCode, setImportCode] = useState('');
  const [showImport, setShowImport] = useState(false);
  
  const currentSession = sessions.find(s => s.id === selectedSessionId);
  const currentTable = currentSession?.tables.find(t => t.tableNumber === selectedTableNumber);

  useEffect(() => {
    setSelectedTableNumber('');
    setResult(GameResult.PENDING);
    setRefereeName('');
  }, [selectedSessionId]);

  // Fixed handleImport to be async and await storageService.importFromCode
  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importCode) return;
    const session = await storageService.importFromCode(importCode);
    if (session) {
      alert(`成功載入場次：${session.title}`);
      setSelectedSessionId(session.id);
      setImportCode('');
      setShowImport(false);
      onResultSubmitted(); // 觸發主介面更新清單
    } else {
      alert('無效的代碼，請重新檢查。');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSession) return alert('請選擇比賽場次');
    if (!refereeName) return alert('請先選擇您的姓名');
    if (currentSession.status !== MatchStatus.OPEN) return alert('此場次已截止');
    if (selectedTableNumber === '') return alert('請選擇桌號');
    if (result === GameResult.PENDING) return alert('請選擇結果');

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
    alert('結果已儲存於本機！請注意：由於目前為本地儲存模式，管理員需從此設備讀取或您需傳回結果。');
    setSelectedTableNumber('');
    setResult(GameResult.PENDING);
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="bg-white rounded-xl shadow-md p-6 border border-emerald-100">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center">
            <i className="fas fa-clipboard-check text-emerald-500 mr-2"></i>
            裁判結果回報
          </h2>
          <button 
            onClick={() => setShowImport(!showImport)}
            className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full hover:bg-blue-100 transition"
          >
            {showImport ? '取消導入' : '載入新場次代碼'}
          </button>
        </div>

        {showImport && (
          <form onSubmit={handleImport} className="mb-8 p-4 bg-blue-50 rounded-xl border border-blue-100 animate-in fade-in zoom-in duration-300">
            <label className="block text-sm font-bold text-blue-700 mb-2">請貼上後台提供的場次代碼</label>
            <textarea 
              value={importCode}
              onChange={(e) => setImportCode(e.target.value)}
              className="w-full p-3 text-xs border rounded-lg mb-3 h-24 font-mono"
              placeholder="貼上代碼..."
            />
            <button type="submit" className="w-full py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition">
              確認載入比賽資訊
            </button>
          </form>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
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

          {selectedSessionId && currentSession && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-300">
              <label className="block text-sm font-semibold text-gray-700 mb-1">您的姓名</label>
              <select 
                value={refereeName}
                onChange={(e) => setRefereeName(e.target.value)}
                className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none transition bg-white"
              >
                <option value="">-- 請選擇您的姓名 --</option>
                {currentSession.referees.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          )}

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

          {currentTable && (
            <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-100 animate-in zoom-in duration-300">
              <p className="text-xs text-emerald-600 font-bold uppercase tracking-wider mb-2">對弈資訊</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500">先手 (P1)</p>
                  <p className="font-bold text-gray-800">{currentTable.player1.name}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">後手 (P2)</p>
                  <p className="font-bold text-gray-800">{currentTable.player2.name}</p>
                </div>
              </div>
            </div>
          )}

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
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-md' 
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
            className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg transition active:scale-95 flex items-center justify-center space-x-2 ${
              currentSession?.status === MatchStatus.CLOSED 
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-emerald-600 text-white hover:bg-emerald-700'
            }`}
          >
            <i className="fas fa-save"></i>
            <span>儲存結果</span>
          </button>
          
          <p className="text-[10px] text-center text-gray-400 mt-4 italic">
            提示：目前採離線模式。若需多人同步，請讓裁判在同一台主控電腦操作，或定期匯出資料進行整合。
          </p>
        </form>
      </div>
    </div>
  );
};

export default RefereePanel;
