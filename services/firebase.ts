import { initializeApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  addDoc,
  serverTimestamp,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import { Weapon, PlayerStats, ChatMessage } from '../types';

// Firebase 설정 - Firebase Console에서 복사한 값으로 교체하세요
// https://console.firebase.google.com/ 에서 프로젝트 생성 후
// 프로젝트 설정 > 일반 > 내 앱 > 웹 앱 추가 > Firebase SDK snippet
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "YOUR_API_KEY",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "YOUR_AUTH_DOMAIN",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "YOUR_PROJECT_ID",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "YOUR_STORAGE_BUCKET",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "YOUR_MESSAGING_SENDER_ID",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "YOUR_APP_ID"
};

// Firebase 초기화
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// ============ 인증 관련 함수 ============

export const registerUser = async (email: string, password: string, username: string) => {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;

  // Firestore에 사용자 프로필 저장
  await setDoc(doc(db, 'users', user.uid), {
    uid: user.uid,
    username,
    email,
    createdAt: serverTimestamp()
  });

  return user;
};

export const loginUser = async (email: string, password: string) => {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  return userCredential.user;
};

export const logoutUser = async () => {
  await signOut(auth);
};

export const onAuthChange = (callback: (user: FirebaseUser | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

// ============ 사용자 데이터 관련 함수 ============

export interface UserProfile {
  uid: string;
  username: string;
  email: string;
  profileImage?: string; // base64 encoded image
  lastUsernameChange?: number; // timestamp of last username change
  lastLoginAt?: number; // timestamp of last login
}

export interface GameData {
  stats: PlayerStats;
  weapon: Weapon;
  lastUpdated: Timestamp;
}

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  const docSnap = await getDoc(doc(db, 'users', uid));
  if (docSnap.exists()) {
    return docSnap.data() as UserProfile;
  }
  return null;
};

export const updateUserProfile = async (uid: string, updates: Partial<UserProfile>) => {
  await updateDoc(doc(db, 'users', uid), updates);
};

export const getGameData = async (uid: string): Promise<GameData | null> => {
  const docSnap = await getDoc(doc(db, 'gameData', uid));
  if (docSnap.exists()) {
    return docSnap.data() as GameData;
  }
  return null;
};

export const saveGameData = async (uid: string, stats: PlayerStats, weapon: Weapon) => {
  await setDoc(doc(db, 'gameData', uid), {
    stats,
    weapon,
    lastUpdated: serverTimestamp()
  }, { merge: true });
};

// 관리자 골드 선물 함수
export const giftGoldToUser = async (targetUid: string, goldAmount: number): Promise<boolean> => {
  try {
    const gameData = await getGameData(targetUid);
    if (!gameData) return false;

    const updatedStats = {
      ...gameData.stats,
      gold: (gameData.stats.gold || 0) + goldAmount
    };

    await setDoc(doc(db, 'gameData', targetUid), {
      ...gameData,
      stats: updatedStats,
      lastUpdated: serverTimestamp()
    }, { merge: true });

    return true;
  } catch (error) {
    console.error('Gift gold error:', error);
    return false;
  }
};

export const getAllUsers = async (): Promise<UserProfile[]> => {
  const snapshot = await getDocs(collection(db, 'users'));
  return snapshot.docs.map(doc => doc.data() as UserProfile);
};

export const getAllGameData = async (): Promise<{ uid: string; data: GameData }[]> => {
  const snapshot = await getDocs(collection(db, 'gameData'));
  return snapshot.docs.map(doc => ({ uid: doc.id, data: doc.data() as GameData }));
};

// ============ 실시간 채팅/활동 피드 ============

export interface GlobalChatMessage {
  id?: string;
  uid: string;
  username: string;
  type: 'enhancement' | 'battle' | 'system' | 'chat' | 'showoff' | 'whisper';
  content: string;
  timestamp: Timestamp;
  whisperTo?: string; // 귓속말 대상 username
  metadata?: {
    success?: boolean;
    weaponLevel?: number;
    weaponName?: string;
    weaponType?: string;
    weaponDescription?: string;
    weaponElement?: string;
    weaponElementLevel?: number;
    opponentName?: string;
    goldChange?: number;
  };
}

export const sendGlobalMessage = async (message: Omit<GlobalChatMessage, 'id' | 'timestamp'>) => {
  // undefined/null 값 재귀적 필터링
  const removeUndefined = (obj: any): any => {
    if (obj === null || obj === undefined) return undefined;
    if (typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(removeUndefined).filter(v => v !== undefined);

    const cleaned: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined && value !== null) {
        const cleanedValue = removeUndefined(value);
        if (cleanedValue !== undefined) {
          cleaned[key] = cleanedValue;
        }
      }
    }
    return Object.keys(cleaned).length > 0 ? cleaned : undefined;
  };

  const cleanedMessage: any = {
    uid: message.uid,
    username: message.username,
    type: message.type,
    content: message.content,
    timestamp: serverTimestamp()
  };

  // 귓속말 대상 추가
  if (message.whisperTo) {
    cleanedMessage.whisperTo = message.whisperTo;
  }

  const cleanMetadata = removeUndefined(message.metadata);
  if (cleanMetadata && Object.keys(cleanMetadata).length > 0) {
    cleanedMessage.metadata = cleanMetadata;
  }

  await addDoc(collection(db, 'globalChat'), cleanedMessage);
};

