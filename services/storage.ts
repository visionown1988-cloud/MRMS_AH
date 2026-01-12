
import { MatchSession } from '../types.ts';

const STORAGE_KEY = 'match_results_app_data';
const CLOUD_API_BASE = 'https://api.npoint.io/bins';

export const storageService = {
  getSessions: (): MatchSession[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Failed to parse local sessions:', e);
      return [];
    }
  },
  
  saveSessions: (sessions: MatchSession[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  },
  
  addSession: (session: MatchSession) => {
    const sessions = storageService.getSessions();
    sessions.push(session);
    storageService.saveSessions(sessions);
    return sessions;
  },
  
  updateSession: (updatedSession: MatchSession) => {
    const sessions = storageService.getSessions();
    const index = sessions.findIndex(s => s.id === updatedSession.id);
    if (index !== -1) {
      sessions[index] = updatedSession;
      storageService.saveSessions(sessions);
    }
    return sessions;
  },
  
  deleteSession: (id: string) => {
    const sessions = storageService.getSessions();
    const filtered = sessions.filter(s => s.id !== id);
    storageService.saveSessions(filtered);
    return filtered;
  },

  cloud: {
    createBin: async (sessions: MatchSession[]) => {
      try {
        const response = await fetch(CLOUD_API_BASE, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessions, lastUpdate: new Date().toISOString() })
        });
        const result = await response.json();
        // npoint.io 回傳的是 { id: "..." }
        return result.id || null;
      } catch (error) {
        console.error('Cloud publishing failed:', error);
        return null;
      }
    },

    updateBin: async (binId: string, sessions: MatchSession[]) => {
      try {
        const response = await fetch(`${CLOUD_API_BASE}/${binId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessions, lastUpdate: new Date().toISOString() })
        });
        return response.ok;
      } catch (error) {
        console.error('Cloud update failed:', error);
        return false;
      }
    },

    fetchBin: async (binId: string) => {
      try {
        // 加上時間戳防止快取
        const response = await fetch(`${CLOUD_API_BASE}/${binId}?t=${Date.now()}`);
        if (!response.ok) throw new Error('Bin not found');
        const result = await response.json();
        return result.sessions as MatchSession[];
      } catch (error) {
        console.error('Fetch cloud data failed:', error);
        return null;
      }
    }
  }
};
