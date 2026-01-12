
import React, { useState, useEffect, useCallback } from 'react';
import { UserRole, MatchSession } from './types.ts';
import { storageService } from './services/storage.ts';
import AdminPanel from './components/AdminPanel.tsx';
import RefereePanel from './components/RefereePanel.tsx';
import ResultsBoard from './components/ResultsBoard.tsx';
import LoginModal from './components/LoginModal.tsx';

const App: React.FC = () => {
  const [role, setRole] = useState<UserRole>(UserRole.GUEST);
  const [activeTab, setActiveTab] = useState<'admin' | 'referee' | 'results'>('results');
  const [showLogin, setShowLogin] = useState<UserRole | null>(null);
  const [sessions, setSessions] = useState<MatchSession[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [syncId, setSyncId] = useState<string | null>(localStorage.getItem('current_sync_id'));
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);

  const updateSessions = useCallback(() => {
    const data = storageService.getSessions();
    setSessions(data);
    setLastUpdate(new Date());
  }, []);

  // 處理雲端同步
  const handleCloudSync = useCallback(async () => {
    if (!syncId) return;
    setIsCloudSyncing(true);
    const cloudData = await storageService.cloud.fetchBin(syncId);
    if (cloudData) {
      // 簡單的合併策略：若雲端有資料，直接以雲端為準（覆蓋本地）
      storageService.saveSessions(cloudData);
      setSessions(cloudData);
      setLastUpdate(new Date());
    }
    setIsCloudSyncing(false);
  }, [syncId]);

  useEffect(() => {
    updateSessions();

    // 解析 URL 中的 syncId (例如 ?sid=123)
    const params = new URLSearchParams(window.location.search);
    const sid = params.get('sid');
    if (sid && sid !== syncId) {
      setSyncId(sid);
      localStorage.setItem('current_sync_id', sid);
    }

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'match_results_app_data' || e.key === null) {
        updateSessions();
      }
    };
    window.addEventListener('storage', handleStorageChange);

    // 輪詢邏輯：如果有同步 ID，每 3 秒檢查雲端；否則檢查本地
    const interval = setInterval(() => {
      if (syncId) {
        handleCloudSync();
      } else {
        updateSessions();
      }
    }, 3500);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [updateSessions, syncId, handleCloudSync]);

  const onSessionCreated = () => {
    updateSessions();
    // 若有同步 ID，創建後自動推送到雲端
    if (syncId) {
      storageService.cloud.updateBin(syncId, storageService.getSessions());
    }
  };

  const handleJoinSync = (id: string) => {
    setSyncId(id);
    localStorage.setItem('current_sync_id', id);
    alert(`已成功切換至同步 ID: ${id}`);
    handleCloudSync();
  };

  const stopSync = () => {
    if (window.confirm('確定停止同步？停止後將僅能看到本地儲存的舊資料。')) {
      setSyncId(null);
      localStorage.removeItem('current_sync_id');
    }
  };

  const onLoginSuccess = (successRole: UserRole) => {
    setRole(successRole);
    setShowLogin(null);
    setActiveTab(successRole === UserRole.ADMIN ? 'admin' : 'referee');
    updateSessions();
  };

  const getRoleLabel = (r: UserRole) => {
    switch (r) {
      case UserRole.ADMIN: return '後台人員';
      case UserRole.REFEREE: return '裁判人員';
      default: return '一般選手/訪客';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-indigo-700 text-white shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2 cursor-pointer" onClick={() => setActiveTab('results')}>
            <i className="fas fa-trophy text-2xl text-yellow-400"></i>
            <h1 className="text-xl font-bold tracking-tight hidden sm:block">比賽紀錄系統</h1>
          </div>
          
          <div className="flex items-center space-x-1 sm:space-x-4">
            <nav className="flex space-x-1">
              <button onClick={() => setActiveTab('results')} className={`px-3 py-2 rounded-md text-xs sm:text-sm font-medium transition ${activeTab === 'results' ? 'bg-indigo-800' : 'hover:bg-indigo-600'}`}>比賽看板</button>
              <button onClick={() => { if(role === UserRole.REFEREE) setActiveTab('referee'); else setShowLogin(UserRole.REFEREE); }} className={`px-3 py-2 rounded-md text-xs sm:text-sm font-medium transition ${activeTab === 'referee' ? 'bg-indigo-800' : 'hover:bg-indigo-600'}`}>裁判專區</button>
              <button onClick={() => { if(role === UserRole.ADMIN) setActiveTab('admin'); else setShowLogin(UserRole.ADMIN); }} className={`px-3 py-2 rounded-md text-xs sm:text-sm font-medium transition ${activeTab === 'admin' ? 'bg-indigo-800' : 'hover:bg-indigo-600'}`}>後台管理</button>
            </nav>

            <div className="flex items-center ml-2 space-x-2">
               {syncId ? (
                 <div className="flex items-center bg-indigo-800 px-2 py-1 rounded border border-indigo-400" title={`同步 ID: ${syncId}`}>
                    <i className={`fas fa-cloud text-[10px] mr-1 ${isCloudSyncing ? 'animate-pulse text-green-400' : 'text-indigo-300'}`}></i>
                    <span className="text-[10px] font-mono font-bold">{syncId.substring(0,6)}</span>
                    <button onClick={stopSync} className="ml-1 text-[10px] text-indigo-400 hover:text-white"><i className="fas fa-times"></i></button>
                 </div>
               ) : (
                 <div className="hidden sm:flex items-center bg-slate-600 px-2 py-1 rounded text-[10px] text-slate-300">
                    <i className="fas fa-cloud-slash mr-1"></i> 本地模式
                 </div>
               )}
               {role !== UserRole.GUEST && (
                 <button onClick={() => {setRole(UserRole.GUEST); setActiveTab('results');}} className="bg-red-500 hover:bg-red-600 text-white w-8 h-8 rounded-full flex items-center justify-center transition shadow-sm"><i className="fas fa-sign-out-alt text-xs"></i></button>
               )}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-grow max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        <div className="mb-4 flex justify-end items-center space-x-2">
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${syncId ? 'bg-green-400' : 'bg-blue-400'}`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${syncId ? 'bg-green-500' : 'bg-blue-500'}`}></span>
            </span>
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
              {syncId ? `同步 ID: ${syncId}` : '本地資料'} (更新: {lastUpdate.toLocaleTimeString()})
            </span>
        </div>

        {activeTab === 'results' && (
          <ResultsBoard 
            sessions={sessions} 
            userRole={role} 
            onRefresh={syncId ? handleCloudSync : updateSessions} 
            onJoinSync={handleJoinSync}
            currentSyncId={syncId || undefined}
          />
        )}
        
        {activeTab === 'admin' && role === UserRole.ADMIN && (
          <AdminPanel onSessionCreated={onSessionCreated} currentSyncId={syncId || undefined} setSyncId={handleJoinSync} />
        )}

        {activeTab === 'referee' && role === UserRole.REFEREE && (
          <RefereePanel sessions={sessions} onResultSubmitted={onSessionCreated} />
        )}

        {showLogin && <LoginModal targetRole={showLogin} onClose={() => setShowLogin(null)} onSuccess={onLoginSuccess} />}
      </main>
    </div>
  );
};

export default App;
