
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
        if (jsonData.length === 0) return alert('Excel 檔案內沒有資料');
        const importedTables: Partial<TableMatch>[] = jsonData.map((row, idx) => ({
          tableNumber: row['桌號'] || row['Table'] || (idx + 1),
          player1: { id: String(row['先手ID'] || row['P1 ID'] || ''), name: String(row['先手姓名'] || row['P1 Name'] || '') },
          player2: { id: String(row['後手ID'] || row['P2 ID'] || ''), name: String(row['後手姓名'] || row['P2 Name'] || '') },
          result: GameResult.PENDING
        }));
        setTables(importedTables);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } catch (err) {
        alert('解析檔案失敗');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleExportExcel = (session: MatchSession) => {
    const exportData = session.tables.map(t => ({
      '桌號': t.tableNumber, '先手ID': t.player1.id, '先手姓名': t.player1.name,
      '後手ID': t.player2.id, '後手姓名': t.player2.name, '結果': t.result,
      '送出者': t.submittedBy || '', '更新時間': t.updatedAt ? new Date(t.updatedAt).toLocaleString() : ''
    }));
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '比賽結果');
    XLSX.writeFile(workbook, `${session.title}_比賽結果.xlsx`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return alert('請輸入標題');
    if (referees.length === 0) return alert('請輸入裁判');
    const sessionData = {
      title, referees,
      tables: tables.map(t => ({
        ...t, tableNumber: t.tableNumber || 0,
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

  const startEdit = (session: MatchSession) => {
    setEditingSessionId(session.id); setTitle(session.title); setReferees(session.referees); setTables(session.tables);
    formRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleDelete = (id: string) => {
    if (window.confirm('確定刪除？')) {
      storageService.deleteSession(id);
      loadSessions();
      onSessionCreated();
      if (editingSessionId === id) resetForm();
    }
  };

  return (
    <div className="space-y-12 max-w-4xl mx-auto pb-20">
      <section className="bg-white rounded-xl shadow-md overflow-hidden border">
        <div className="bg-gray-50 px-6 py-4 border-b flex justify-between">
          <h2 className="text-xl font-bold">管理現有比賽場次</h2>
        </div>
        <div className="divide-y">
          {sessions.map(session => (
            <div key={session.id} className="p-4 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="flex-grow">
                <h3 className="font-bold">{session.title}</h3>
                <span className="text-xs text-gray-400">桌數: {session.tables.length}</span>
              </div>
              <div className="flex space-x-2">
                <button onClick={() => handleExportExcel(session)} className="p-2 text-emerald-600"><i className="fas fa-file-excel"></i></button>
                <button onClick={() => startEdit(session)} className="p-2 text-indigo-600"><i className="fas fa-edit"></i></button>
                <button onClick={() => handleDelete(session.id)} className="p-2 text-red-600"><i className="fas fa-trash-alt"></i></button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div ref={formRef} className="bg-white rounded-xl shadow-md p-6 border">
        <h2 className="text-2xl font-bold mb-6">{editingSessionId ? '編輯' : '創建'}比賽場次</h2>
        <form onSubmit={handleSubmit} className="space-y-8">
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full p-2 border rounded" placeholder="場次標題" />
          <button type="submit" className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold">確認</button>
        </form>
      </div>
    </div>
  );
};

export default AdminPanel;