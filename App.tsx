
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

  const updateSessionsState = useCallback(() => {
    const data = storageService.getSessions();
    setSessions(data);
    setLastUpdate(new Date());
  }, []);

  const handleCloudFetch = useCallback(async () => {
    if (!syncId) return;
    setIsCloudSyncing(true);
    const cloudData = await storageService.cloud.fetchBin(syncId);
    if (cloudData) {
      storageService.saveSessions(cloudData);
      setSessions(cloudData);
      setLastUpdate(new Date());
    }
    setIsCloudSyncing(false);
  }, [syncId]);

  useEffect(() => {
    updateSessionsState();

    const params = new URLSearchParams(window.location.search);
    const sid = params.get('sid');
    if (sid && sid !== syncId) {
      setSyncId(sid);
      localStorage.setItem('current_sync_id', sid);
    }

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'match_results_app_data' || e.key === null) {
        updateSessionsState();
      }
    };
    window.addEventListener('storage', handleStorageChange);

    // 每 3 秒檢查一次雲端 (如果有 syncId)
    const interval = setInterval(() => {
      if (syncId) {
        handleCloudFetch();
      } else {
        updateSessionsState();
      }
    }, 3000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [updateSessionsState, syncId, handleCloudFetch]);

  const pushToCloud = async (latestSessions: MatchSession[]) => {
    if (syncId) {
      setIsCloudSyncing(true);
      await storageService.cloud.updateBin(syncId, latestSessions);
      setIsCloudSyncing(false);
    }
  };

  const onSessionDataChanged = () => {
    updateSessionsState();
    pushToCloud(storageService.getSessions());
  };

  const handleJoinSync = (id: string) => {
    setSyncId(id);
    localStorage.setItem('current_sync_id', id);
    handleCloudFetch();
  };

  const stopSync = () => {
    if (window.confirm('確定停止雲端同步？')) {
      setSyncId(null);
      localStorage.removeItem('current_sync_id');
      window.history.replaceState({}, '', window.location.pathname);
    }
  };

  const onLoginSuccess = (successRole: UserRole) => {
    setRole(successRole);
    setShowLogin(null);
    setActiveTab(successRole === UserRole.ADMIN ? 'admin' : 'referee');
    updateSessionsState();
  };

  const getRoleLabel = (r: UserRole) => {
    switch (r) {
      case UserRole.ADMIN: return '後台人員';
      case UserRole.REFEREE: return '裁判人員';
      default: return '訪客';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-indigo-700 text-white shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2 cursor-pointer" onClick={() => setActiveTab('results')}>
            <i className="fas fa-trophy text-2xl text-yellow-400"></i>
            <h1 className="text-xl font-bold hidden sm:block">比賽紀錄系統</h1>
          </div>
          
          <div className="flex items-center space-x-2 sm:space-x-4">
            <nav className="flex space-x-1">
              <button onClick={() => setActiveTab('results')} className={`px-3 py-2 rounded-md text-xs sm:text-sm font-medium transition ${activeTab === 'results' ? 'bg-indigo-800' : 'hover:bg-indigo-600'}`}>看板</button>
              <button onClick={() => role === UserRole.REFEREE ? setActiveTab('referee') : setShowLogin(UserRole.REFEREE)} className={`px-3 py-2 rounded-md text-xs sm:text-sm font-medium transition ${activeTab === 'referee' ? 'bg-indigo-800' : 'hover:bg-indigo-600'}`}>裁判</button>
              <button onClick={() => role === UserRole.ADMIN ? setActiveTab('admin') : setShowLogin(UserRole.ADMIN)} className={`px-3 py-2 rounded-md text-xs sm:text-sm font-medium transition ${activeTab === 'admin' ? 'bg-indigo-800' : 'hover:bg-indigo-600'}`}>管理</button>
            </nav>

            <div className="flex items-center bg-indigo-900/50 px-2 py-1 rounded-lg">
               {syncId ? (
                 <div className="flex items-center space-x-2">
                    <span className="flex h-2 w-2 relative">
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isCloudSyncing ? 'bg-green-400' : 'bg-indigo-400'}`}></span>
                      <span className={`relative inline-flex rounded-full h-2 w-2 ${isCloudSyncing ? 'bg-green-500' : 'bg-indigo-500'}`}></span>
                    </span>
                    <span className="text-[10px] font-mono font-bold text-indigo-100">{syncId.substring(0,6)}</span>
                    <button onClick={stopSync} className="text-indigo-400 hover:text-white transition"><i className="fas fa-times-circle text-xs"></i></button>
                 </div>
               ) : (
                 <span className="text-[10px] text-indigo-300 font-bold uppercase tracking-tight">LOCAL</span>
               )}
            </div>

            {role !== UserRole.GUEST && (
              <button onClick={() => {setRole(UserRole.GUEST); setActiveTab('results');}} className="bg-red-500 hover:bg-red-600 w-8 h-8 rounded-full flex items-center justify-center transition shadow-sm"><i className="fas fa-sign-out-alt text-xs"></i></button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-grow max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {activeTab === 'results' && (
          <ResultsBoard 
            sessions={sessions} 
            userRole={role} 
            onRefresh={syncId ? handleCloudFetch : updateSessionsState} 
            onJoinSync={handleJoinSync}
            currentSyncId={syncId || undefined}
          />
        )}
        
        {activeTab === 'admin' && role === UserRole.ADMIN && (
          <AdminPanel 
            sessions={sessions}
            onSessionCreated={onSessionDataChanged} 
            currentSyncId={syncId || undefined} 
            setSyncId={handleJoinSync} 
          />
        )}

        {activeTab === 'referee' && role === UserRole.REFEREE && (
          <RefereePanel sessions={sessions} onResultSubmitted={onSessionDataChanged} />
        )}

        {showLogin && <LoginModal targetRole={showLogin} onClose={() => setShowLogin(null)} onSuccess={onLoginSuccess} />}
      </main>

      <footer className="p-4 text-center text-[10px] text-gray-400 bg-white border-t">
        系統同步狀態: {isCloudSyncing ? '同步中...' : '已就緒'} | 最後更新: {lastUpdate.toLocaleTimeString()}
      </footer>
    </div>
  );
};

export default App;
