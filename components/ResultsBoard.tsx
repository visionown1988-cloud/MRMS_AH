
import React, { useState } from 'react';
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

  const selectedSession = sessions.find(s => s.id === selectedSessionId);
  const isAuthorized = userRole === UserRole.ADMIN || userRole === UserRole.REFEREE;

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
        return { ...t, result: editResult, updatedAt: new Date().toISOString(), submittedBy: `${userRole === UserRole.ADMIN ? '後台' : '裁判'}修改` };
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
        <label className="font-bold text-gray-700">選擇比賽場次：</label>
        <div className="flex-grow">
          <select 
            value={selectedSessionId}
            onChange={(e) => setSelectedSessionId(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            <option value="">-- 請選擇查看場次 --</option>
            {sessions.map(s => (
              <option key={s.id} value={s.id}>{s.title}</option>
            ))}
          </select>
        </div>
      </div>

      {selectedSession ? (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl shadow-md border-l-4 border-indigo-500">
            <div className="flex-grow">
              <h2 className="text-2xl font-bold text-gray-800">{selectedSession.title}</h2>
              <p className="text-xs text-gray-500 mt-1">創建時間：{new Date(selectedSession.createdAt).toLocaleString()}</p>
              {selectedSession.referees && selectedSession.referees.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">本場裁判：</span>
                  {selectedSession.referees.map(r => (
                    <span key={r} className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">{r}</span>
                  ))}
                </div>
              )}
            </div>
            
            <div className="flex items-center space-x-3">
              <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                selectedSession.status === MatchStatus.OPEN ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}>
                {selectedSession.status === MatchStatus.OPEN ? '● 開放中' : '● 已截止'}
              </span>
              
              {userRole === UserRole.ADMIN && (
                <div className="flex bg-gray-100 p-1 rounded-lg">
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
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5 shadow-sm">
              <h3 className="text-xs font-bold text-indigo-700 uppercase tracking-wider mb-4 flex items-center">
                <i className="fas fa-poll-h mr-2"></i> 已產生成績摘要 ({completedMatches.length})
              </h3>
              <div className="flex flex-wrap gap-3">
                {completedMatches.map(t => (
                  <div key={t.tableNumber} className="bg-white px-4 py-2.5 rounded-xl shadow-sm border border-indigo-100 flex items-center space-x-3">
                    <span className="font-bold text-indigo-600 text-[16px]">第{t.tableNumber}桌:</span>
                    <span className="text-slate-700 text-[16px] font-medium">{t.player1.name}</span>
                    <span className={`font-black px-2 py-0.5 rounded text-[16px] ${
                      t.result === GameResult.WIN ? 'bg-green-100 text-green-700' : 
                      t.result === GameResult.LOSS ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {t.result}
                    </span>
                    <span className="text-slate-700 text-[16px] font-medium">{t.player2.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedTables.map(table => (
              <div key={table.tableNumber} className="bg-white rounded-xl shadow-sm border hover:shadow-md transition overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b flex justify-between items-center">
                  <span className="font-bold text-indigo-600">第 {table.tableNumber} 桌</span>
                </div>
                
                <div className="p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="text-center flex-1">
                      <p className="text-xs text-gray-500">先手 (P1)</p>
                      <p className="font-bold text-gray-800 truncate">{table.player1.name}</p>
                      <p className="text-[10px] text-gray-400">#{table.player1.id}</p>
                    </div>
                    <div className="px-4 text-gray-300 italic font-light">vs</div>
                    <div className="text-center flex-1">
                      <p className="text-xs text-gray-500">後手 (P2)</p>
                      <p className="font-bold text-gray-800 truncate">{table.player2.name}</p>
                      <p className="text-[10px] text-gray-400">#{table.player2.id}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                    <div>
                      <span className="text-xs text-gray-400 block">結果</span>
                      <span className={`inline-block px-4 py-1 rounded-full text-lg font-black ${
                        table.result === GameResult.WIN ? 'text-green-600' : 
                        table.result === GameResult.LOSS ? 'text-red-600' : 
                        table.result === GameResult.DRAW ? 'text-amber-600' : 'text-gray-300'
                      }`}>
                        {table.result}
                      </span>
                    </div>

                    <div className="text-right">
                       {editingTable?.tableNumber === table.tableNumber ? (
                         <div className="flex flex-col space-y-2">
                            <select 
                              value={editResult}
                              onChange={(e) => setEditResult(e.target.value as GameResult)}
                              className="text-xs border rounded p-1"
                            >
                              {Object.values(GameResult).map(r => (
                                <option key={r} value={r}>{r}</option>
                              ))}
                            </select>
                            <div className="flex space-x-1">
                              <button onClick={saveEdit} className="bg-indigo-500 text-white p-1 rounded text-[10px]">儲存</button>
                              <button onClick={() => setEditingTable(null)} className="bg-gray-300 text-gray-700 p-1 rounded text-[10px]">取消</button>
                            </div>
                         </div>
                       ) : (
                         <>
                           {isAuthorized && selectedSession.status === MatchStatus.OPEN && (
                             <button 
                               onClick={() => handleEdit(table)}
                               className="text-indigo-500 hover:text-indigo-700 text-xs font-semibold"
                             >
                               <i className="fas fa-edit mr-1"></i> 修改結果
                             </button>
                           )}
                           {table.submittedBy && (
                             <p className="text-[9px] text-gray-400 mt-1 leading-tight">
                               由 <span className="font-semibold">{table.submittedBy}</span> 送出<br/>
                               {table.updatedAt && new Date(table.updatedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                             </p>
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
        <div className="text-center py-20 bg-white rounded-xl shadow-sm border animate-pulse">
          <i className="fas fa-search text-5xl text-gray-200 mb-4"></i>
          <h3 className="text-xl font-medium text-gray-400">請從上方選單選擇想查看的場次</h3>
        </div>
      )}
    </div>
  );
};

export default ResultsBoard;
