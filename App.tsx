
import React, { useState, useEffect } from 'react';
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
  const isCloud = storageService.isCloudEnabled();

  // 使用實時訂閱模式
  useEffect(() => {
    const unsubscribe = storageService.subscribeSessions((updatedSessions) => {
      setSessions(updatedSessions);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = (targetRole: UserRole) => {
    if (role === targetRole) {
      if (targetRole === UserRole.ADMIN) setActiveTab('admin');
      if (targetRole === UserRole.REFEREE) setActiveTab('referee');
      return;
    }
    setShowLogin(targetRole);
  };

  const handleLogout = () => {
    setRole(UserRole.GUEST);
    setActiveTab('results');
  };

  const onLoginSuccess = (successRole: UserRole) => {
    setRole(successRole);
    setShowLogin(null);
    setActiveTab(successRole === UserRole.ADMIN ? 'admin' : 'referee');
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
            {isCloud && (
              <span className="ml-2 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
            )}
          </div>
          
          <div className="flex items-center space-x-1 sm:space-x-4">
            <nav className="flex space-x-1">
              <button 
                onClick={() => setActiveTab('results')}
                className={`px-3 py-2 rounded-md text-xs sm:text-sm font-medium transition ${activeTab === 'results' ? 'bg-indigo-800' : 'hover:bg-indigo-600'}`}
              >
                比賽結果
              </button>
              <button 
                onClick={() => handleLogin(UserRole.REFEREE)}
                className={`px-3 py-2 rounded-md text-xs sm:text-sm font-medium transition ${activeTab === 'referee' ? 'bg-indigo-800' : 'hover:bg-indigo-600'}`}
              >
                裁判專區
              </button>
              <button 
                onClick={() => handleLogin(UserRole.ADMIN)}
                className={`px-3 py-2 rounded-md text-xs sm:text-sm font-medium transition ${activeTab === 'admin' ? 'bg-indigo-800' : 'hover:bg-indigo-600'}`}
              >
                後台管理
              </button>
            </nav>

            <div className="h-8 w-[1px] bg-indigo-500 mx-2 hidden sm:block"></div>

            <div className="flex items-center space-x-2">
               {role !== UserRole.GUEST && (
                 <button 
                  onClick={handleLogout}
                  className="bg-red-500 hover:bg-red-600 text-white w-8 h-8 rounded-full flex items-center justify-center transition shadow-sm"
                 >
                   <i className="fas fa-sign-out-alt text-xs"></i>
                 </button>
               )}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-grow max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        <div className="mb-4 flex justify-between items-center text-xs">
          <div className="flex items-center text-gray-400">
            <i className={`fas fa-cloud mr-1 ${isCloud ? 'text-green-500' : 'text-gray-300'}`}></i>
            {isCloud ? '雲端即時同步中' : '本地儲存模式'}
          </div>
          <div className="font-bold text-gray-500">
            {getRoleLabel(role)}
          </div>
        </div>

        {activeTab === 'results' && (
          <ResultsBoard 
            sessions={sessions} 
            userRole={role} 
            onRefresh={() => {}} 
          />
        )}
        
        {activeTab === 'admin' && role === UserRole.ADMIN && (
          <AdminPanel sessions={sessions} onSessionCreated={() => {}} />
        )}

        {activeTab === 'referee' && role === UserRole.REFEREE && (
          <RefereePanel sessions={sessions} onResultSubmitted={() => {}} />
        )}

        {(activeTab === 'admin' || activeTab === 'referee') && role !== (activeTab === 'admin' ? UserRole.ADMIN : UserRole.REFEREE) && (
          <div className="text-center py-20 bg-white rounded-2xl shadow-sm border border-gray-100">
            <i className="fas fa-user-lock text-3xl text-indigo-200 mb-6"></i>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">請先登入</h2>
            <button 
              onClick={() => handleLogin(activeTab === 'admin' ? UserRole.ADMIN : UserRole.REFEREE)}
              className="mt-4 bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold"
            >
              登入 {activeTab === 'admin' ? '管理員' : '裁判'} 帳號
            </button>
          </div>
        )}
      </main>

      {showLogin && (
        <LoginModal 
          targetRole={showLogin} 
          onClose={() => setShowLogin(null)} 
          onSuccess={onLoginSuccess} 
        />
      )}
    </div>
  );
};

export default App;
