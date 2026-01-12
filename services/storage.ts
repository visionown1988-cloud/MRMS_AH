
import { MatchSession } from '../types.ts';
import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot,
  getDocs,
  query,
  orderBy
} from "firebase/firestore";

// --- 已填入您的 Firebase 配置 ---
const firebaseConfig = {
  apiKey: "AIzaSyBOCxuxNkZHs4HCiTpCmkRRBJ__3NOshm8",
  authDomain: "mrmsah-40577.firebaseapp.com",
  projectId: "mrmsah-40577",
  storageBucket: "mrmsah-40577.firebasestorage.app",
  messagingSenderId: "944005677344",
  appId: "1:944005677344:web:065da88e8499504eb1d745",
  measurementId: "G-T1GLP9MPTW"
};
// ------------------------------------

const STORAGE_KEY = 'match_results_app_data';

// 初始化 Firebase
let db: any = null;
if (firebaseConfig) {
  try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    console.log("Firebase Cloud Mode Enabled");
  } catch (e) {
    console.error("Firebase init failed", e);
  }
}

export const storageService = {
  isCloudEnabled: () => !!db,

  // 獲取所有場次
  getSessions: async (): Promise<MatchSession[]> => {
    if (db) {
      const q = query(collection(db, "sessions"), orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => doc.data() as MatchSession);
    }
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  },

  // 訂閱實時更新
  subscribeSessions: (callback: (sessions: MatchSession[]) => void) => {
    if (db) {
      const q = query(collection(db, "sessions"), orderBy("createdAt", "desc"));
      return onSnapshot(q, (snapshot) => {
        const sessions = snapshot.docs.map(doc => doc.data() as MatchSession);
        callback(sessions);
      });
    } else {
      // 離線模式模擬
      const interval = setInterval(() => {
        const data = localStorage.getItem(STORAGE_KEY);
        callback(data ? JSON.parse(data) : []);
      }, 2000);
      return () => clearInterval(interval);
    }
  },

  addSession: async (session: MatchSession) => {
    if (db) {
      await setDoc(doc(db, "sessions", session.id), session);
    } else {
      const sessions = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      sessions.push(session);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    }
  },

  updateSession: async (updatedSession: MatchSession) => {
    if (db) {
      await setDoc(doc(db, "sessions", updatedSession.id), updatedSession, { merge: true });
    } else {
      const sessions = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      const index = sessions.findIndex((s: any) => s.id === updatedSession.id);
      if (index !== -1) {
        sessions[index] = updatedSession;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
      }
    }
  },

  deleteSession: async (id: string) => {
    if (db) {
      await deleteDoc(doc(db, "sessions", id));
    } else {
      const sessions = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      const filtered = sessions.filter((s: any) => s.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    }
  },

  generateShareCode: (session: MatchSession): string => {
    const jsonStr = JSON.stringify(session);
    return btoa(unescape(encodeURIComponent(jsonStr)));
  },

  importFromCode: async (code: string): Promise<MatchSession | null> => {
    try {
      const jsonStr = decodeURIComponent(escape(atob(code)));
      const session = JSON.parse(jsonStr) as MatchSession;
      if (session.id && session.title) {
        await storageService.addSession(session);
        return session;
      }
      return null;
    } catch (e) {
      return null;
    }
  }
};
