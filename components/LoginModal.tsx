
import React, { useState } from 'react';
import { UserRole } from '../types.ts';
import { storageService } from '../services/storage.ts';

interface LoginModalProps {
  targetRole: UserRole;
  onClose: () => void;
  onSuccess: (role: UserRole) => void;
}

const LoginModal: React.FC<LoginModalProps> = ({ targetRole, onClose, onSuccess }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const roleName = targetRole === UserRole.ADMIN ? '後台人員' : '裁判人員';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const settings = await storageService.getSettings();
      const correctPassword = targetRole === UserRole.ADMIN ? settings.adminPassword : settings.refereePassword;

      if (password === correctPassword) {
        onSuccess(targetRole);
      } else {
        setError('密碼錯誤，請重新輸入');
      }
    } catch (e) {
      setError('連線失敗，請檢查網路狀態');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-300">
        <div className="bg-indigo-600 p-6 text-white text-center">
          <i className={`fas ${targetRole === UserRole.ADMIN ? 'fa-user-shield' : 'fa-whistle'} text-4xl mb-4`}></i>
          <h2 className="text-2xl font-bold">{roleName} 登入</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-8">
          <div className="mb-6">
            <label className="block text-gray-700 text-sm font-bold mb-2">請輸入密碼</label>
            <input
              autoFocus
              disabled={isLoading}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none transition text-center text-2xl tracking-widest"
              placeholder="••••"
            />
          </div>
          {error && <p className="text-red-500 text-sm mb-4 text-center font-medium">{error}</p>}
          <div className="flex space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium shadow-md flex justify-center items-center"
            >
              {isLoading ? (
                <i className="fas fa-spinner fa-spin"></i>
              ) : (
                '確定登入'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginModal;
