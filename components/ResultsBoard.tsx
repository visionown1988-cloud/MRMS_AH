
import React, { useState, useMemo } from 'react';
import { MatchSession, UserRole, MatchStatus, TableMatch, GameResult, ScoringConfig } from '../types.ts';
import { storageService } from '../services/storage.ts';

interface ResultsBoardProps {
  sessions: MatchSession[];
  userRole: UserRole;
  onRefresh: () => void;
}

type ViewMode = 'board' | 'table';

interface PlayerScore {
  id: string;
  name: string;
  points: number;
  winCount: number;
  lossCount: number;
  drawCount: number;
  matchCount: number;
}

const ResultsBoard: React.FC<ResultsBoardProps> = ({ sessions, userRole, onRefresh }) => {
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [viewMode, setViewMode] = useState<ViewMode>('board');
  const [editingTable, setEditingTable] = useState<{ sessionId: string, tableNumber: number } | null>(null);
  const [editResult, setEditResult] = useState<GameResult>(GameResult.PENDING);

  const selectedSession = sessions.find(s => s.id === selectedSessionId);
  const isAuthorized = userRole === UserRole.ADMIN || userRole === UserRole.REFEREE;

  const getMatchPoints = (table: TableMatch, session: MatchSession) => {
    if (table.result === GameResult.PENDING) return { p1: 0, p2: 0 };
    const config = session.scoringConfig || {
      win: { p1: 1, p2: 0 },
      loss: { p1: 0, p2: 1 },
      draw: { p1: 0.5, p2: 0.5 }
    };
    if (table.result === GameResult.WIN) return config.win;
    if (table.result === GameResult.LOSS) return config.loss;
    if (table.result === GameResult.DRAW) return config.draw;
    return { p1: 0, p2: 0 };
  };

  // 計算所有選手積分
  const playerScores = useMemo(() => {
    if (!selectedSession) return [];
    const scoreMap: Record<string, PlayerScore> = {};
    const config: ScoringConfig = selectedSession.scoringConfig || {
      win: { p1: 1, p2: 0 },
      loss: { p1: 0, p2: 1 },
      draw: { p1: 0.5, p2: 0.5 }
    };

    selectedSession.tables.forEach(t => {
      // 初始化選手資料
      const ensurePlayer = (id: string, name: string) => {
        if (!scoreMap[id]) {
          scoreMap[id] = { id, name, points: 0, winCount: 0, lossCount: 0, drawCount: 0, matchCount: 0 };
        }
      };
      
      ensurePlayer(t.player1.id, t.player1.name);
      ensurePlayer(t.player2.id, t.player2.name);

      if (t.result === GameResult.PENDING) return;

      const p1 = scoreMap[t.player1.id];
      const p2 = scoreMap[t.player2.id];
      
      p1.matchCount++;
      p2.matchCount++;

      if (t.result === GameResult.WIN) {
        p1.points += config.win.p1;
        p2.points += config.win.p2;
        p1.winCount++;
        p2.lossCount++;
      } else if (t.result === GameResult.LOSS) {
        p1.points += config.loss.p1;
        p2.points += config.loss.p2;
        p1.lossCount++;
        p2.winCount++;
      } else if (t.result === GameResult.DRAW) {
        p1.points += config.draw.p1;
        p2.points += config.draw.p2;
        p1.drawCount++;
        p2.drawCount++;
      }
    });

    return Object.values(scoreMap).sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
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
        return { ...t, result: editResult, updatedAt: new Date().toISOString(), submittedBy: '後台修改' };
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
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <i className="fas fa-layer-group text-indigo-500"></i>
            <label className="font-bold text-gray-700">比賽場次</label>
          </div>
          {selectedSession && (
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button 
                onClick={() => setViewMode('board')} 
                className={`flex items-center space-x-2 px-4 py-1.5 rounded-lg text-xs font-bold transition ${viewMode === 'board' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}
              >
                <i className="fas fa-th-large"></i><span>看板模式</span>
              </button>
              <button 
                onClick={() => setViewMode('table')} 
                className={`flex items-center space-x-2 px-4 py-1.5 rounded-lg text-xs font-bold transition ${viewMode === 'table' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}
              >
                <i className="fas fa-list-ol"></i><span>表格積分</span>
              </button>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          {sessions.map(s => (
            <button key={s.id} onClick={() => setSelectedSessionId(s.id)} className={`px-5 py-2.5 rounded-xl text-base font-bold border-2 transition-all ${selectedSessionId === s.id ? 'bg-indigo-600 text-white border-indigo-600 shadow-md scale-105' : 'bg-white text-gray-600 border-gray-100 hover:border-indigo-200'}`}>{s.title}</button>
          ))}
        </div>
      </div>

      {selectedSession ? (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl shadow-md border-l-4 border-indigo-500">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">{selectedSession.title}</h2>
              <p className="text-xs text-gray-500">建立：{new Date(selectedSession.createdAt).toLocaleString()}</p>
            </div>
            <div className="flex items-center space-x-3">
              <span className={`px-3 py-1 rounded-full text-sm font-bold ${selectedSession.status === MatchStatus.OPEN ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{selectedSession.status === MatchStatus.OPEN ? '● 開放中' : '● 已截止'}</span>
              {userRole === UserRole.ADMIN && (
                <div className="flex bg-gray-100 p-1 rounded-lg">
                  <button onClick={() => toggleStatus(selectedSession, MatchStatus.OPEN)} className={`px-3 py-1 rounded-md text-xs font-bold ${selectedSession.status === MatchStatus.OPEN ? 'bg-white text-green-600 shadow-sm' : 'text-gray-400'}`}>開放</button>
                  <button onClick={() => toggleStatus(selectedSession, MatchStatus.CLOSED)} className={`px-3 py-1 rounded-md text-xs font-bold ${selectedSession.status === MatchStatus.CLOSED ? 'bg-white text-red-600 shadow-sm' : 'text-gray-400'}`}>截止</button>
                </div>
              )}
            </div>
          </div>

          {viewMode === 'board' ? (
            <>
              {completedMatches.length > 0 && (
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5 shadow-sm">
                  <h3 className="text-xs font-bold text-indigo-700 uppercase tracking-wider mb-4 flex items-center">
                    <i className="fas fa-poll-h mr-2"></i> 已產生成績摘要 ({completedMatches.length})
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {completedMatches.map(t => {
                      const pts = getMatchPoints(t, selectedSession);
                      return (
                        <div key={t.tableNumber} className="bg-white p-4 rounded-xl shadow-sm border border-indigo-100 flex items-center justify-between min-w-[200px]">
                          <div className="flex flex-col min-w-0 flex-1">
                            <span className="font-bold text-indigo-600 text-[10px]">抬號 {t.tableNumber}</span>
                            <div className="flex items-center space-x-1 mt-1">
                              <span className="text-slate-800 text-sm font-black whitespace-nowrap">{t.player1.name}</span>
                              <span className="bg-green-100 text-green-600 text-[9px] px-1 rounded font-bold">+{pts.p1}</span>
                            </div>
                          </div>
                          <span className={`mx-3 font-black px-2 py-1 rounded text-sm whitespace-nowrap ${t.result === GameResult.WIN ? 'bg-green-100 text-green-700' : t.result === GameResult.LOSS ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{t.result}</span>
                          <div className="flex flex-col min-w-0 flex-1 text-right">
                            <span className="text-[10px] text-gray-300">.</span>
                            <div className="flex items-center space-x-1 justify-end mt-1">
                              <span className="bg-blue-100 text-blue-600 text-[9px] px-1 rounded font-bold">+{pts.p2}</span>
                              <span className="text-slate-800 text-sm font-black whitespace-nowrap">{t.player2.name}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sortedTables.map(table => {
                  const pts = getMatchPoints(table, selectedSession);
                  return (
                    <div key={table.tableNumber} className="bg-white rounded-xl shadow-sm border hover:shadow-md transition overflow-hidden">
                      <div className="bg-gray-50 px-4 py-2 border-b flex justify-between items-center"><span className="font-bold text-indigo-600">第 {table.tableNumber} 桌</span></div>
                      <div className="p-4 space-y-4">
                        <div className="flex items-center justify-between text-center">
                          <div className="flex-1">
                            <p className="text-xs text-gray-500">先手</p>
                            <p className="font-bold text-gray-800">{table.player1.name}</p>
                            <div className="flex items-center justify-center space-x-1">
                              <span className="text-[10px] text-indigo-500 font-black">#{table.player1.id}</span>
                              {table.result !== GameResult.PENDING && <span className="text-[10px] bg-green-50 text-green-600 px-1 rounded font-bold">+{pts.p1}分</span>}
                            </div>
                          </div>
                          <div className="px-4 text-gray-300 italic font-light">vs</div>
                          <div className="flex-1">
                            <p className="text-xs text-gray-500">後手</p>
                            <p className="font-bold text-gray-800">{table.player2.name}</p>
                            <div className="flex items-center justify-center space-x-1">
                              <span className="text-[10px] text-indigo-500 font-black">#{table.player2.id}</span>
                              {table.result !== GameResult.PENDING && <span className="text-[10px] bg-blue-50 text-blue-600 px-1 rounded font-bold">+{pts.p2}分</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                          <div><span className="text-xs text-gray-400 block">結果</span><span className={`inline-block px-4 py-1 rounded-full text-lg font-black ${table.result === GameResult.WIN ? 'text-green-600' : table.result === GameResult.LOSS ? 'text-red-600' : table.result === GameResult.DRAW ? 'text-amber-600' : 'text-gray-300'}`}>{table.result}</span></div>
                          <div className="text-right">
                            {editingTable?.tableNumber === table.tableNumber ? (
                              <div className="flex flex-col space-y-1"><select value={editResult} onChange={(e)=>setEditResult(e.target.value as GameResult)} className="text-xs border rounded p-1">{Object.values(GameResult).map(r=><option key={r} value={r}>{r}</option>)}</select><div className="flex space-x-1"><button onClick={saveEdit} className="bg-indigo-500 text-white p-1 rounded text-[10px]">儲存</button><button onClick={()=>setEditingTable(null)} className="bg-gray-300 p-1 rounded text-[10px]">取消</button></div></div>
                            ) : (isAuthorized && selectedSession.status === MatchStatus.OPEN && <button onClick={()=>handleEdit(table)} className="text-indigo-500 text-xs font-semibold hover:underline"><i className="fas fa-edit mr-1"></i>修改</button>)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-800 text-white font-bold uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-4">選手編號</th>
                      <th className="px-6 py-4">姓名</th>
                      <th className="px-6 py-4 text-center">總積分</th>
                      <th className="px-6 py-4">勝/負/和</th>
                      <th className="px-6 py-4">完賽桌數</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {playerScores.map(player => (
                      <tr key={player.id} className="hover:bg-slate-50 transition">
                        <td className="px-6 py-4 font-black text-indigo-600">#{player.id}</td>
                        <td className="px-6 py-4 font-bold text-gray-800">{player.name}</td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-block px-3 py-1 bg-amber-100 text-amber-700 rounded-full font-black text-lg">
                            {player.points}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex space-x-2 text-xs font-bold">
                            <span className="text-green-600">{player.winCount}勝</span>
                            <span className="text-red-500">{player.lossCount}負</span>
                            <span className="text-slate-400">{player.drawCount}和</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-gray-500 font-medium">
                          {player.matchCount} 局
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-20 bg-white rounded-xl shadow-sm border border-gray-100"><i className="fas fa-hand-pointer text-5xl text-gray-200 mb-4 animate-bounce"></i><h3 className="text-xl font-medium text-gray-400">請選擇比賽場次</h3></div>
      )}
    </div>
  );
};

export default ResultsBoard;
