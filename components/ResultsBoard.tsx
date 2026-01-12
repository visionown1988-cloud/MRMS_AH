
import React, { useState, useEffect } from 'react';
import { MatchSession, UserRole, MatchStatus, TableMatch, GameResult } from '../types.ts';
import { storageService } from '../services/storage.ts';

interface ResultsBoardProps {
  sessions: MatchSession[];
  userRole: UserRole;
  onRefresh: () => void;
}

const ResultsBoard: React.FC<ResultsBoardProps> = ({ sessions, userRole, onRefresh }) => {
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [editingTable, setEditingTable] = useState<{ sessionId: string, tableNumber: number } | null>(null);
  const [editResult, setEditResult] = useState<GameResult>(GameResult.PENDING);
  const [highlightedTables, setHighlightedTables] = useState<Set<number>>(new Set());

  const selectedSession = sessions.find(s => s.id === selectedSessionId);
  const isAuthorized = userRole === UserRole.ADMIN || userRole === UserRole.REFEREE;

  // 即時視覺效果：追蹤最近 10 秒內更新的桌次並給予發光效果
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
    storageService.updateSession({ ...selectedSession, tables: updatedTables });
    setEditingTable(null);
    onRefresh();
  };

  const sortedTables = selectedSession ? [...selectedSession.tables].sort((a, b) => a.tableNumber - b.tableNumber) : [];
  const completedMatches = sortedTables.filter(t => t.result !== GameResult.PENDING);

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-xl shadow-sm border flex flex-wrap items-center gap-4">
        <div className="flex items-center space-x-2">
          <i className="fas fa-filter text-indigo-400"></i>
          <label className="font-bold text-gray-700">選擇比賽場次：</label>
        </div>
        <div className="flex-grow min-w-[200px]">
          <select 
            value={selectedSessionId}
            onChange={(e) => setSelectedSessionId(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition"
          >
            <option value="">-- 請選擇查看場次 --</option>
            {sessions.map(s => (
              <option key={s.id} value={s.id}>{s.title}</option>
            ))}
          </select>
        </div>
        <button 
          onClick={onRefresh}
          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
          title="立即同步資料"
        >
          <i className="fas fa-sync-alt"></i>
        </button>
      </div>

      {selectedSession ? (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl shadow-md border-l-4 border-indigo-500">
            <div className="flex-grow">
              <div className="flex items-center space-x-2">
                <h2 className="text-2xl font-bold text-gray-800">{selectedSession.title}</h2>
                <span className="bg-indigo-100 text-indigo-700 text-[10px] px-2 py-0.5 rounded font-black uppercase tracking-tighter">LIVE</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                <i className="far fa-calendar-alt mr-1"></i>
                建立時間：{new Date(selectedSession.createdAt).toLocaleString()}
              </p>
              {selectedSession.referees && selectedSession.referees.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1 items-center">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight mr-1">執法裁判：</span>
                  {selectedSession.referees.map(r => (
                    <span key={r} className="text-[10px] bg-slate-100 px-2 py-0.5 rounded-full text-slate-600 font-medium">{r}</span>
                  ))}
                </div>
              )}
            </div>
            
            <div className="flex items-center space-x-3">
              <span className={`px-3 py-1 rounded-full text-xs font-black tracking-wide ${
                selectedSession.status === MatchStatus.OPEN ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-red-100 text-red-700 border border-red-200'
              }`}>
                {selectedSession.status === MatchStatus.OPEN ? '● 開放紀錄中' : '● 資料已截止'}
              </span>
              
              {userRole === UserRole.ADMIN && (
                <div className="flex bg-gray-100 p-1 rounded-lg border">
                  <button 
                    onClick={() => toggleStatus(selectedSession, MatchStatus.OPEN)}
                    className={`px-3 py-1 rounded-md text-xs font-bold transition ${selectedSession.status === MatchStatus.OPEN ? 'bg-white shadow-sm text-green-600' : 'text-gray-400 hover:text-gray-600'}`}
                  >
                    開放
                  </button>
                  <button 
                    onClick={() => toggleStatus(selectedSession, MatchStatus.CLOSED)}
                    className={`px-3 py-1 rounded-md text-xs font-bold transition ${selectedSession.status === MatchStatus.CLOSED ? 'bg-white shadow-sm text-red-600' : 'text-gray-400 hover:text-gray-600'}`}
                  >
                    截止
                  </button>
                </div>
              )}
            </div>
          </div>

          {completedMatches.length > 0 && (
            <div className="bg-white border border-indigo-100 rounded-xl p-4 shadow-sm overflow-hidden relative">
              <div className="absolute top-0 right-0 p-2 opacity-5 pointer-events-none">
                <i className="fas fa-trophy text-6xl text-indigo-900"></i>
              </div>
              <h3 className="text-xs font-black text-indigo-700 uppercase tracking-widest mb-4 flex items-center">
                <i className="fas fa-chart-line mr-2"></i> 最新戰報看板 ({completedMatches.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                {completedMatches.slice(-8).reverse().map(t => (
                  <div key={t.tableNumber} className={`bg-slate-50 px-3 py-2 rounded-lg border transition-all duration-1000 flex items-center space-x-3 text-xs ${highlightedTables.has(t.tableNumber) ? 'border-indigo-400 bg-indigo-50 scale-105 shadow-sm' : 'border-slate-100'}`}>
                    <span className="font-bold text-indigo-600 bg-white w-5 h-5 rounded-full flex items-center justify-center border border-indigo-100">{t.tableNumber}</span>
                    <span className="text-gray-700 font-medium">{t.player1.name}</span>
                    <span className={`font-black px-2 py-0.5 rounded text-[10px] ${
                      t.result === GameResult.WIN ? 'bg-green-500 text-white' : 
                      t.result === GameResult.LOSS ? 'bg-red-500 text-white' : 'bg-amber-500 text-white'
                    }`}>
                      {t.result}
                    </span>
                    <span className="text-gray-700 font-medium">{t.player2.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {sortedTables.map(table => (
              <div key={table.tableNumber} className={`bg-white rounded-2xl shadow-sm border-2 transition-all duration-500 overflow-hidden ${highlightedTables.has(table.tableNumber) ? 'border-indigo-500 shadow-xl scale-[1.02]' : 'border-transparent'}`}>
                <div className="bg-slate-50 px-4 py-2 border-b flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                    <span className="font-black text-slate-800 tracking-tight">第 {table.tableNumber} 桌</span>
                  </div>
                  {highlightedTables.has(table.tableNumber) && (
                    <span className="text-[9px] font-bold text-indigo-600 animate-pulse uppercase tracking-widest">剛更新</span>
                  )}
                </div>
                
                <div className="p-5 space-y-5">
                  <div className="flex items-center justify-between space-x-4">
                    <div className="text-center flex-1 min-w-0">
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">先手 (P1)</p>
                      <p className="font-black text-slate-800 truncate text-base">{table.player1.name}</p>
                      <p className="text-[9px] font-mono text-slate-400 bg-slate-50 inline-block px-1 rounded mt-1">{table.player1.id}</p>
                    </div>
                    <div className="flex flex-col items-center">
                       <span className="text-indigo-200 font-black italic text-sm">VS</span>
                    </div>
                    <div className="text-center flex-1 min-w-0">
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">後手 (P2)</p>
                      <p className="font-black text-slate-800 truncate text-base">{table.player2.name}</p>
                      <p className="text-[9px] font-mono text-slate-400 bg-slate-50 inline-block px-1 rounded mt-1">{table.player2.id}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">目前結果</span>
                      <span className={`text-2xl font-black ${
                        table.result === GameResult.WIN ? 'text-green-600' : 
                        table.result === GameResult.LOSS ? 'text-red-600' : 
                        table.result === GameResult.DRAW ? 'text-amber-600' : 'text-slate-200'
                      }`}>
                        {table.result}
                      </span>
                    </div>

                    <div className="text-right flex flex-col items-end">
                       {editingTable?.tableNumber === table.tableNumber ? (
                         <div className="flex flex-col space-y-2 w-full animate-in slide-in-from-right-2">
                            <select 
                              value={editResult}
                              onChange={(e) => setEditResult(e.target.value as GameResult)}
                              className="text-xs border-2 border-indigo-200 rounded-lg p-1 font-bold outline-none focus:border-indigo-500"
                            >
                              {Object.values(GameResult).map(r => (
                                <option key={r} value={r}>{r}</option>
                              ))}
                            </select>
                            <div className="flex space-x-1">
                              <button onClick={saveEdit} className="bg-indigo-600 text-white px-2 py-1 rounded text-[10px] font-bold flex-1 shadow-sm">儲存</button>
                              <button onClick={() => setEditingTable(null)} className="bg-gray-300 text-gray-700 px-2 py-1 rounded text-[10px] font-bold flex-1">取消</button>
                            </div>
                         </div>
                       ) : (
                         <>
                           {isAuthorized && selectedSession.status === MatchStatus.OPEN && (
                             <button 
                               onClick={() => handleEdit(table)}
                               className="bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-full text-[10px] font-black hover:bg-indigo-600 hover:text-white transition-colors duration-200 flex items-center"
                             >
                               <i className="fas fa-edit mr-1"></i> 修改
                             </button>
                           )}
                           {table.submittedBy && (
                             <div className="mt-2 text-right">
                               <p className="text-[9px] text-slate-400 font-medium">
                                 裁判: <span className="text-slate-600">{table.submittedBy}</span>
                               </p>
                               <p className="text-[8px] text-slate-300 font-mono">
                                 {table.updatedAt && new Date(table.updatedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second: '2-digit'})}
                               </p>
                             </div>
                           )}
                         </>
                       )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-32 bg-white rounded-3xl shadow-sm border border-dashed border-slate-200 animate-in fade-in duration-700">
          <div className="relative inline-block mb-6">
            <i className="fas fa-search text-7xl text-slate-50"></i>
            <i className="fas fa-chart-pie text-4xl text-indigo-100 absolute bottom-0 right-0"></i>
          </div>
          <h3 className="text-xl font-black text-slate-800 mb-2">請從上方選單選擇想查看的場次</h3>
          <p className="text-slate-400 text-sm max-w-xs mx-auto">選擇後系統將自動開始即時同步比賽數據，您可以第一時間掌握最新賽況。</p>
        </div>
      )}
    </div>
  );
};

export default ResultsBoard;
