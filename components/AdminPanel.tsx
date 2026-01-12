
import React, { useState, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import * as XLSX from 'xlsx';
import { MatchSession, MatchStatus, TableMatch, GameResult } from '../types.ts';
import { storageService } from '../services/storage.ts';

interface AdminPanelProps {
  sessions: MatchSession[];
  onSessionCreated: () => void;
  currentSyncId?: string;
  setSyncId: (id: string) => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ sessions, onSessionCreated, currentSyncId, setSyncId }) => {
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

  const handleStartCloudSync = async () => {
    if (sessions.length === 0) return alert('請先建立至少一個比賽場次再發布');
    setIsPublishing(true);
    // 取得最新本地資料上傳
    const latestSessions = storageService.getSessions();
    const binId = await storageService.cloud.createBin(latestSessions);
    if (binId) {
      setSyncId(binId);
      alert(`雲端同步已開啟！\n代碼為: ${binId}\n分享此代碼讓他人即時同步。`);
    } else {
      alert('發布失敗，請確認網路連線。');
    }
    setIsPublishing(false);
  };

  const copyShareLink = () => {
    if (!currentSyncId) return;
    const url = `${window.location.origin}${window.location.pathname}?sid=${currentSyncId}`;
    navigator.clipboard.writeText(url);
    alert('連結已複製！');
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
    onSessionCreated(); // 這會觸發 App 的同步邏輯
  };

  const resetForm = () => {
    setTitle(''); setReferees([]); setEditingSessionId(null);
    setTables([{ tableNumber: 1, player1: { id: '', name: '' }, player2: { id: '', name: '' }, result: GameResult.PENDING }]);
  };

  const handleEdit = (s: MatchSession) => {
    setEditingSessionId(s.id);
    setTitle(s.title);
    setReferees(s.referees);
    setTables(s.tables);
    formRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleDelete = (id: string) => {
    if (window.confirm('確定刪除？')) {
      storageService.deleteSession(id);
      onSessionCreated();
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-20 animate-in fade-in duration-500">
      {/* 雲端同步區 */}
      <section className={`rounded-2xl p-6 shadow-sm border-2 transition-colors ${currentSyncId ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-200'}`}>
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h2 className={`text-xl font-black flex items-center ${currentSyncId ? 'text-indigo-900' : 'text-slate-700'}`}>
              <i className={`fas ${currentSyncId ? 'fa-cloud-check text-indigo-500' : 'fa-cloud-upload text-slate-400'} mr-2`}></i>
              雲端同步狀態
            </h2>
            <p className="text-sm mt-1 text-slate-500">
              {currentSyncId ? '目前的場次資料已與雲端同步。' : '尚未發布至雲端，目前的資料僅存於此裝置。'}
            </p>
          </div>
          {currentSyncId ? (
            <div className="flex items-center space-x-2">
              <div className="bg-white px-4 py-2 rounded-xl border-2 border-indigo-100 font-mono font-black text-indigo-600">
                {currentSyncId}
              </div>
              <button onClick={copyShareLink} className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-indigo-700 shadow-md transition">
                <i className="fas fa-link mr-2"></i>複製分享連結
              </button>
            </div>
          ) : (
            <button 
              onClick={handleStartCloudSync} 
              disabled={isPublishing}
              className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-black hover:bg-indigo-700 transition shadow-lg disabled:opacity-50 flex items-center"
            >
              {isPublishing && <i className="fas fa-spinner fa-spin mr-2"></i>}
              {isPublishing ? '發布中...' : '發布至雲端 (開啟跨裝置同步)'}
            </button>
          )}
        </div>
      </section>

      {/* 場次列表 */}
      {sessions.length > 0 && (
        <section className="bg-white rounded-2xl shadow-sm border overflow-hidden">
          <div className="bg-slate-50 px-6 py-4 border-b flex justify-between items-center">
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-widest">目前場次 ({sessions.length})</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {sessions.map(s => (
              <div key={s.id} className="p-4 flex justify-between items-center hover:bg-slate-50/50 transition">
                <div>
                  <h3 className="font-bold text-slate-800">{s.title}</h3>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${s.status === MatchStatus.OPEN ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                      {s.status === MatchStatus.OPEN ? '紀錄中' : '已截止'}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      <i className="fas fa-table mr-1"></i>{s.tables.length} 桌
                    </span>
                  </div>
                </div>
                <div className="flex space-x-1">
                  <button onClick={() => handleEdit(s)} className="text-indigo-600 w-10 h-10 rounded-full hover:bg-indigo-50 transition flex items-center justify-center"><i className="fas fa-edit"></i></button>
                  <button onClick={() => handleDelete(s.id)} className="text-red-500 w-10 h-10 rounded-full hover:bg-red-50 transition flex items-center justify-center"><i className="fas fa-trash-alt"></i></button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 表單 */}
      <div ref={formRef} className="bg-white rounded-2xl shadow-xl p-8 border border-slate-100">
        <h2 className="text-2xl font-black text-slate-800 mb-8 flex items-center">
          <span className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center mr-3 text-sm">
            <i className={`fas ${editingSessionId ? 'fa-pen' : 'fa-plus'}`}></i>
          </span>
          {editingSessionId ? '修改場次內容' : '建立新比賽場次'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest">場次標題</label>
              <input type="text" value={title} onChange={e=>setTitle(e.target.value)} className="w-full p-3 border-2 border-slate-100 rounded-xl focus:border-indigo-500 outline-none transition" placeholder="例：2024 夏季杯複賽" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest">裁判名單</label>
              <div className="flex space-x-2">
                <input type="text" value={refereeInput} onChange={e=>setRefereeInput(e.target.value)} onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), addReferee())} className="flex-grow p-3 border-2 border-slate-100 rounded-xl focus:border-indigo-500 outline-none transition" placeholder="姓名" />
                <button type="button" onClick={addReferee} className="bg-slate-800 text-white px-6 rounded-xl font-bold hover:bg-slate-700 transition">新增</button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {referees.map(r => (
                  <span key={r} className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold border border-indigo-100 flex items-center">
                    {r} <button type="button" onClick={()=>removeReferee(r)} className="ml-2 text-indigo-300 hover:text-red-500 transition"><i className="fas fa-times-circle"></i></button>
                  </span>
                ))}
              </div>
            </div>
          </div>
          
          <div className="pt-6 border-t border-slate-50">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-black text-slate-800 tracking-tight">桌次配置與對手</h3>
              <div className="flex space-x-2">
                <button type="button" onClick={addTable} className="text-indigo-600 bg-indigo-50 px-4 py-2 rounded-lg text-xs font-black hover:bg-indigo-100 transition"><i className="fas fa-plus mr-2"></i>新增一桌</button>
              </div>
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-100">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-slate-500"><th className="p-3 text-left w-20">桌號</th><th className="p-3 text-left">先手 P1</th><th className="p-3 text-left">後手 P2</th><th className="p-3 w-10"></th></tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {tables.map((t, idx) => (
                    <tr key={idx}>
                      <td className="p-3"><input type="number" value={t.tableNumber} onChange={e=>updateTable(idx,'tableNumber',e.target.value)} className="w-16 p-2 border rounded-lg text-center font-bold outline-none focus:border-indigo-400" /></td>
                      <td className="p-3 flex space-x-2">
                        <input type="text" placeholder="ID" value={t.player1?.id} onChange={e=>updateTable(idx,'p1Id',e.target.value)} className="w-16 p-2 border rounded-lg text-xs" />
                        <input type="text" placeholder="姓名" value={t.player1?.name} onChange={e=>updateTable(idx,'p1Name',e.target.value)} className="w-full p-2 border rounded-lg text-xs" />
                      </td>
                      <td className="p-3 flex space-x-2">
                        <input type="text" placeholder="ID" value={t.player2?.id} onChange={e=>updateTable(idx,'p2Id',e.target.value)} className="w-16 p-2 border rounded-lg text-xs" />
                        <input type="text" placeholder="姓名" value={t.player2?.name} onChange={e=>updateTable(idx,'p2Name',e.target.value)} className="w-full p-2 border rounded-lg text-xs" />
                      </td>
                      <td className="p-3 text-center"><button type="button" onClick={()=>setTables(tables.filter((_,i)=>i!==idx))} className="text-slate-300 hover:text-red-500 transition"><i className="fas fa-trash"></i></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="flex space-x-3 pt-6">
            <button type="submit" className="flex-grow py-4 bg-indigo-600 text-white rounded-2xl font-black text-lg shadow-xl shadow-indigo-100 hover:bg-indigo-700 active:scale-[0.98] transition-all">
              {editingSessionId ? '儲存修改內容' : '確認建立場次'}
            </button>
            {editingSessionId && (
              <button type="button" onClick={resetForm} className="px-8 py-4 bg-slate-100 text-slate-500 rounded-2xl font-bold hover:bg-slate-200 transition">取消</button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminPanel;
