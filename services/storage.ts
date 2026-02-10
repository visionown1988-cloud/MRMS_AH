
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
  getDoc,
  query,
  orderBy,
  enableIndexedDbPersistence,
  initializeFirestore,
  CACHE_SIZE_UNLIMITED
} from "firebase/firestore";

// --- Firebase 配置 ---
const firebaseConfig = {
  apiKey: "AIzaSyBOCxuxNkZHs4HCiTpCmkRRBJ__3NOshm8",
  authDomain: "mrmsah-40577.firebaseapp.com",
  projectId: "mrmsah-40577",
  storageBucket: "mrmsah-40577.firebasestorage.app",
  messagingSenderId: "944005677344",
  appId: "1:944005677344:web:065da88e8499504eb1d745",
  measurementId: "G-T1GLP9MPTW"
};
// --------------------

const STORAGE_KEY = 'match_results_app_data';
const SETTINGS_KEY = 'match_results_settings';

// 初始化 Firebase
let db: any = null;
if (firebaseConfig) {
  try {
    const app = initializeApp(firebaseConfig);
    // 使用 initializeFirestore 進行更細緻的配置
    db = initializeFirestore(app, {
      cacheSizeBytes: CACHE_SIZE_UNLIMITED
    });

    // 啟用離線持久化 (Offline Persistence)
    // 這對於比賽現場網路不穩的情況非常重要，能確保資料先寫入本地，網路恢復後自動同步
    if (typeof window !== 'undefined') {
      enableIndexedDbPersistence(db).catch((err) => {
        if (err.code == 'failed-precondition') {
           console.warn('Firestore persistence failed: Multiple tabs open.');
        } else if (err.code == 'unimplemented') {
           console.warn('Firestore persistence not supported by browser.');
        }
      });
    }
  } catch (e) {
    console.error("Firebase init failed", e);
  }
}

export const storageService = {
  isCloudEnabled: () => !!db,

  // --- 系統設定 (密碼等) ---
  getSettings: async () => {
    if (db) {
      try {
        const settingsDoc = await getDoc(doc(db, "config", "system"));
        if (settingsDoc.exists()) {
          return settingsDoc.data();
        }
        // 預設值
        const defaultSettings = { refereePassword: '0987', adminPassword: '0122' };
        await setDoc(doc(db, "config", "system"), defaultSettings);
        return defaultSettings;
      } catch (error) {
        console.error("Error fetching settings:", error);
        // 如果讀取失敗 (例如離線且無快取)，返回預設值或本地值
        const local = localStorage.getItem(SETTINGS_KEY);
        return local ? JSON.parse(local) : { refereePassword: '0987', adminPassword: '0122' };
      }
    }
    const local = localStorage.getItem(SETTINGS_KEY);
    return local ? JSON.parse(local) : { refereePassword: '0987', adminPassword: '0122' };
  },

  updateRefereePassword: async (newPassword: string) => {
    if (db) {
      // 使用 merge: true，Firestore Rules 會檢查 merge 後的完整文件是否包含 adminPassword
      await setDoc(doc(db, "config", "system"), { refereePassword: newPassword }, { merge: true });
    } else {
      const settings = await storageService.getSettings();
      settings.refereePassword = newPassword;
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    }
  },

  // --- 比賽場次管理 ---
  getSessions: async (): Promise<MatchSession[]> => {
    if (db) {
      try {
        const q = query(collection(db, "sessions"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => doc.data() as MatchSession);
      } catch (e) {
        console.error("Failed to get sessions", e);
        return [];
      }
    }
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  },

  subscribeSessions: (callback: (sessions: MatchSession[]) => void) => {
    if (db) {
      const q = query(collection(db, "sessions"), orderBy("createdAt", "desc"));
      return onSnapshot(q, (snapshot) => {
        const sessions = snapshot.docs.map(doc => doc.data() as MatchSession);
        callback(sessions);
      }, (error) => {
        console.error("Snapshot error:", error);
      });
    } else {
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
  }
};
