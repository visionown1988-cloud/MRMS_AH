
import React, { useState, useEffect } from 'react';
import { UserRole, MatchSession } from './types';
import { storageService } from './services/storage';
import AdminPanel from './components/AdminPanel';
import RefereePanel from './components/RefereePanel';
import ResultsBoard from './components/ResultsBoard';
import LoginModal from './components/LoginModal';

const App: React.FC = () => {
  const [role, setRole] = useState<UserRole>(UserRole.GUEST);
  const [activeTab, setActiveTab] = useState<'admin' | 'referee' | 'results'>('results');
  const [showLogin, setShowLogin] = useState<UserRole | null>(null);
  const [sessions, setSessions] = useState<MatchSession[]>([]);

  useEffect(() => {
    setSessions(storageService.getSessions());
  }, []);

  const handleLogin = (targetRole: UserRole) => {
    // If clicking a role that is already the current role, just switch tab
    if (role === targetRole) {
      if (targetRole === UserRole.ADMIN) setActiveTab('admin');
      if (targetRole === UserRole.REFEREE) setActiveTab('referee');
      return;
    }
    
    // If not the current role, trigger login
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

  const updateSessions = () => {
    setSessions(storageService.getSessions());
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
      {/* Header */}
      <header className="bg-indigo-700 text-white shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2 cursor-pointer" onClick={() => setActiveTab('results')}>
            <i className="fas fa-trophy text-2xl text-yellow-400"></i>
            <h1 className="text-xl font-bold tracking-tight hidden sm:block">比賽紀錄系統</h1>
          </div>
          
          <div className="flex items-center space-x-1 sm:space-x-4">
            <nav className="flex space-x-1">
              <button 
                onClick={() => setActiveTab('results')}
                className={`px-3 py-2 rounded-md text-xs sm:text-sm font-medium transition ${activeTab === 'results' ? 'bg-indigo-800' : 'hover:bg-indigo-600'}`}
              >
                <span className="hidden sm:inline">一般選手 / </span>比賽結果
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
               <div className="hidden lg:flex flex-col items-end mr-2">
                 <span className="text-[10px] text-indigo-300 uppercase font-bold">目前身分</span>
                 <span className="text-xs font-bold">{getRoleLabel(role)}</span>
               </div>
               {role !== UserRole.GUEST && (
                 <button 
                  onClick={handleLogout}
                  title="登出切換身分"
                  className="bg-red-500 hover:bg-red-600 text-white w-8 h-8 rounded-full flex items-center justify-center transition shadow-sm"
                 >
                   <i className="fas fa-sign-out-alt text-xs"></i>
                 </button>
               )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {/* Role Indicator Banner */}
        <div className="mb-6 flex justify-between items-center bg-white p-3 rounded-lg shadow-sm border border-gray-100 lg:hidden">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${role === UserRole.ADMIN ? 'bg-purple-500' : role === UserRole.REFEREE ? 'bg-emerald-500' : 'bg-blue-500'}`}></div>
            <span className="text-sm font-medium text-gray-600">目前身分: <span className="font-bold text-gray-900">{getRoleLabel(role)}</span></span>
          </div>
          {role !== UserRole.GUEST && (
            <button onClick={handleLogout} className="text-xs text-red-500 font-bold hover:underline">
              切換身分
            </button>
          )}
        </div>

        {activeTab === 'results' && (
          <ResultsBoard 
            sessions={sessions} 
            userRole={role} 
            onRefresh={updateSessions} 
          />
        )}
        
        {activeTab === 'admin' && role === UserRole.ADMIN && (
          <AdminPanel onSessionCreated={updateSessions} />
        )}

        {activeTab === 'referee' && role === UserRole.REFEREE && (
          <RefereePanel sessions={sessions} onResultSubmitted={updateSessions} />
        )}

        {(activeTab === 'admin' || activeTab === 'referee') && role !== (activeTab === 'admin' ? UserRole.ADMIN : UserRole.REFEREE) && (
          <div className="text-center py-20 bg-white rounded-2xl shadow-sm border border-gray-100">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-indigo-50 text-indigo-500 mb-6">
              <i className="fas fa-user-lock text-3xl"></i>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">權限不足</h2>
            <p className="text-gray-500 mb-8 max-w-md mx-auto">您目前的身份為 <span className="font-bold text-indigo-600">{getRoleLabel(role)}</span>，無權訪問此頁面。請先登入正確身份。</p>
            <div className="flex flex-col sm:flex-row justify-center space-y-3 sm:space-y-0 sm:space-x-4">
               <button 
                onClick={() => handleLogin(activeTab === 'admin' ? UserRole.ADMIN : UserRole.REFEREE)}
                className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 transition shadow-lg"
               >
                 登入為 {activeTab === 'admin' ? '管理員' : '裁判'}
               </button>
               <button 
                onClick={() => setActiveTab('results')}
                className="bg-gray-100 text-gray-600 px-8 py-3 rounded-xl font-bold hover:bg-gray-200 transition"
               >
                 返回比賽結果
               </button>
            </div>
          </div>
        )}
      </main>

      {/* Mobile Footer Nav (Improved) */}
      <nav className="md:hidden bg-white border-t border-gray-200 sticky bottom-0 z-50 pb-safe">
        <div className="flex justify-around items-center h-16">
          <button 
            onClick={() => setActiveTab('results')}
            className={`flex flex-col items-center flex-1 py-1 ${activeTab === 'results' ? 'text-indigo-600' : 'text-gray-400'}`}
          >
            <i className="fas fa-medal text-lg"></i>
            <span className="text-[10px] mt-1 font-bold">比賽結果</span>
          </button>
          <button 
            onClick={() => handleLogin(UserRole.REFEREE)}
            className={`flex flex-col items-center flex-1 py-1 ${activeTab === 'referee' ? 'text-indigo-600' : 'text-gray-400'}`}
          >
            <i className="fas fa-whistle text-lg"></i>
            <span className="text-[10px] mt-1 font-bold">裁判專區</span>
          </button>
          <button 
            onClick={() => handleLogin(UserRole.ADMIN)}
            className={`flex flex-col items-center flex-1 py-1 ${activeTab === 'admin' ? 'text-indigo-600' : 'text-gray-400'}`}
          >
            <i className="fas fa-user-shield text-lg"></i>
            <span className="text-[10px] mt-1 font-bold">後台管理</span>
          </button>
        </div>
      </nav>

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
