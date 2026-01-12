
import React, { useState, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import * as XLSX from 'xlsx';
import { MatchSession, MatchStatus, TableMatch, GameResult } from '../types.ts';
import { storageService } from '../services/storage.ts';

interface AdminPanelProps {
  onSessionCreated: () => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ onSessionCreated }) => {
  const [sessions, setSessions] = useState<MatchSession[]>([]);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  
  // 密碼管理相關
  const [newRefereePassword, setNewRefereePassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

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

  const loadSessions = async () => {
    const data = await storageService.getSessions();
    setSessions(data);
  };

  const toggleSessionStatus = async (session: MatchSession) => {
    const newStatus = session.status === MatchStatus.OPEN ? MatchStatus.CLOSED : MatchStatus.OPEN;
    await storageService.updateSession({ ...session, status: newStatus });
    await loadSessions();
  };

  const handleUpdatePassword = async () => {
    if (!newRefereePassword) return alert('請輸入新密碼');
    if (newRefereePassword.length < 4) return alert('密碼長度建議至少 4 位');
    
    setIsUpdatingPassword(true);
    try {
      await storageService.updateRefereePassword(newRefereePassword);
      alert('裁判登入密碼已成功更新！');
      setNewRefereePassword('');
    } catch (e) {
      alert('密碼更新失敗，請檢查網路。');
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

  const addTable = () => {
    const nextNum = tables.length > 0 ? Math.max(...tables.map(t => t.tableNumber || 0)) + 1 : 1;
    setTables([...tables, { 
      tableNumber: nextNum, 
      player1: { id: '', name: '' }, 
      player2: { id: '', name: '' }, 
      result: GameResult.PENDING 
    }]);
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

  const removeTable = (index: number) => {
    setTables(tables.filter((_, i) => i !== index));
  };

  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];
        
        const importedTables: Partial<TableMatch>[] = jsonData.map((row: any, idx) => ({
          tableNumber: row['桌號'] || row['Table'] || (idx + 1),
          player1: { id: String(row['先手ID'] || row['P1 ID'] || ''), name: String(row['先手姓名'] || row['P1 Name'] || '') },
          player2: { id: String(row['後手ID'] || row['P2 ID'] || ''), name: String(row['後手姓名'] || row['P2 Name'] || '') },
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
    const exportData = session.tables.map(t => ({
      '桌號': t.tableNumber,
      '先手ID': t.player1.id,
      '先手姓名': t.player1.name,
      '後手ID': t.player2.id,
      '後手姓名': t.player2.name,
      '結果': t.result,
      '送出裁判': t.submittedBy || '',
      '更新時間': t.updatedAt ? new Date(t.updatedAt).toLocaleString() : ''
    }));
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '比賽結果');
    XLSX.writeFile(workbook, `${session.title}_比賽結果.xlsx`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return alert('請輸入場次標題');
    if (referees.length === 0) return alert('請至少輸入一位裁判人員');

    const sessionData = {
      title,
      referees,
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
      });
      alert('場次已成功建立並同步雲端');
    }
    resetForm();
    onSessionCreated();
    await loadSessions();
  };

  const resetForm = () => {
    setTitle(''); setReferees([]); setEditingSessionId(null);
    setTables([{ tableNumber: 1, player1: { id: '', name: '' }, player2: { id: '', name: '' }, result: GameResult.PENDING }]);
  };

  const startEdit = (session: MatchSession) => {
    setEditingSessionId(session.id);
    setTitle(session.title);
    setReferees(session.referees);
    setTables(session.tables);
    formRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('確定刪除此比賽場次？此動作將同步影響所有設備。')) {
      await storageService.deleteSession(id);
      await loadSessions();
      onSessionCreated();
      if (editingSessionId === id) resetForm();
    }
  };

  return (
    <div className="space-y-12 max-w-5xl mx-auto pb-20">
      {/* 系統安全設定 */}
      <section className="bg-white rounded-2xl shadow-sm border border-red-100 overflow-hidden">
        <div className="bg-red-50 px-6 py-4 border-b border-red-100 flex justify-between items-center">
          <h2 className="text-xl font-bold text-red-800 flex items-center">
            <i className="fas fa-user-shield mr-2"></i>
            系統帳號權限管理
          </h2>
        </div>
        <div className="p-6">
          <div className="max-w-md space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">更新裁判登入密碼</label>
              <div className="flex space-x-2">
                <input 
                  type="text" 
                  value={newRefereePassword}
                  onChange={(e) => setNewRefereePassword(e.target.value)}
                  className="flex-grow px-4 py-2 border rounded-xl focus:ring-2 focus:ring-red-500 outline-none transition"
                  placeholder="輸入新密碼..."
                />
                <button 
                  onClick={handleUpdatePassword}
                  disabled={isUpdatingPassword}
                  className="bg-red-600 text-white px-6 rounded-xl font-bold hover:bg-red-700 transition disabled:bg-gray-400"
                >
                  {isUpdatingPassword ? '同步中...' : '確認更改'}
                </button>
              </div>
              <p className="mt-2 text-xs text-gray-400">※ 更改後，所有使用「裁判專區」的人員需使用新密碼登入。</p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-slate-50 px-6 py-4 border-b flex justify-between items-center">
          <h2 className="text-xl font-bold text-slate-800 flex items-center">
            <i className="fas fa-tasks text-indigo-500 mr-2"></i>
            現有比賽場次管理
          </h2>
          <span className="bg-indigo-100 text-indigo-600 px-3 py-1 rounded-full text-xs font-bold">
            共 {sessions.length} 場
          </span>
        </div>
        <div className="divide-y divide-gray-100">
          {sessions.length > 0 ? sessions.map(session => (
            <div key={session.id} className="p-5 flex flex-col md:flex-row justify-between items-center hover:bg-slate-50 transition gap-4">
              <div className="flex-grow text-center md:text-left">
                <h3 className="font-bold text-slate-800 text-lg">{session.title}</h3>
                <div className="flex flex-wrap justify-center md:justify-start gap-3 mt-2 items-center">
                  {/* 開放/截止切換按鈕 */}
                  <button 
                    onClick={() => toggleSessionStatus(session)}
                    className={`flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-bold transition-all ${
                      session.status === MatchStatus.OPEN 
                        ? 'bg-green-500 text-white shadow-sm shadow-green-200' 
                        : 'bg-red-500 text-white shadow-sm shadow-red-200'
                    }`}
                  >
                    <i className={`fas ${session.status === MatchStatus.OPEN ? 'fa-lock-open' : 'fa-lock'}`}></i>
                    <span>{session.status === MatchStatus.OPEN ? '開放傳送中' : '已截止傳送'}</span>
                    <span className="bg-white bg-opacity-30 px-1.5 py-0.5 rounded text-[9px]">點擊切換</span>
                  </button>
                  <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-1 rounded">桌數: {session.tables.length}</span>
                </div>
              </div>
              <div className="flex space-x-1">
                <button onClick={() => handleExportExcel(session)} className="p-2.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition" title="匯出 Excel">
                  <i className="fas fa-file-excel text-xl"></i>
                </button>
                <button onClick={() => startEdit(session)} className="p-2.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition" title="修改">
                  <i className="fas fa-edit text-xl"></i>
                </button>
                <button onClick={() => handleDelete(session.id)} className="p-2.5 text-red-500 hover:bg-red-50 rounded-lg transition" title="刪除">
                  <i className="fas fa-trash-alt text-xl"></i>
                </button>
              </div>
            </div>
          )) : (
            <div className="py-20 text-center text-gray-400 italic">尚未建立任何比賽場次</div>
          )}
        </div>
      </section>

      <div ref={formRef} className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
        <h2 className="text-2xl font-black text-slate-800 mb-8 flex items-center">
          <i className={`fas ${editingSessionId ? 'fa-pen-nib text-amber-500' : 'fa-plus-circle text-indigo-500'} mr-3`}></i>
          {editingSessionId ? '編輯比賽場次' : '建立全新比賽場次'}
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-600">場次標題</label>
              <input 
                type="text" 
                value={title} 
                onChange={(e) => setTitle(e.target.value)} 
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition" 
                placeholder="例如：2024 夏季杯複賽" 
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-600">裁判名單 (逗號分隔)</label>
              <div className="flex space-x-2">
                <input 
                  type="text" 
                  value={refereeInput} 
                  onChange={(e) => setRefereeInput(e.target.value)} 
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addReferee())}
                  className="flex-grow px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition" 
                  placeholder="輸入姓名並按新增" 
                />
                <button type="button" onClick={addReferee} className="bg-slate-800 text-white px-6 rounded-xl font-bold hover:bg-slate-700 transition">新增</button>
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
          </div>

          <div className="space-y-4 pt-4 border-t">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h3 className="text-lg font-bold text-slate-800">桌次與對手設定</h3>
              <div className="flex space-x-3">
                <input type="file" ref={fileInputRef} onChange={handleExcelImport} accept=".xlsx,.xls" className="hidden" />
                <button type="button" onClick={() => fileInputRef.current?.click()} className="text-emerald-600 bg-emerald-50 px-4 py-2 rounded-lg text-sm font-bold hover:bg-emerald-100 transition">
                  <i className="fas fa-file-import mr-2"></i>匯入 Excel
                </button>
                <button type="button" onClick={addTable} className="text-indigo-600 bg-indigo-50 px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-100 transition">
                  <i className="fas fa-plus mr-2"></i>新增一桌
                </button>
              </div>
            </div>

            <div className="overflow-x-auto border rounded-2xl">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr className="text-left text-slate-500 font-bold uppercase">
                    <th className="px-4 py-3 w-20">桌號</th>
                    <th className="px-4 py-3">先手 (ID / 姓名)</th>
                    <th className="px-4 py-3">後手 (ID / 姓名)</th>
                    <th className="px-4 py-3 w-16 text-center">刪</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {tables.map((table, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition">
                      <td className="px-4 py-3">
                        <input type="number" value={table.tableNumber} onChange={(e) => updateTable(idx, 'tableNumber', e.target.value)} className="w-full p-2 border rounded-lg focus:ring-1 focus:ring-indigo-400 outline-none" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex space-x-2">
                          <input type="text" placeholder="ID" value={table.player1?.id} onChange={(e) => updateTable(idx, 'p1Id', e.target.value)} className="w-20 p-2 border rounded-lg text-xs" />
                          <input type="text" placeholder="姓名" value={table.player1?.name} onChange={(e) => updateTable(idx, 'p1Name', e.target.value)} className="w-full p-2 border rounded-lg text-xs" />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex space-x-2">
                          <input type="text" placeholder="ID" value={table.player2?.id} onChange={(e) => updateTable(idx, 'p2Id', e.target.value)} className="w-20 p-2 border rounded-lg text-xs" />
                          <input type="text" placeholder="姓名" value={table.player2?.name} onChange={(e) => updateTable(idx, 'p2Name', e.target.value)} className="w-full p-2 border rounded-lg text-xs" />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button type="button" onClick={() => removeTable(idx)} className="text-red-400 hover:text-red-600 p-2">
                          <i className="fas fa-trash"></i>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t">
            <button type="submit" className={`flex-grow py-4 rounded-2xl font-black text-lg text-white shadow-xl transition active:scale-95 ${editingSessionId ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-200' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'}`}>
              {editingSessionId ? '確認儲存修改' : '建立比賽場次'}
            </button>
            {editingSessionId && (
              <button type="button" onClick={resetForm} className="bg-slate-100 text-slate-600 px-8 py-4 rounded-2xl font-bold hover:bg-slate-200 transition">
                取消編輯
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminPanel;
