
import React, { useState, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import * as XLSX from 'xlsx';
import { MatchSession, MatchStatus, TableMatch, GameResult } from '../types.ts';
import { storageService } from '../services/storage.ts';

interface AdminPanelProps {
  onSessionCreated: () => void;
  currentSyncId?: string;
  setSyncId: (id: string) => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ onSessionCreated, currentSyncId, setSyncId }) => {
  const [sessions, setSessions] = useState<MatchSession[]>([]);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  
  const [title, setTitle] = useState('');
  const [refereeInput, setRefereeInput] = useState('');
  const [referees, setReferees] = useState<string[]>([]);
  const [tables, setTables] = useState<Partial<TableMatch>[]>([
    { tableNumber: 1, player1: { id: '', name: '' }, player2: { id: '', name: '' }, result: GameResult.PENDING }
  ]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = () => {
    setSessions(storageService.getSessions());
  };

  const handleStartCloudSync = async () => {
    if (sessions.length === 0) return alert('請先建立至少一個比賽場次再發布');
    setIsPublishing(true);
    const binId = await storageService.cloud.createBin(sessions);
    if (binId) {
      setSyncId(binId);
      alert(`雲端同步已開啟！\n同步代碼為: ${binId}\n請將此代碼分享給裁判與選手。`);
    } else {
      alert('發布失敗，請稍後再試');
    }
    setIsPublishing(false);
  };

  const copyShareLink = () => {
    if (!currentSyncId) return;
    const url = `${window.location.origin}${window.location.pathname}?sid=${currentSyncId}`;
    navigator.clipboard.writeText(url);
    alert('分享連結已複製！發送此連結給他人可直接進入同步模式。');
  };

  const addReferee = () => {
    const rawInput = refereeInput.trim();
    if (!rawInput) return;
    const names = rawInput.split(/[,，]/).map(name => name.trim()).filter(name => name !== '');
    setReferees(prev => [...new Set([...prev, ...names])]);
    setRefereeInput('');
  };

  const removeReferee = (name: string) => setReferees(referees.filter(r => r !== name));

  const addTable = () => {
    const nextNum = tables.length > 0 ? Math.max(...tables.map(t => t.tableNumber || 0)) + 1 : 1;
    setTables([...tables, { tableNumber: nextNum, player1: { id: '', name: '' }, player2: { id: '', name: '' }, result: GameResult.PENDING }]);
  };

  const updateTable = (index: number, field: string, value: any) => {
    const newTables = [...tables];
    const target = { ...newTables[index] };
    if (field === 'p1Id') target.player1 = { ...target.player1!, id: value };
    else if (field === 'p1Name') target.player1 = { ...target.player1!, name: value };
    else if (field === 'p2Id') target.player2 = { ...target.player2!, id: value };
    else if (field === 'p2Name') target.player2 = { ...target.player2!, name: value };
    else if (field === 'tableNumber') target.tableNumber = parseInt(value) || 0;
    newTables[index] = target;
    setTables(newTables);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || referees.length === 0) return alert('請完整輸入標題與裁判');

    const sessionData = {
      title, referees,
      tables: tables.map(t => ({
        ...t,
        tableNumber: t.tableNumber || 0,
        player1: t.player1 || { id: '', name: '' },
        player2: t.player2 || { id: '', name: '' },
        result: t.result || GameResult.PENDING
      } as TableMatch))
    };

    if (editingSessionId) {
      const existing = sessions.find(s => s.id === editingSessionId);
      if (existing) storageService.updateSession({ ...existing, ...sessionData });
    } else {
      storageService.addSession({ id: uuidv4(), status: MatchStatus.OPEN, createdAt: new Date().toISOString(), ...sessionData });
    }
    
    resetForm();
    onSessionCreated();
    loadSessions();
  };

  const resetForm = () => {
    setTitle(''); setReferees([]); setEditingSessionId(null);
    setTables([{ tableNumber: 1, player1: { id: '', name: '' }, player2: { id: '', name: '' }, result: GameResult.PENDING }]);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('確定刪除？')) {
      storageService.deleteSession(id);
      loadSessions();
      onSessionCreated();
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-20">
      {/* 雲端同步區 */}
      <section className="bg-indigo-50 border-2 border-indigo-200 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-indigo-900 flex items-center">
              <i className="fas fa-cloud-upload-alt mr-2"></i>
              跨裝置同步設定
            </h2>
            <p className="text-sm text-indigo-700 mt-1">開啟雲端同步後，其他使用者只需輸入代碼即可即時觀看您的資料。</p>
          </div>
          {currentSyncId ? (
            <div className="flex items-center space-x-3">
              <div className="bg-white px-4 py-2 rounded-xl border-2 border-indigo-300 font-mono font-black text-indigo-600 text-lg">
                ID: {currentSyncId}
              </div>
              <button onClick={copyShareLink} className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-indigo-700 transition">
                <i className="fas fa-share-alt mr-2"></i>複製連結
              </button>
            </div>
          ) : (
            <button 
              onClick={handleStartCloudSync} 
              disabled={isPublishing}
              className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-black hover:bg-indigo-700 transition shadow-lg disabled:opacity-50"
            >
              {isPublishing ? '發布中...' : '開啟雲端即時同步'}
            </button>
          )}
        </div>
      </section>

      {/* 場次列表 */}
      <section className="bg-white rounded-2xl shadow-sm border overflow-hidden">
        <div className="bg-slate-50 px-6 py-4 border-b flex justify-between items-center">
          <h2 className="text-xl font-bold text-slate-800">現有場次</h2>
          <span className="text-xs font-bold text-slate-400">若有變更，雲端將自動更新</span>
        </div>
        <div className="divide-y">
          {sessions.map(s => (
            <div key={s.id} className="p-4 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-slate-800">{s.title}</h3>
                <p className="text-[10px] text-gray-400">桌數: {s.tables.length} | 裁判: {s.referees.length}</p>
              </div>
              <div className="flex space-x-2">
                <button onClick={() => {setEditingSessionId(s.id); setTitle(s.title); setReferees(s.referees); setTables(s.tables);}} className="text-indigo-600 p-2"><i className="fas fa-edit"></i></button>
                <button onClick={() => handleDelete(s.id)} className="text-red-500 p-2"><i className="fas fa-trash"></i></button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 表單 */}
      <div ref={formRef} className="bg-white rounded-2xl shadow-xl p-8 border">
        <h2 className="text-2xl font-black text-slate-800 mb-6">{editingSessionId ? '修改場次' : '建立場次'}</h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-600">標題</label>
              <input type="text" value={title} onChange={e=>setTitle(e.target.value)} className="w-full p-3 border rounded-xl" placeholder="例：年度決賽" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-600">裁判 (逗號分隔)</label>
              <div className="flex space-x-2">
                <input type="text" value={refereeInput} onChange={e=>setRefereeInput(e.target.value)} className="flex-grow p-3 border rounded-xl" placeholder="輸入姓名" />
                <button type="button" onClick={addReferee} className="bg-slate-800 text-white px-4 rounded-xl">新增</button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {referees.map(r => (
                  <span key={r} className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold border flex items-center">
                    {r} <button onClick={()=>removeReferee(r)} className="ml-2 text-red-400"><i className="fas fa-times"></i></button>
                  </span>
                ))}
              </div>
            </div>
          </div>
          
          <div className="pt-4 border-t">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold">桌次配置</h3>
              <button type="button" onClick={addTable} className="text-indigo-600 text-sm font-bold">+ 新增一桌</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr><th className="p-2 text-left">桌號</th><th className="p-2 text-left">先手</th><th className="p-2 text-left">後手</th><th className="p-2 w-10"></th></tr>
                </thead>
                <tbody>
                  {tables.map((t, idx) => (
                    <tr key={idx} className="border-b">
                      <td className="p-2"><input type="number" value={t.tableNumber} onChange={e=>updateTable(idx,'tableNumber',e.target.value)} className="w-16 p-1 border rounded" /></td>
                      <td className="p-2 flex space-x-1">
                        <input type="text" placeholder="ID" value={t.player1?.id} onChange={e=>updateTable(idx,'p1Id',e.target.value)} className="w-12 p-1 border rounded text-xs" />
                        <input type="text" placeholder="姓名" value={t.player1?.name} onChange={e=>updateTable(idx,'p1Name',e.target.value)} className="w-full p-1 border rounded text-xs" />
                      </td>
                      <td className="p-2 flex space-x-1">
                        <input type="text" placeholder="ID" value={t.player2?.id} onChange={e=>updateTable(idx,'p2Id',e.target.value)} className="w-12 p-1 border rounded text-xs" />
                        <input type="text" placeholder="姓名" value={t.player2?.name} onChange={e=>updateTable(idx,'p2Name',e.target.value)} className="w-full p-1 border rounded text-xs" />
                      </td>
                      <td className="p-2 text-center"><button type="button" onClick={()=>setTables(tables.filter((_,i)=>i!==idx))} className="text-red-400"><i className="fas fa-trash"></i></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <button type="submit" className="w-full py-4 bg-indigo-600 text-white rounded-xl font-black text-lg shadow-lg">儲存場次</button>
        </form>
      </div>
    </div>
  );
};

export default AdminPanel;
