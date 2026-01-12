
import React, { useState, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import * as XLSX from 'xlsx';
import { MatchSession, MatchStatus, TableMatch, GameResult, ScoringConfig } from '../types.ts';
import { storageService } from '../services/storage.ts';

interface AdminPanelProps {
  sessions: MatchSession[];
  onSessionCreated: () => void;
}

const DEFAULT_SCORING: ScoringConfig = {
  win: { p1: 1, p2: 0 },
  loss: { p1: 0, p2: 1 },
  draw: { p1: 0.5, p2: 0.5 }
};

const AdminPanel: React.FC<AdminPanelProps> = ({ sessions, onSessionCreated }) => {
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  
  const [currentRefereePassword, setCurrentRefereePassword] = useState('');
  const [newRefereePassword, setNewRefereePassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const [title, setTitle] = useState('');
  const [refereeInput, setRefereeInput] = useState('');
  const [referees, setReferees] = useState<string[]>([]);
  const [scoring, setScoring] = useState<ScoringConfig>(DEFAULT_SCORING);
  const [tables, setTables] = useState<Partial<TableMatch>[]>([
    { tableNumber: 1, player1: { id: '', name: '' }, player2: { id: '', name: '' }, result: GameResult.PENDING }
  ]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const settings = await storageService.getSettings();
    if (settings && settings.refereePassword) {
      setCurrentRefereePassword(settings.refereePassword);
    }
  };

  const toggleSessionStatus = async (session: MatchSession) => {
    const newStatus = session.status === MatchStatus.OPEN ? MatchStatus.CLOSED : MatchStatus.OPEN;
    await storageService.updateSession({ ...session, status: newStatus });
  };

  const handleUpdatePassword = async () => {
    if (!newRefereePassword) return alert('請輸入新密碼');
    if (newRefereePassword.length < 4) return alert('密碼長度建議至少 4 位');
    setIsUpdatingPassword(true);
    try {
      await storageService.updateRefereePassword(newRefereePassword);
      alert('密碼已更新');
      setCurrentRefereePassword(newRefereePassword);
      setNewRefereePassword('');
    } catch (e) {
      alert('更新失敗');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const addReferee = () => {
    const rawInput = refereeInput.trim();
    if (!rawInput) return;
    const names = rawInput.split(/[,，]/).map(name => name.trim()).filter(name => name !== '');
    if (names.length > 0) {
      setReferees(prev => {
        const nextReferees = [...prev];
        names.forEach(name => {
          if (!nextReferees.includes(name)) nextReferees.push(name);
        });
        return nextReferees;
      });
      setRefereeInput('');
    }
  };

  const removeReferee = (name: string) => {
    setReferees(referees.filter(r => r !== name));
  };

  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];
        
        const importedTables: Partial<TableMatch>[] = jsonData.map((row: any, idx) => ({
          tableNumber: parseInt(row['抬號'] || row['桌號'] || row['Table'] || (idx + 1)),
          player1: { 
            id: String(row['先手編號'] || row['先手ID'] || row['P1 ID'] || ''), 
            name: String(row['先手姓名'] || row['P1 Name'] || '') 
          },
          player2: { 
            id: String(row['後手編號'] || row['後手ID'] || row['P2 ID'] || ''), 
            name: String(row['後手姓名'] || row['P2 Name'] || '') 
          },
          result: GameResult.PENDING
        }));
        setTables(importedTables);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } catch (err) {
        alert('解析 Excel 失敗');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleExportExcel = (session: MatchSession) => {
    const exportData = session.tables.map(t => {
      let p1Score = 0;
      let p2Score = 0;
      if (t.result === GameResult.WIN) {
        p1Score = session.scoringConfig?.win.p1 ?? 1;
        p2Score = session.scoringConfig?.win.p2 ?? 0;
      } else if (t.result === GameResult.LOSS) {
        p1Score = session.scoringConfig?.loss.p1 ?? 0;
        p2Score = session.scoringConfig?.loss.p2 ?? 1;
      } else if (t.result === GameResult.DRAW) {
        p1Score = session.scoringConfig?.draw.p1 ?? 0.5;
        p2Score = session.scoringConfig?.draw.p2 ?? 0.5;
      }

      return {
        '抬號': t.tableNumber,
        '先手編號': t.player1.id,
        '先手姓名': t.player1.name,
        '先手得分': t.result !== GameResult.PENDING ? p1Score : '',
        '後手編號': t.player2.id,
        '後手姓名': t.player2.name,
        '後手得分': t.result !== GameResult.PENDING ? p2Score : '',
        '結果': t.result,
        '送出裁判': t.submittedBy || '',
        '更新時間': t.updatedAt ? new Date(t.updatedAt).toLocaleString() : ''
      };
    });
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '對賽紀錄');
    XLSX.writeFile(workbook, `${session.title}_對賽紀錄.xlsx`);
  };

  const handleExportExcelSummary = (session: MatchSession) => {
    const scoreMap: Record<string, { id: string, name: string, points: number, win: number, loss: number, draw: number, total: number }> = {};
    const config = session.scoringConfig || DEFAULT_SCORING;

    session.tables.forEach(t => {
      const ensurePlayer = (id: string, name: string) => {
        if (!scoreMap[id]) scoreMap[id] = { id, name, points: 0, win: 0, loss: 0, draw: 0, total: 0 };
      };
      ensurePlayer(t.player1.id, t.player1.name);
      ensurePlayer(t.player2.id, t.player2.name);

      if (t.result === GameResult.PENDING) return;

      const p1 = scoreMap[t.player1.id];
      const p2 = scoreMap[t.player2.id];
      p1.total++; p2.total++;

      if (t.result === GameResult.WIN) {
        p1.points += config.win.p1; p2.points += config.win.p2;
        p1.win++; p2.loss++;
      } else if (t.result === GameResult.LOSS) {
        p1.points += config.loss.p1; p2.points += config.loss.p2;
        p1.loss++; p2.win++;
      } else if (t.result === GameResult.DRAW) {
        p1.points += config.draw.p1; p2.points += config.draw.p2;
        p1.draw++; p2.draw++;
      }
    });

    const exportData = Object.values(scoreMap)
      .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))
      .map(p => ({
        '選手編號': p.id,
        '姓名': p.name,
        '總積分': p.points,
        '勝': p.win,
        '負': p.loss,
        '和': p.draw,
        '完賽桌數': p.total
      }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '積分總表');
    XLSX.writeFile(workbook, `${session.title}_積分總表.xlsx`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return alert('請輸入標題');
    if (referees.length === 0) return alert('請至少輸入一位裁判人員');
    
    const sessionData = {
      title,
      referees,
      scoringConfig: scoring,
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
      if (existing) await storageService.updateSession({ ...existing, ...sessionData });
      alert('場次已更新');
    } else {
      await storageService.addSession({ 
        id: uuidv4(), 
        status: MatchStatus.OPEN, 
        createdAt: new Date().toISOString(), 
        ...sessionData 
      } as MatchSession);
      alert('場次已建立');
    }
    resetForm();
    onSessionCreated();
  };

  const startEdit = (session: MatchSession) => {
    setEditingSessionId(session.id);
    setTitle(session.title);
    setReferees(session.referees || []);
    setScoring(session.scoringConfig || DEFAULT_SCORING);
    setTables(session.tables);
    formRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const resetForm = () => {
    setTitle(''); setReferees([]); setEditingSessionId(null); setScoring(DEFAULT_SCORING);
    setTables([{ tableNumber: 1, player1: { id: '', name: '' }, player2: { id: '', name: '' }, result: GameResult.PENDING }]);
  };

  const updateScoring = (outcome: keyof ScoringConfig, side: 'p1' | 'p2', value: string) => {
    const num = parseFloat(value) || 0;
    setScoring(prev => ({
      ...prev,
      [outcome]: { ...prev[outcome], [side]: num }
    }));
  };

  const addTable = () => {
    const nextNum = tables.length > 0 ? Math.max(...tables.map(t => t.tableNumber || 0)) + 1 : 1;
    setTables([...tables, { tableNumber: nextNum, player1: { id: '', name: '' }, player2: { id: '', name: '' }, result: GameResult.PENDING }]);
  };

  return (
    <div className="space-y-12 max-w-5xl mx-auto pb-20">
      <section className="bg-white rounded-2xl shadow-sm border border-red-100 overflow-hidden">
        <div className="bg-red-50 px-6 py-4 border-b border-red-100 flex justify-between items-center">
          <h2 className="text-xl font-bold text-red-800 flex items-center">
            <i className="fas fa-user-shield mr-2"></i>系統權限管理
          </h2>
        </div>
        <div className="p-6">
          <div className="max-w-md space-y-6">
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex justify-between items-center">
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">當前裁判密碼</p>
                <p className="text-2xl font-black text-slate-700 tracking-widest">{currentRefereePassword}</p>
              </div>
              <div className="bg-white p-2 rounded-lg shadow-sm"><i className="fas fa-key text-amber-500 text-xl"></i></div>
            </div>
            <div className="flex space-x-2">
              <input type="text" value={newRefereePassword} onChange={(e) => setNewRefereePassword(e.target.value)} className="flex-grow px-4 py-2 border rounded-xl" placeholder="新密碼..." />
              <button onClick={handleUpdatePassword} disabled={isUpdatingPassword} className="bg-red-600 text-white px-6 rounded-xl font-bold">確認更改</button>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-slate-50 px-6 py-4 border-b flex justify-between items-center">
          <h2 className="text-xl font-bold text-slate-800 flex items-center"><i className="fas fa-tasks text-indigo-500 mr-2"></i>場次管理</h2>
          <span className="bg-indigo-100 text-indigo-600 px-3 py-1 rounded-full text-xs font-bold">共 {sessions.length} 場</span>
        </div>
        <div className="divide-y divide-gray-100">
          {sessions.map(session => (
            <div key={session.id} className="p-5 flex flex-col md:flex-row justify-between items-center hover:bg-slate-50 transition gap-4">
              <div className="flex-grow">
                <h3 className="font-bold text-slate-800 text-lg">{session.title}</h3>
                <button onClick={() => toggleSessionStatus(session)} className={`mt-2 px-3 py-1 rounded-full text-xs font-bold text-white ${session.status === MatchStatus.OPEN ? 'bg-green-500' : 'bg-red-500'}`}>
                  {session.status === MatchStatus.OPEN ? '開放中' : '已截止'}
                </button>
              </div>
              <div className="flex space-x-1">
                <button onClick={() => handleExportExcel(session)} className="p-2.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition" title="匯出 對賽紀錄">
                  <i className="fas fa-file-excel text-xl"></i>
                </button>
                <button onClick={() => handleExportExcelSummary(session)} className="p-2.5 text-amber-600 hover:bg-amber-50 rounded-lg transition" title="匯出 積分總表 (依編號排序)">
                  <i className="fas fa-list-ol text-xl"></i>
                </button>
                <button onClick={() => startEdit(session)} className="p-2.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition" title="修改"><i className="fas fa-edit text-xl"></i></button>
                <button onClick={() => storageService.deleteSession(session.id)} className="p-2.5 text-red-500 hover:bg-red-50 rounded-lg transition" title="刪除"><i className="fas fa-trash text-xl"></i></button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div ref={formRef} className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
        <h2 className="text-2xl font-black text-slate-800 mb-8"><i className="fas fa-plus-circle text-indigo-500 mr-3"></i>{editingSessionId ? '編輯' : '建立'}場次</h2>
        <form onSubmit={handleSubmit} className="space-y-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-600">場次標題</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-4 py-3 border rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none transition" placeholder="例：2024 夏季賽" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-600">裁判名單 (逗號分隔)</label>
              <div className="flex space-x-2">
                <input 
                  type="text" 
                  value={refereeInput} 
                  onChange={(e) => setRefereeInput(e.target.value)} 
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addReferee())}
                  className="flex-grow px-4 py-3 border rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none transition" 
                  placeholder="輸入姓名並按新增" 
                />
                <button type="button" onClick={addReferee} className="bg-slate-800 text-white px-6 rounded-xl font-bold hover:bg-slate-700 transition shadow-md">新增</button>
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                {referees.map(r => (
                  <span key={r} className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                    {r}
                    <button type="button" onClick={() => removeReferee(r)} className="ml-2 hover:text-red-500">
                      <i className="fas fa-times-circle"></i>
                    </button>
                  </span>
                ))}
              </div>
            </div>
            
            <div className="space-y-4 lg:col-span-2">
              <label className="text-sm font-bold text-slate-600 flex items-center">
                <i className="fas fa-calculator mr-2 text-indigo-400"></i>計分權重設定 (先手/後手得分)
              </label>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-green-50 p-3 rounded-xl border border-green-100">
                  <p className="text-[10px] font-bold text-green-700 mb-2 uppercase">先勝 (Win)</p>
                  <div className="flex items-center space-x-1">
                    <input type="number" step="0.5" value={scoring.win.p1} onChange={(e)=>updateScoring('win','p1',e.target.value)} className="w-full p-1 text-xs border rounded" placeholder="先" title="先手得分" />
                    <span className="text-gray-300">/</span>
                    <input type="number" step="0.5" value={scoring.win.p2} onChange={(e)=>updateScoring('win','p2',e.target.value)} className="w-full p-1 text-xs border rounded" placeholder="後" title="後手得分" />
                  </div>
                </div>
                <div className="bg-red-50 p-3 rounded-xl border border-red-100">
                  <p className="text-[10px] font-bold text-red-700 mb-2 uppercase">先負 (Loss)</p>
                  <div className="flex items-center space-x-1">
                    <input type="number" step="0.5" value={scoring.loss.p1} onChange={(e)=>updateScoring('loss','p1',e.target.value)} className="w-full p-1 text-xs border rounded" title="先手得分" />
                    <span className="text-gray-300">/</span>
                    <input type="number" step="0.5" value={scoring.loss.p2} onChange={(e)=>updateScoring('loss','p2',e.target.value)} className="w-full p-1 text-xs border rounded" title="後手得分" />
                  </div>
                </div>
                <div className="bg-amber-50 p-3 rounded-xl border border-amber-100">
                  <p className="text-[10px] font-bold text-amber-700 mb-2 uppercase">和棋 (Draw)</p>
                  <div className="flex items-center space-x-1">
                    <input type="number" step="0.5" value={scoring.draw.p1} onChange={(e)=>updateScoring('draw','p1',e.target.value)} className="w-full p-1 text-xs border rounded" title="先手得分" />
                    <span className="text-gray-300">/</span>
                    <input type="number" step="0.5" value={scoring.draw.p2} onChange={(e)=>updateScoring('draw','p2',e.target.value)} className="w-full p-1 text-xs border rounded" title="後手得分" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-800">桌次與對手設定</h3>
              <div className="flex space-x-2">
                <input type="file" ref={fileInputRef} onChange={handleExcelImport} className="hidden" />
                <button type="button" onClick={()=>fileInputRef.current?.click()} className="text-emerald-600 bg-emerald-50 px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-emerald-100 transition">匯入 Excel</button>
                <button type="button" onClick={addTable} className="text-indigo-600 bg-indigo-50 px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-indigo-100 transition">新增一桌</button>
              </div>
            </div>
            <div className="overflow-x-auto border rounded-2xl shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr className="text-left text-slate-500 font-bold uppercase">
                    <th className="px-4 py-3 w-20">抬號</th>
                    <th className="px-4 py-3">先手 (編號/姓名)</th>
                    <th className="px-4 py-3">後手 (編號/姓名)</th>
                    <th className="px-4 py-3 w-16 text-center">刪</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {tables.map((t, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition">
                      <td className="px-4 py-2 w-20"><input type="number" value={t.tableNumber} onChange={(e)=>{const n=[...tables];n[idx].tableNumber=parseInt(e.target.value);setTables(n)}} className="w-full p-2 border rounded-lg focus:ring-1 focus:ring-indigo-400 outline-none" /></td>
                      <td className="px-4 py-2">
                        <div className="flex space-x-1">
                          <input type="text" value={t.player1?.id} onChange={(e)=>{const n=[...tables];n[idx].player1={...n[idx].player1!, id:e.target.value};setTables(n)}} className="w-20 p-2 border rounded-lg text-xs" placeholder="ID" />
                          <input type="text" value={t.player1?.name} onChange={(e)=>{const n=[...tables];n[idx].player1={...n[idx].player1!, name:e.target.value};setTables(n)}} className="w-full p-2 border rounded-lg text-xs" placeholder="姓名" />
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex space-x-1">
                          <input type="text" value={t.player2?.id} onChange={(e)=>{const n=[...tables];n[idx].player2={...n[idx].player2!, id:e.target.value};setTables(n)}} className="w-20 p-2 border rounded-lg text-xs" placeholder="ID" />
                          <input type="text" value={t.player2?.name} onChange={(e)=>{const n=[...tables];n[idx].player2={...n[idx].player2!, name:e.target.value};setTables(n)}} className="w-full p-2 border rounded-lg text-xs" placeholder="姓名" />
                        </div>
                      </td>
                      <td className="px-4 py-2 text-center">
                        <button type="button" onClick={() => {
                          const n = tables.filter((_, i) => i !== idx);
                          setTables(n);
                        }} className="text-red-400 hover:text-red-600 p-2">
                          <i className="fas fa-trash"></i>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <button type="submit" className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-lg shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition active:scale-95">
            {editingSessionId ? '確認儲存修改' : '建立場次'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AdminPanel;
