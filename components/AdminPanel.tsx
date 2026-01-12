
import React, { useState, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import * as XLSX from 'xlsx';
import { MatchSession, MatchStatus, TableMatch, GameResult } from '../types';
import { storageService } from '../services/storage';

interface AdminPanelProps {
  onSessionCreated: () => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ onSessionCreated }) => {
  const [sessions, setSessions] = useState<MatchSession[]>([]);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  
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

  const addReferee = () => {
    const rawInput = refereeInput.trim();
    if (!rawInput) return;

    const names = rawInput.split(/[,，]/)
      .map(name => name.trim())
      .filter(name => name !== '');

    if (names.length > 0) {
      setReferees(prev => {
        const nextReferees = [...prev];
        names.forEach(name => {
          if (!nextReferees.includes(name)) {
            nextReferees.push(name);
          }
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

        if (jsonData.length === 0) {
          alert('Excel 檔案內沒有資料');
          return;
        }

        const importedTables: Partial<TableMatch>[] = jsonData.map((row, idx) => ({
          tableNumber: row['桌號'] || row['Table'] || (idx + 1),
          player1: { 
            id: String(row['先手ID'] || row['P1 ID'] || ''), 
            name: String(row['先手姓名'] || row['P1 Name'] || '') 
          },
          player2: { 
            id: String(row['後手ID'] || row['P2 ID'] || ''), 
            name: String(row['後手姓名'] || row['P2 Name'] || '') 
          },
          result: GameResult.PENDING
        }));

        setTables(importedTables);
        alert(`成功匯入 ${importedTables.length} 筆桌號資料！`);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } catch (err) {
        console.error(err);
        alert('解析檔案失敗，請確保是正確的 Excel 或 CSV 格式');
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
      '送出者': t.submittedBy || '',
      '更新時間': t.updatedAt ? new Date(t.updatedAt).toLocaleString() : ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '比賽結果');
    
    // Auto-size columns (rough approximation)
    const wscols = [
      { wch: 6 },  // 桌號
      { wch: 10 }, // 先手ID
      { wch: 15 }, // 先手姓名
      { wch: 10 }, // 後手ID
      { wch: 15 }, // 後手姓名
      { wch: 8 },  // 結果
      { wch: 12 }, // 送出者
      { wch: 20 }  // 更新時間
    ];
    worksheet['!cols'] = wscols;

    XLSX.writeFile(workbook, `${session.title}_比賽結果.xlsx`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return alert('請輸入場次標題');
    if (referees.length === 0) return alert('請至少輸入一位裁判人員');

    const sessionData = {
      title,
      referees: referees,
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
      if (existing) {
        storageService.updateSession({
          ...existing,
          ...sessionData
        });
        alert('比賽場次已更新！');
      }
    } else {
      const newSession: MatchSession = {
        id: uuidv4(),
        status: MatchStatus.OPEN,
        createdAt: new Date().toISOString(),
        ...sessionData
      };
      storageService.addSession(newSession);
      alert('比賽場次已成功創建！');
    }

    resetForm();
    onSessionCreated();
    loadSessions();
  };

  const resetForm = () => {
    setTitle('');
    setReferees([]);
    setTables([{ tableNumber: 1, player1: { id: '', name: '' }, player2: { id: '', name: '' }, result: GameResult.PENDING }]);
    setEditingSessionId(null);
  };

  const startEdit = (session: MatchSession) => {
    setEditingSessionId(session.id);
    setTitle(session.title);
    setReferees(session.referees);
    setTables(session.tables);
    formRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleDelete = (id: string) => {
    if (window.confirm('確定要刪除此比賽場次嗎？此操作無法還原。')) {
      storageService.deleteSession(id);
      loadSessions();
      onSessionCreated();
      if (editingSessionId === id) resetForm();
    }
  };

  return (
    <div className="space-y-12 max-w-4xl mx-auto pb-20">
      {/* Session List Management */}
      <section className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100">
        <div className="bg-gray-50 px-6 py-4 border-b flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-800 flex items-center">
            <i className="fas fa-list-check text-indigo-500 mr-2"></i>
            管理現有比賽場次
          </h2>
          <span className="text-xs font-medium text-gray-400">總計 {sessions.length} 個場次</span>
        </div>
        <div className="divide-y divide-gray-100">
          {sessions.length > 0 ? (
            sessions.map(session => (
              <div key={session.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-gray-50 transition gap-4">
                <div className="flex-grow">
                  <h3 className="font-bold text-gray-800">{session.title}</h3>
                  <div className="flex flex-wrap gap-2 mt-1">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${session.status === MatchStatus.OPEN ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {session.status === MatchStatus.OPEN ? '開放中' : '已截止'}
                    </span>
                    <span className="text-[10px] text-gray-400">桌數: {session.tables.length}</span>
                    <span className="text-[10px] text-gray-400">裁判: {session.referees.length}位</span>
                  </div>
                </div>
                <div className="flex items-center space-x-1 sm:space-x-2">
                  <button 
                    onClick={() => handleExportExcel(session)}
                    className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                    title="匯出 Excel"
                  >
                    <i className="fas fa-file-excel"></i>
                  </button>
                  <button 
                    onClick={() => startEdit(session)}
                    className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                    title="編輯場次內容"
                  >
                    <i className="fas fa-edit"></i>
                  </button>
                  <button 
                    onClick={() => handleDelete(session.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                    title="刪除場次"
                  >
                    <i className="fas fa-trash-alt"></i>
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="p-10 text-center text-gray-400 italic">
              尚未有任何比賽場次
            </div>
          )}
        </div>
      </section>

      {/* Creation / Edit Form */}
      <div ref={formRef} className="bg-white rounded-xl shadow-md p-6 border border-gray-100 scroll-mt-20">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
          <i className={`fas ${editingSessionId ? 'fa-pen-to-square text-orange-500' : 'fa-plus-circle text-indigo-500'} mr-2`}></i>
          {editingSessionId ? '編輯比賽場次' : '創建新比賽場次'}
          {editingSessionId && (
            <button 
              onClick={resetForm}
              className="ml-auto text-sm font-normal text-indigo-600 hover:underline"
            >
              取消編輯並建立新場次
            </button>
          )}
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Title Section */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">場次名稱 / 標題</label>
              <input 
                type="text" 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="例如：2024 春季大賽 - 第一輪"
              />
            </div>

            {/* Global Referee Pool Section */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">裁判人員名單</label>
              <div className="flex space-x-2 mb-2">
                <input 
                  type="text" 
                  value={refereeInput}
                  onChange={(e) => setRefereeInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addReferee())}
                  className="flex-grow px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                  placeholder="輸入姓名，多位請用逗號隔開"
                />
                <button 
                  type="button"
                  onClick={addReferee}
                  className="bg-indigo-100 text-indigo-600 px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-200 transition shrink-0"
                >
                  新增
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {referees.map(r => (
                  <span key={r} className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                    {r}
                    <button type="button" onClick={() => removeReferee(r)} className="ml-1.5 inline-flex text-indigo-400 hover:text-indigo-600 focus:outline-none">
                      <i className="fas fa-times-circle"></i>
                    </button>
                  </span>
                ))}
                {referees.length === 0 && <p className="text-xs text-gray-400 italic">尚未新增裁判</p>}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-2 gap-2">
              <div>
                <h3 className="text-lg font-medium text-gray-700">對弈對象配置</h3>
                <p className="text-[10px] text-gray-400">Excel 標題建議：桌號, 先手ID, 先手姓名, 後手ID, 後手姓名</p>
              </div>
              <div className="flex space-x-2">
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleExcelImport}
                  accept=".xlsx, .xls, .csv"
                  className="hidden"
                />
                <button 
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-emerald-50 text-emerald-600 hover:bg-emerald-100 px-3 py-1.5 rounded-lg text-sm font-semibold flex items-center transition"
                >
                  <i className="fas fa-file-import mr-1"></i> 匯入 Excel
                </button>
                <button 
                  type="button"
                  onClick={addTable}
                  className="text-indigo-600 hover:text-indigo-800 text-sm font-semibold flex items-center"
                >
                  <i className="fas fa-plus mr-1"></i> 新增桌號
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[500px]">
                <thead>
                  <tr className="text-left text-xs text-gray-500 uppercase tracking-wider">
                    <th className="py-2 px-1">桌號</th>
                    <th className="py-2 px-1">先手(ID/姓名)</th>
                    <th className="py-2 px-1">後手(ID/姓名)</th>
                    <th className="py-2 px-1 w-16">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {tables.map((table, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 transition">
                      <td className="py-2 px-1">
                        <input 
                          type="number" 
                          value={table.tableNumber}
                          onChange={(e) => updateTable(idx, 'tableNumber', e.target.value)}
                          className="w-16 px-2 py-1 border rounded"
                        />
                      </td>
                      <td className="py-2 px-1 space-y-1">
                        <div className="flex space-x-1">
                          <input 
                            type="text" 
                            placeholder="ID"
                            value={table.player1?.id}
                            onChange={(e) => updateTable(idx, 'p1Id', e.target.value)}
                            className="w-20 px-2 py-1 border rounded text-xs"
                          />
                          <input 
                            type="text" 
                            placeholder="姓名"
                            value={table.player1?.name}
                            onChange={(e) => updateTable(idx, 'p1Name', e.target.value)}
                            className="w-28 px-2 py-1 border rounded text-xs"
                          />
                        </div>
                      </td>
                      <td className="py-2 px-1 space-y-1">
                        <div className="flex space-x-1">
                          <input 
                            type="text" 
                            placeholder="ID"
                            value={table.player2?.id}
                            onChange={(e) => updateTable(idx, 'p2Id', e.target.value)}
                            className="w-20 px-2 py-1 border rounded text-xs"
                          />
                          <input 
                            type="text" 
                            placeholder="姓名"
                            value={table.player2?.name}
                            onChange={(e) => updateTable(idx, 'p2Name', e.target.value)}
                            className="w-28 px-2 py-1 border rounded text-xs"
                          />
                        </div>
                      </td>
                      <td className="py-2 px-1">
                        <button 
                          type="button"
                          onClick={() => removeTable(idx)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <i className="fas fa-trash"></i>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <button 
            type="submit"
            className={`w-full text-white py-4 rounded-xl font-bold transition shadow-lg active:transform active:scale-95 ${editingSessionId ? 'bg-orange-500 hover:bg-orange-600' : 'bg-indigo-600 hover:bg-indigo-700'}`}
          >
            {editingSessionId ? '儲存修改內容' : '確認創建比賽場次'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AdminPanel;
