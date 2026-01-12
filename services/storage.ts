
import { MatchSession } from '../types.ts';

const STORAGE_KEY = 'match_results_app_data';
const CLOUD_API_BASE = 'https://api.npoint.io/bins';

export const storageService = {
  getSessions: (): MatchSession[] => {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  },
  
  saveSessions: (sessions: MatchSession[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  },
  
  addSession: (session: MatchSession) => {
    const sessions = storageService.getSessions();
    sessions.push(session);
    storageService.saveSessions(sessions);
  },
  
  updateSession: (updatedSession: MatchSession) => {
    const sessions = storageService.getSessions();
    const index = sessions.findIndex(s => s.id === updatedSession.id);
    if (index !== -1) {
      sessions[index] = updatedSession;
      storageService.saveSessions(sessions);
    }
  },
  
  deleteSession: (id: string) => {
    const sessions = storageService.getSessions();
    const filtered = sessions.filter(s => s.id !== id);
    storageService.saveSessions(filtered);
  },

  // 雲端同步核心邏輯
  cloud: {
    // 創建一個新的雲端同步 Bin
    createBin: async (sessions: MatchSession[]) => {
      try {
        const response = await fetch(CLOUD_API_BASE, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessions, lastUpdate: new Date().toISOString() })
        });
        const result = await response.json();
        return result.binId; // 回傳給使用者的同步代碼
      } catch (error) {
        console.error('Failed to create cloud bin:', error);
        return null;
      }
    },

    // 更新現有的雲端資料
    updateBin: async (binId: string, sessions: MatchSession[]) => {
      try {
        await fetch(`${CLOUD_API_BASE}/${binId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessions, lastUpdate: new Date().toISOString() })
        });
        return true;
      } catch (error) {
        console.error('Failed to update cloud bin:', error);
        return false;
      }
    },

    // 抓取雲端資料
    fetchBin: async (binId: string) => {
      try {
        const response = await fetch(`${CLOUD_API_BASE}/${binId}`);
        if (!response.ok) throw new Error('Bin not found');
        const result = await response.json();
        return result.sessions as MatchSession[];
      } catch (error) {
        console.error('Failed to fetch cloud bin:', error);
        return null;
      }
    }
  }
};
