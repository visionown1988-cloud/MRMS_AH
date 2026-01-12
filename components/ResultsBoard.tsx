
import React, { useState, useEffect } from 'react';
import { MatchSession, UserRole, MatchStatus, TableMatch, GameResult } from '../types.ts';
import { storageService } from '../services/storage.ts';

interface ResultsBoardProps {
  sessions: MatchSession[];
  userRole: UserRole;
  onRefresh: () => void;
  onJoinSync?: (id: string) => void;
  currentSyncId?: string;
}

const ResultsBoard: React.FC<ResultsBoardProps> = ({ sessions, userRole, onRefresh, onJoinSync, currentSyncId }) => {
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [editingTable, setEditingTable] = useState<{ sessionId: string, tableNumber: number } | null>(null);
  const [editResult, setEditResult] = useState<GameResult>(GameResult.PENDING);
  const [highlightedTables, setHighlightedTables] = useState<Set<number>>(new Set());
  const [inputSyncId, setInputSyncId] = useState('');

  const selectedSession = sessions.find(s => s.id === selectedSessionId);
  const isAuthorized = userRole === UserRole.ADMIN || userRole === UserRole.REFEREE;

  useEffect(() => {
    if (selectedSession) {
      const now = new Date().getTime();
      const recent = selectedSession.tables
        .filter(t => t.updatedAt && (now - new Date(t.updatedAt).getTime()) < 10000)
        .map(t => t.tableNumber);
      
      if (recent.length > 0) {
        setHighlightedTables(new Set(recent));
        const timer = setTimeout(() => setHighlightedTables(new Set()), 5000);
        return () => clearTimeout(timer);
      }
    }
  }, [selectedSession]);

  const toggleStatus = (session: MatchSession, newStatus: MatchStatus) => {
    if (userRole !== UserRole.ADMIN) return;
    storageService.updateSession({ ...session, status: newStatus });
    onRefresh();
  };

  const handleEdit = (table: TableMatch) => {
    setEditingTable({ sessionId: selectedSessionId, tableNumber: table.tableNumber });
    setEditResult(table.result);
  };

  const saveEdit = () => {
    if (!selectedSession || !editingTable) return;
    const updatedTables = selectedSession.tables.map(t => {
      if (t.tableNumber === editingTable.tableNumber) {
        return { 
          ...t, 
          result: editResult, 
          updatedAt: new Date().toISOString(), 
          submittedBy: `${userRole === UserRole.ADMIN ? '後台' : '裁判'}修改` 
        };
      }
      return t;
    });
    const updatedSession = { ...selectedSession, tables: updatedTables };
    storageService.updateSession(updatedSession);
    
    // 如果有雲端 ID，同步更新到雲端
    if (currentSyncId) {
      const allSessions = storageService.getSessions().map(s => s.id === updatedSession.id ? updatedSession : s);
      storageService.cloud.updateBin(currentSyncId, allSessions);
    }
    
    setEditingTable(null);
    onRefresh();
  };

  const handleSyncSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputSyncId.trim() && onJoinSync) {
      onJoinSync(inputSyncId.trim());
      setInputSyncId('');
    }
  };

  const sortedTables = selectedSession ? [...selectedSession.tables].sort((a, b) => a.tableNumber - b.tableNumber) : [];
  const completedMatches = sortedTables.filter(t => t.result !== GameResult.PENDING);

  return (
    <div className="space-y-6">
      {/* 加入同步區 */}
      {!currentSyncId && sessions.length === 0 && (
        <div className="bg-white p-8 rounded-3xl shadow-xl border-2 border-dashed border-indigo-200 text-center animate-in zoom-in duration-500">
          <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-cloud-download-alt text-3xl text-indigo-500"></i>
          </div>
          <h2 className="text-xl font-black text-slate-800 mb-2">您目前尚未加入任何比賽</h2>
          <p className="text-gray-500 text-sm mb-6">請輸入管理員提供的「同步代碼」來觀看即時賽況。</p>
          <form onSubmit={handleSyncSubmit} className="max-w-xs mx-auto flex space-x-2">
            <input 
              type="text" 
              value={inputSyncId}
              onChange={e=>setInputSyncId(e.target.value)}
              placeholder="輸入同步代碼..." 
              className="flex-grow p-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
            />
            <button type="submit" className="bg-indigo-600 text-white px-6 rounded-xl font-bold hover:bg-indigo-700 transition">加入</button>
          </form>
        </div>
      )}

      {/* 場次選單與刷新按鈕 */}
      <div className="bg-white p-4 rounded-xl shadow-sm border flex flex-wrap items-center gap-4">
        <div className="flex items-center space-x-2">
          <i className="fas fa-filter text-indigo-400"></i>
          <label className="font-bold text-gray-700">場次：</label>
        </div>
        <div className="flex-grow min-w-[200px]">
          <select 
            value={selectedSessionId}
            onChange={(e) => setSelectedSessionId(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            <option value="">-- 請選擇查看場次 --</option>
            {sessions.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
          </select>
        </div>
        <button onClick={onRefresh} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition" title="重新整理資料">
          <i className="fas fa-sync-alt"></i>
        </button>
      </div>

      {selectedSession ? (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl shadow-md border-l-4 border-indigo-500">
            <div className="flex-grow">
              <div className="flex items-center space-x-2">
                <h2 className="text-2xl font-bold text-gray-800">{selectedSession.title}</h2>
                {currentSyncId && <span className="bg-green-100 text-green-700 text-[10px] px-2 py-0.5 rounded font-black tracking-widest uppercase">Cloud Live</span>}
              </div>
              <p className="text-xs text-gray-400 mt-1">{new Date(selectedSession.createdAt).toLocaleString()}</p>
            </div>
            
            <div className="flex items-center space-x-3">
              <span className={`px-3 py-1 rounded-full text-xs font-black ${selectedSession.status === MatchStatus.OPEN ? 'bg-green-100 text-green-700 border' : 'bg-red-100 text-red-700 border'}`}>
                {selectedSession.status === MatchStatus.OPEN ? '● 紀錄中' : '● 已截止'}
              </span>
              {userRole === UserRole.ADMIN && (
                <div className="flex bg-gray-100 p-1 rounded-lg border">
                  <button onClick={() => toggleStatus(selectedSession, MatchStatus.OPEN)} className={`px-3 py-1 rounded-md text-xs font-bold transition ${selectedSession.status === MatchStatus.OPEN ? 'bg-white shadow-sm text-green-600' : 'text-gray-400'}`}>開放</button>
                  <button onClick={() => toggleStatus(selectedSession, MatchStatus.CLOSED)} className={`px-3 py-1 rounded-md text-xs font-bold transition ${selectedSession.status === MatchStatus.CLOSED ? 'bg-white shadow-sm text-red-600' : 'text-gray-400'}`}>截止</button>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {sortedTables.map(table => (
              <div key={table.tableNumber} className={`bg-white rounded-2xl shadow-sm border-2 transition-all duration-500 overflow-hidden ${highlightedTables.has(table.tableNumber) ? 'border-indigo-500 shadow-xl' : 'border-transparent'}`}>
                <div className="bg-slate-50 px-4 py-2 border-b flex justify-between items-center">
                  <span className="font-black text-slate-800">第 {table.tableNumber} 桌</span>
                  {highlightedTables.has(table.tableNumber) && <span className="text-[9px] font-bold text-indigo-600 animate-pulse uppercase tracking-widest">剛更新</span>}
                </div>
                <div className="p-5">
                  <div className="flex items-center justify-between text-center mb-4">
                    <div className="flex-1"><p className="text-[10px] text-gray-400 mb-1">先手</p><p className="font-black truncate">{table.player1.name}</p></div>
                    <div className="text-indigo-200 font-black italic px-2">VS</div>
                    <div className="flex-1"><p className="text-[10px] text-gray-400 mb-1">後手</p><p className="font-black truncate">{table.player2.name}</p></div>
                  </div>
                  <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">結果</span>
                      <span className={`text-2xl font-black ${table.result === GameResult.WIN ? 'text-green-600' : table.result === GameResult.LOSS ? 'text-red-600' : table.result === GameResult.DRAW ? 'text-amber-600' : 'text-slate-200'}`}>
                        {table.result}
                      </span>
                    </div>
                    {isAuthorized && selectedSession.status === MatchStatus.OPEN && (
                      <button onClick={() => handleEdit(table)} className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full text-[10px] font-black hover:bg-indigo-600 hover:text-white transition">修改</button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        sessions.length > 0 && (
          <div className="text-center py-20 bg-white rounded-3xl shadow-sm border border-dashed border-slate-200">
            <p className="text-slate-400 text-sm">請從上方選單選擇場次以觀看細節</p>
          </div>
        )
      )}
    </div>
  );
};

export default ResultsBoard;
