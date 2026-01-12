
import { MatchSession } from '../types';

const STORAGE_KEY = 'match_results_app_data';

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
  }
};
