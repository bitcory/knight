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
  onSnapshot,
  query,
  orderBy,
  limit,
  addDoc,
  serverTimestamp,
  Timestamp
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
  type: 'enhancement' | 'battle' | 'system' | 'chat' | 'showoff';
  content: string;
  timestamp: Timestamp;
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