export const subscribeToGlobalChat = (
  callback: (messages: GlobalChatMessage[]) => void,
  limitCount: number = 50
) => {
  const q = query(
    collection(db, 'globalChat'),
    orderBy('timestamp', 'desc'),
    limit(limitCount)
  );

  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as GlobalChatMessage))
      .reverse(); // 오래된 것이 위로
    callback(messages);
  });
};

// ============ PvP 매칭 ============

export const getRandomOpponent = async (currentUid: string): Promise<{ profile: UserProfile; gameData: GameData } | null> => {
  const users = await getAllUsers();
  const otherUsers = users.filter(u => u.uid !== currentUid);

  if (otherUsers.length === 0) return null;

  const randomUser = otherUsers[Math.floor(Math.random() * otherUsers.length)];
  const gameData = await getGameData(randomUser.uid);

  if (!gameData) return null;

  return { profile: randomUser, gameData };
};

// Firebase 설정 확인
export const isFirebaseConfigured = () => {
  return firebaseConfig.apiKey !== "YOUR_API_KEY" &&
         firebaseConfig.projectId !== "YOUR_PROJECT_ID";
};

// ============ 관리자 데이터 초기화 함수 ============

// 채팅 메시지 전체 삭제
export const clearAllChatMessages = async (): Promise<number> => {
  const snapshot = await getDocs(collection(db, 'globalChat'));
  const batch = writeBatch(db);
  let count = 0;

  snapshot.docs.forEach((document) => {
    batch.delete(doc(db, 'globalChat', document.id));
    count++;
  });

  await batch.commit();
  return count;
};

// 7일 이상 된 오래된 채팅 메시지 삭제
export const clearOldChatMessages = async (daysOld: number = 7): Promise<number> => {
  const snapshot = await getDocs(collection(db, 'globalChat'));
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  let count = 0;

  for (const document of snapshot.docs) {
    const data = document.data();
    const timestamp = data.timestamp?.toDate?.();

    if (timestamp && timestamp < cutoffDate) {
      await deleteDoc(doc(db, 'globalChat', document.id));
      count++;
    }
  }

  return count;
};

// 관리자 제외 모든 유저 및 게임 데이터 삭제
export const clearAllDataExceptAdmin = async (adminUid: string): Promise<{ users: number; gameData: number }> => {
  let usersDeleted = 0;
  let gameDataDeleted = 0;

  // users 컬렉션 삭제 (관리자 제외)
  const usersSnapshot = await getDocs(collection(db, 'users'));
  for (const document of usersSnapshot.docs) {
    if (document.id !== adminUid) {
      await deleteDoc(doc(db, 'users', document.id));
      usersDeleted++;
    }
  }

  // gameData 컬렉션 삭제 (관리자 제외)
  const gameDataSnapshot = await getDocs(collection(db, 'gameData'));
  for (const document of gameDataSnapshot.docs) {
    if (document.id !== adminUid) {
      await deleteDoc(doc(db, 'gameData', document.id));
      gameDataDeleted++;
    }
  }

  return { users: usersDeleted, gameData: gameDataDeleted };
};

// 마지막 로그인 시간 업데이트
export const updateLastLogin = async (uid: string) => {
  await updateDoc(doc(db, 'users', uid), {
    lastLoginAt: Date.now()
  });
};

// 비활성 계정 삭제 (N일 이상 미접속)
export const deleteInactiveUsers = async (daysInactive: number, adminEmails: string[]): Promise<{ users: number; gameData: number }> => {
  const cutoffTime = Date.now() - (daysInactive * 24 * 60 * 60 * 1000);
  let usersDeleted = 0;
  let gameDataDeleted = 0;

  const usersSnapshot = await getDocs(collection(db, 'users'));

  for (const document of usersSnapshot.docs) {
    const userData = document.data() as UserProfile;

    // 관리자 계정은 삭제하지 않음
    if (adminEmails.includes(userData.email)) continue;

    // lastLoginAt이 없거나 cutoffTime보다 오래된 경우 삭제
    const lastLogin = userData.lastLoginAt || 0;

    if (lastLogin < cutoffTime) {
      // users 문서 삭제
      await deleteDoc(doc(db, 'users', document.id));
      usersDeleted++;

      // gameData 문서도 삭제
      const gameDataDoc = await getDoc(doc(db, 'gameData', document.id));
      if (gameDataDoc.exists()) {
        await deleteDoc(doc(db, 'gameData', document.id));
        gameDataDeleted++;
      }
    }
  }

  return { users: usersDeleted, gameData: gameDataDeleted };
};
