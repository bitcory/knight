import React, { useState, useEffect } from 'react';
import {
  Sword,
  ShoppingBag,
  Hammer,
  User as UserIcon,
  Coins,
  ScrollText,
  AlertCircle,
  Sparkles,
  RefreshCw,
  Trophy,
  Skull,
  ChevronRight,
  ChevronDown,
  ShieldCheck,
  Zap,
  Lock,
  UserPlus,
  LogIn,
  Send,
  Swords,
  LogOut,
  WifiOff,
  Globe,
  Flame,
  Droplets,
  Sun,
  Moon,
  Ghost,
  Gift
} from 'lucide-react';
import {
  Weapon,
  WeaponType,
  ElementType,
  PlayerStats,
  GameLog,
  GameView,
  MAX_LEVEL,
  EnhancementConfig
} from './types';
import { WeaponCard, MiniWeaponCard, ChatWeaponCard } from './components/WeaponCard';
import { generateEnhancementFlavor, generateBattleLog } from './services/geminiService';
import {
  registerUser,
  loginUser,
  logoutUser,
  onAuthChange,
  getUserProfile,
  getGameData,
  saveGameData,
  sendGlobalMessage,
  subscribeToGlobalChat,
  getRandomOpponent,
  isFirebaseConfigured,
  getAllUsers,
  getAllGameData,
  GlobalChatMessage,
  UserProfile
} from './services/firebase';
import { User as FirebaseUser } from 'firebase/auth';

// --- Constants ---
const INITIAL_STATS: PlayerStats = {
  username: '',
  gold: 300000,
  scrolls: 5,
  wins: 0,
  losses: 0
};

const INITIAL_WEAPON: Weapon = {
  id: 'starter_sword',
  type: WeaponType.SWORD,
  name: '녹슨 검',
  level: 0,
  baseDamage: 10,
  description: '오랫동안 사용되지 않아 녹이 슨 검입니다.',
  totalEnhanceCost: 0
};

const SCROLL_PRICE = 100000; // 강화 주문서 가격 (성공 확률 +20%)

// 무기 상성 시스템
// 검 > 창 (검으로 창을 쳐내고 접근)
// 창 > 도끼 (긴 사거리로 도끼를 제압)
// 도끼 > 망치 (빠른 스윙으로 망치를 압도)
// 망치 > 검 (묵직한 타격으로 검을 부숨)
const WEAPON_ADVANTAGE: Record<WeaponType, WeaponType> = {
  [WeaponType.SWORD]: WeaponType.SPEAR,   // 검은 창에 강함
  [WeaponType.SPEAR]: WeaponType.AXE,     // 창은 도끼에 강함
  [WeaponType.AXE]: WeaponType.HAMMER,    // 도끼는 망치에 강함
  [WeaponType.HAMMER]: WeaponType.SWORD,  // 망치는 검에 강함
};

const WEAPON_TYPE_NAMES: Record<WeaponType, string> = {
  [WeaponType.SWORD]: '검',
  [WeaponType.AXE]: '도끼',
  [WeaponType.HAMMER]: '망치',
  [WeaponType.SPEAR]: '창'
};

// 상성 체크: myType이 opponentType에 대해 유리한지
const getTypeAdvantage = (myType: WeaponType, opponentType: WeaponType): 'advantage' | 'disadvantage' | 'neutral' => {
  if (WEAPON_ADVANTAGE[myType] === opponentType) return 'advantage';
  if (WEAPON_ADVANTAGE[opponentType] === myType) return 'disadvantage';
  return 'neutral';
};

// 속성 시스템
// 화염 > 저주 (불꽃이 저주를 정화)
// 저주 > 빛 (어둠이 빛을 삼킴)
// 빛 > 어둠 (빛이 어둠을 몰아냄)
// 어둠 > 물 (어둠이 물을 흡수)
// 물 > 화염 (물이 불을 끔)
const ELEMENT_ADVANTAGE: Record<ElementType, ElementType | null> = {
  [ElementType.NONE]: null,
  [ElementType.FIRE]: ElementType.CURSE,
  [ElementType.CURSE]: ElementType.LIGHT,
  [ElementType.LIGHT]: ElementType.DARK,
  [ElementType.DARK]: ElementType.WATER,
  [ElementType.WATER]: ElementType.FIRE,
};

const ELEMENT_NAMES: Record<ElementType, string> = {
  [ElementType.NONE]: '없음',
  [ElementType.FIRE]: '화염',
  [ElementType.WATER]: '물',
  [ElementType.LIGHT]: '빛',
  [ElementType.DARK]: '어둠',
  [ElementType.CURSE]: '저주'
};

const ELEMENT_COLORS: Record<ElementType, string> = {
  [ElementType.NONE]: 'text-slate-400',
  [ElementType.FIRE]: 'text-orange-400',
  [ElementType.WATER]: 'text-blue-400',
  [ElementType.LIGHT]: 'text-yellow-300',
  [ElementType.DARK]: 'text-purple-400',
  [ElementType.CURSE]: 'text-green-400'
};

const ELEMENT_BG_COLORS: Record<ElementType, string> = {
  [ElementType.NONE]: 'bg-slate-800',
  [ElementType.FIRE]: 'bg-orange-900/50 border-orange-500/30',
  [ElementType.WATER]: 'bg-blue-900/50 border-blue-500/30',
  [ElementType.LIGHT]: 'bg-yellow-900/50 border-yellow-500/30',
  [ElementType.DARK]: 'bg-purple-900/50 border-purple-500/30',
  [ElementType.CURSE]: 'bg-green-900/50 border-green-500/30'
};

// 속성 상성 체크
const getElementAdvantage = (myElement: ElementType | undefined, opponentElement: ElementType | undefined): 'advantage' | 'disadvantage' | 'neutral' => {
  if (!myElement || myElement === ElementType.NONE || !opponentElement || opponentElement === ElementType.NONE) {
    return 'neutral';
  }
  if (ELEMENT_ADVANTAGE[myElement] === opponentElement) return 'advantage';
  if (ELEMENT_ADVANTAGE[opponentElement] === myElement) return 'disadvantage';
  return 'neutral';
};

// 속성 강화 설정
const MAX_ELEMENT_LEVEL = 10;
const getElementEnhanceConfig = (level: number): EnhancementConfig => {
  if (level === 0) {
    return { cost: 5000, successChance: 0.90, maintainChance: 0.10, destroyChance: 0 };
  } else if (level < 3) {
    return { cost: 10000 * (level + 1), successChance: 0.80, maintainChance: 0.20, destroyChance: 0 };
  } else if (level < 5) {
    return { cost: 25000 * (level + 1), successChance: 0.60, maintainChance: 0.35, destroyChance: 0.05 };
  } else if (level < 7) {
    return { cost: 50000 * (level + 1), successChance: 0.45, maintainChance: 0.45, destroyChance: 0.10 };
  } else {
    return { cost: 100000 * (level + 1), successChance: 0.30, maintainChance: 0.55, destroyChance: 0.15 };
  }
};

// Returns success, maintain, destroy chances based on level
// 일주일 내 +20 달성 가능하도록 확률 상향 조정
const getEnhanceConfig = (level: number): EnhancementConfig => {
  if (level === 0) {
    return { cost: 100, successChance: 0.95, maintainChance: 0.05, destroyChance: 0 };
  } else if (level >= 1 && level < 5) {
    return { cost: 200 * (level + 1), successChance: 0.90, maintainChance: 0.10, destroyChance: 0 };
  } else if (level >= 5 && level < 8) {
    return { cost: 500 * (level + 1), successChance: 0.80, maintainChance: 0.18, destroyChance: 0.02 };
  } else if (level >= 8 && level < 10) {
    return { cost: 1000 * (level + 1), successChance: 0.65, maintainChance: 0.30, destroyChance: 0.05 };
  } else if (level >= 10 && level < 13) {
    return { cost: 3000 * (level + 1), successChance: 0.50, maintainChance: 0.40, destroyChance: 0.10 };
  } else if (level >= 13 && level < 16) {
    return { cost: 8000 * (level + 1), successChance: 0.40, maintainChance: 0.45, destroyChance: 0.15 };
  } else if (level >= 16 && level < 19) {
    return { cost: 20000 * (level + 1), successChance: 0.30, maintainChance: 0.50, destroyChance: 0.20 };
  } else {
    return { cost: 50000 * (level + 1), successChance: 0.20, maintainChance: 0.55, destroyChance: 0.25 };
  }
};

// --- Sub-components ---

// 채팅 입력 컴포넌트 (성능 최적화를 위해 분리)
const ChatInput: React.FC<{ onSubmit: (text: string) => void }> = React.memo(({ onSubmit }) => {
  const [input, setInput] = useState('');

  const handleSubmit = () => {
    const text = input.trim();
    if (!text) return;
    setInput('');
    onSubmit(text);
  };

  return (
    <div className="flex gap-2">
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && handleSubmit()}
        placeholder="채팅을 입력하세요..."
        className="flex-1 bg-slate-800/80 border border-slate-700 rounded-2xl py-3 px-4 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
      />
      <button
        onClick={handleSubmit}
        className="bg-blue-600 active:bg-blue-700 text-white px-4 py-3 rounded-2xl flex items-center justify-center active:scale-95 transition-all"
      >
        <Send size={20} />
      </button>
    </div>
  );
});

const Navigation: React.FC<{ current: GameView; onSelect: (v: GameView) => void; isFrame?: boolean }> = ({ current, onSelect, isFrame = false }) => (
  <nav className={`${isFrame ? 'absolute' : 'fixed'} bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-xl border-t border-white/10 z-40 shadow-2xl`}>
    <div className="flex justify-around items-center h-16 px-2 pb-safe">
      {[
        { id: GameView.HOME, icon: UserIcon, label: '정보' },
        { id: GameView.SHOP, icon: ShoppingBag, label: '상점' },
        { id: GameView.ENHANCE, icon: Hammer, label: '강화' },
        { id: GameView.BATTLE, icon: Sword, label: '전투' },
      ].map((item) => {
        const isActive = current === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            className={`relative flex flex-col items-center justify-center min-w-[72px] h-16 rounded-2xl transition-all duration-200 active:scale-95 ${isActive
              ? 'text-yellow-400 bg-yellow-500/10'
              : 'text-slate-500 active:text-slate-300 active:bg-slate-800/50'
              }`}
          >
            <item.icon size={24} strokeWidth={isActive ? 2.5 : 2} className={isActive ? 'drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]' : ''} />
            <span className={`text-[11px] font-semibold mt-1 ${isActive ? 'text-yellow-400' : 'text-slate-500'}`}>{item.label}</span>
          </button>
        );
      })}
    </div>
  </nav>
);

const Header: React.FC<{ stats: PlayerStats; isFrame?: boolean }> = ({ stats, isFrame = false }) => (
  <header className={`sticky top-0 z-40 w-full px-4 py-3 ${isFrame ? 'pt-8' : 'pt-safe'} bg-slate-950/90 backdrop-blur-xl border-b border-white/5`}>
    <div className="flex justify-between items-center">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center text-white font-bold text-lg shadow-lg">
          {(stats.username || "U")[0].toUpperCase()}
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] text-slate-500 uppercase tracking-widest">기사</span>
          <h1 className="font-bold text-base leading-tight text-white truncate max-w-[100px]">
            {stats.username || "이름없음"}
          </h1>
        </div>
      </div>
      <div className="flex gap-2">
        <div className="glass-panel px-3 py-2 rounded-xl flex items-center gap-2">
          <Coins size={16} className="text-yellow-400" />
          <span className="text-sm font-mono font-bold text-yellow-100">{stats.gold.toLocaleString()}</span>
        </div>
        <div className="glass-panel px-3 py-2 rounded-xl flex items-center gap-2">
          <ScrollText size={16} className="text-blue-400" />
          <span className="text-sm font-mono font-bold text-blue-100">{stats.scrolls}</span>
        </div>
      </div>
    </div>
  </header>
);

// --- Main Component ---

export default function App() {
  const [view, setView] = useState<GameView>(GameView.LOGIN);
  const [stats, setStats] = useState<PlayerStats>(INITIAL_STATS);
  const [weapon, setWeapon] = useState<Weapon>(INITIAL_WEAPON);
  const [logs, setLogs] = useState<GameLog[]>([]);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [showEnhanceResult, setShowEnhanceResult] = useState<{ success: boolean, message: string, isGoddess?: boolean } | null>(null);
  const [isTopWinner, setIsTopWinner] = useState(false); // 승리 랭킹 1위 여부

  // Element Enhancement State
  const [isElementEnhancing, setIsElementEnhancing] = useState(false);
  const [showElementResult, setShowElementResult] = useState<{ success: boolean, message: string } | null>(null);
  const [selectedElement, setSelectedElement] = useState<ElementType | null>(null);

  // Firebase Auth State
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isFirebaseReady, setIsFirebaseReady] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  // Login State
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [inputEmail, setInputEmail] = useState('');
  const [inputUsername, setInputUsername] = useState('');
  const [inputPassword, setInputPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Chat State - Global chat from Firebase
  const [globalMessages, setGlobalMessages] = useState<GlobalChatMessage[]>([]);
  const [showWeaponDetail, setShowWeaponDetail] = useState(false);
  const [useScrollForEnhance, setUseScrollForEnhance] = useState(false); // 주문서 사용 여부
  const chatEndRef = React.useRef<HTMLDivElement>(null);

  // Battle State
  const [availableOpponents, setAvailableOpponents] = useState<{ profile: UserProfile, gameData: any }[]>([]);
  const [dailyBattleCount, setDailyBattleCount] = useState(0);
  const [lastBattleDate, setLastBattleDate] = useState<string>('');
  const [selectedOpponent, setSelectedOpponent] = useState<{ profile: UserProfile, gameData: any } | null>(null);
  const [isLoadingOpponents, setIsLoadingOpponents] = useState(false);
  const MAX_DAILY_BATTLES = 20;

  // 출석체크 State
  const [showAttendancePopup, setShowAttendancePopup] = useState(false);
  const [lastAttendanceTime, setLastAttendanceTime] = useState<number>(() => {
    const saved = localStorage.getItem('lastAttendanceTime');
    return saved ? parseInt(saved, 10) : 0;
  });
  const ATTENDANCE_INTERVAL = 4 * 60 * 60 * 1000; // 4시간 (밀리초)
  const ATTENDANCE_REWARD = 500000; // 50만 골드

  // 치트키 State (강화-강화-상점-상점-강화 순서로 입력 시 90% 성공률)
  const cheatSequenceRef = React.useRef<string[]>([]);
  const [isCheatActive, setIsCheatActive] = useState(false);
  const CHEAT_CODE = ['ENHANCE', 'ENHANCE', 'SHOP', 'SHOP', 'ENHANCE'];

  const handleNavClick = (viewId: GameView) => {
    // 치트키 시퀀스 추적
    let key = '';
    if (viewId === GameView.ENHANCE) key = 'ENHANCE';
    else if (viewId === GameView.SHOP) key = 'SHOP';

    if (key) {
      cheatSequenceRef.current = [...cheatSequenceRef.current, key].slice(-5);

      // 치트키 확인
      if (cheatSequenceRef.current.length === 5 &&
          cheatSequenceRef.current.every((v, i) => v === CHEAT_CODE[i])) {
        setIsCheatActive(true);
        cheatSequenceRef.current = [];
        // 은밀한 피드백 (화면 깜빡임)
        document.body.style.transition = 'filter 0.1s';
        document.body.style.filter = 'brightness(1.5)';
        setTimeout(() => {
          document.body.style.filter = 'brightness(1)';
        }, 100);
        console.log('🎮 치트 활성화!'); // 디버그용
      }
    } else {
      // 다른 버튼 누르면 시퀀스 리셋
      cheatSequenceRef.current = [];
    }

    setView(viewId);

    // 정보(HOME) 탭 클릭 시 스크롤 하단으로
    if (viewId === GameView.HOME) {
      setTimeout(() => scrollChatToBottom(true), 100);
    }
  };

  // Firebase 설정 확인
  const firebaseConfigured = isFirebaseConfigured();

  // Firebase Auth 상태 감시
  useEffect(() => {
    if (!firebaseConfigured) {
      setIsFirebaseReady(true);
      return;
    }

    const unsubscribe = onAuthChange(async (user) => {
      setFirebaseUser(user);
      if (user) {
        // 사용자 프로필 및 게임 데이터 로드
        const profile = await getUserProfile(user.uid);
        const gameData = await getGameData(user.uid);

        // 프로필이 있으면 설정, 없으면 기본값으로 설정
        const userProfileData = profile || {
          uid: user.uid,
          username: user.email?.split('@')[0] || '기사',
          email: user.email || ''
        };
        setUserProfile(userProfileData);
        setStats(prev => ({ ...prev, username: userProfileData.username }));

        if (gameData) {
          setStats(gameData.stats);
          setWeapon(gameData.weapon);
        } else {
          // 새 사용자 - 초기 데이터 설정
          const initialStats = { ...INITIAL_STATS, username: userProfileData.username };
          setStats(initialStats);
          setWeapon(INITIAL_WEAPON);
          await saveGameData(user.uid, initialStats, INITIAL_WEAPON);
        }

        setView(GameView.HOME);
      } else {
        setUserProfile(null);
        setView(GameView.LOGIN);
      }
      setIsFirebaseReady(true);
    });

    return () => unsubscribe();
  }, [firebaseConfigured]);

  // 실시간 글로벌 채팅 구독
  useEffect(() => {
    if (!firebaseConfigured || !firebaseUser) return;

    const unsubscribe = subscribeToGlobalChat((messages) => {
      setGlobalMessages(messages);
    }, 100);

    return () => unsubscribe();
  }, [firebaseConfigured, firebaseUser]);

  // 게임 데이터 저장 (stats나 weapon 변경 시)
  useEffect(() => {
    if (!firebaseConfigured || !firebaseUser || view === GameView.LOGIN) return;

    const saveTimeout = setTimeout(() => {
      saveGameData(firebaseUser.uid, stats, weapon);
    }, 1000); // 1초 디바운스

    return () => clearTimeout(saveTimeout);
  }, [stats, weapon, firebaseUser, view, firebaseConfigured]);

  // Auto scroll to bottom when messages change
  const chatContainerRef = React.useRef<HTMLDivElement>(null);

  // 스크롤을 최하단으로 이동하는 함수 (iOS Safari 호환)
  const scrollChatToBottom = React.useCallback((force: boolean = false) => {
    const doScroll = () => {
      // ref 사용 (iOS에서 더 안정적)
      const container = chatContainerRef.current;
      const endMarker = chatEndRef.current;

      if (container) {
        // 방법 1: scrollTop 직접 설정
        container.scrollTop = container.scrollHeight;
      }

      if (endMarker) {
        // 방법 2: scrollIntoView (iOS Safari 호환)
        endMarker.scrollIntoView(false);
      }
    };

    // 즉시 실행
    doScroll();

    // 여러 번 재시도 (iOS 렌더링 타이밍)
    setTimeout(doScroll, 100);
    setTimeout(doScroll, 300);
    if (force) {
      setTimeout(doScroll, 600);
      setTimeout(doScroll, 1000);
    }
  }, []);

  // 초기 로드 또는 로그인 시 스크롤
  const initialScrollDone = React.useRef(false);
  useEffect(() => {
    if (view === GameView.HOME && globalMessages.length > 0 && firebaseUser) {
      if (!initialScrollDone.current) {
        initialScrollDone.current = true;
        scrollChatToBottom(true); // 강제 스크롤
      }
    }
  }, [view, globalMessages.length, firebaseUser, scrollChatToBottom]);

  // 로그인 시 초기 스크롤 리셋
  useEffect(() => {
    if (firebaseUser) {
      initialScrollDone.current = false;
    }
  }, [firebaseUser]);

  // 새 메시지 추가 시 스크롤 (강화 결과 등)
  const prevMessageCount = React.useRef(0);
  useEffect(() => {
    if (globalMessages.length > prevMessageCount.current) {
      // 새 메시지가 추가되면 항상 스크롤
      scrollChatToBottom(prevMessageCount.current === 0);
    }
    prevMessageCount.current = globalMessages.length;
  }, [globalMessages.length, scrollChatToBottom]);

  // 스크롤 버튼 표시 여부 (사용자가 직접 스크롤할 때만 업데이트)
  const [showScrollButton, setShowScrollButton] = useState(true);

  useEffect(() => {
    const container = document.getElementById('chat-scroll-container');
    if (!container) return;

    const handleScroll = () => {
      const threshold = 200;
      const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
      // 맨 아래 근처면 버튼 숨김
      if (distanceFromBottom < threshold) {
        setShowScrollButton(false);
      } else {
        setShowScrollButton(true);
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [view]);

  // 일일 전투 횟수 체크 및 리셋
  useEffect(() => {
    const today = new Date().toDateString();
    if (lastBattleDate !== today) {
      setDailyBattleCount(0);
      setLastBattleDate(today);
    }
  }, [lastBattleDate]);

  // 출석체크 4시간마다 체크
  useEffect(() => {
    if (!firebaseUser || view === GameView.LOGIN) return;

    const checkAttendance = () => {
      const now = Date.now();
      const timeSinceLastAttendance = now - lastAttendanceTime;
      if (timeSinceLastAttendance >= ATTENDANCE_INTERVAL) {
        setShowAttendancePopup(true);
      }
    };

    // 초기 체크
    checkAttendance();

    // 1분마다 체크
    const interval = setInterval(checkAttendance, 60 * 1000);
    return () => clearInterval(interval);
  }, [firebaseUser, view, lastAttendanceTime]);

  // 출석체크 보상 받기
  const handleAttendanceCheck = async () => {
    const now = Date.now();
    setLastAttendanceTime(now);
    localStorage.setItem('lastAttendanceTime', now.toString());
    setStats(prev => ({ ...prev, gold: prev.gold + ATTENDANCE_REWARD }));
    setShowAttendancePopup(false);

    // 글로벌 채팅에 알림
    await sendGlobalChatMessage('system', `🎁 출석체크 완료! +${ATTENDANCE_REWARD.toLocaleString()}G 획득!`);
  };

  // 전투 화면 진입 시 상대 목록 불러오기 및 랭킹 체크
  const loadOpponents = async () => {
    if (!firebaseUser) return;

    setIsLoadingOpponents(true);
    try {
      const users = await getAllUsers();
      const gameDataList = await getAllGameData();

      const opponents = users
        .filter(u => u.uid !== firebaseUser.uid)
        .map(user => {
          const gameData = gameDataList.find(g => g.uid === user.uid);
          return gameData ? { profile: user, gameData: gameData.data } : null;
        })
        .filter((o): o is { profile: UserProfile, gameData: any } => o !== null);

      setAvailableOpponents(opponents);

      // 승리 랭킹 1위 체크 (밸런스 패널티)
      const allPlayers = gameDataList.map(g => ({ uid: g.uid, wins: g.data.stats?.wins || 0 }));
      allPlayers.sort((a, b) => b.wins - a.wins);
      if (allPlayers.length > 1 && allPlayers[0].uid === firebaseUser.uid && allPlayers[0].wins > allPlayers[1].wins) {
        setIsTopWinner(true);
      } else {
        setIsTopWinner(false);
      }
    } catch (error) {
      console.error('Failed to load opponents:', error);
    } finally {
      setIsLoadingOpponents(false);
    }
  };

  // 전투 화면 진입 시 상대 목록 로드
  useEffect(() => {
    if (view === GameView.BATTLE && firebaseUser) {
      loadOpponents();
    }
  }, [view, firebaseUser]);

  // 로그인 시 랭킹 체크 (강화 패널티 적용을 위해)
  useEffect(() => {
    if (firebaseUser && view !== GameView.LOGIN) {
      loadOpponents();
    }
  }, [firebaseUser]);

  const addLog = (type: GameLog['type'], message: string, subtext?: string, success?: boolean) => {
    setLogs(prev => [{
      id: Date.now().toString(),
      type,
      message,
      subtext,
      timestamp: Date.now(),
      success
    }, ...prev].slice(0, 50));
  };

  // 글로벌 메시지 전송 (Firebase)
  const sendGlobalChatMessage = async (
    type: GlobalChatMessage['type'],
    content: string,
    metadata?: GlobalChatMessage['metadata']
  ) => {
    if (!firebaseUser || !userProfile) return;

    try {
      await sendGlobalMessage({
        uid: firebaseUser.uid,
        username: userProfile.username,
        type,
        content,
        metadata
      });
    } catch (error) {
      console.error('Failed to send global message:', error);
    }
  };

  // --- Actions ---

  const handleRegister = async () => {
    if (!firebaseConfigured) {
      setAuthError('Firebase가 설정되지 않았습니다. .env 파일을 확인해주세요.');
      return;
    }

    setAuthError('');
    if (!inputEmail.trim() || !inputPassword.trim() || !inputUsername.trim()) {
      setAuthError('모든 필드를 입력해주세요.');
      return;
    }
    if (inputUsername.length < 2 || inputUsername.length > 12) {
      setAuthError('닉네임은 2~12자로 입력해주세요.');
      return;
    }
    if (inputPassword.length < 6) {
      setAuthError('비밀번호는 6자 이상으로 입력해주세요.');
      return;
    }

    setAuthLoading(true);
    try {
      await registerUser(inputEmail.trim(), inputPassword, inputUsername.trim());
      // Firebase Auth 상태 변경으로 자동 로그인됨
      setTimeout(() => {
        sendGlobalChatMessage('system', `🎉 ${inputUsername.trim()}님이 새로운 기사로 등록했습니다!`);
      }, 1000);
    } catch (error: any) {
      console.error('Register error:', error);
      if (error.code === 'auth/email-already-in-use') {
        setAuthError('이미 사용 중인 이메일입니다.');
      } else if (error.code === 'auth/invalid-email') {
        setAuthError('유효하지 않은 이메일 형식입니다.');
      } else if (error.code === 'auth/weak-password') {
        setAuthError('비밀번호가 너무 약합니다.');
      } else {
        setAuthError('회원가입 실패: ' + error.message);
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!firebaseConfigured) {
      setAuthError('Firebase가 설정되지 않았습니다. .env 파일을 확인해주세요.');
      return;
    }

    setAuthError('');
    if (!inputEmail.trim() || !inputPassword.trim()) {
      setAuthError('이메일과 비밀번호를 입력해주세요.');
      return;
    }

    setAuthLoading(true);
    try {
      await loginUser(inputEmail.trim(), inputPassword);
      // Firebase Auth 상태 변경으로 자동 로그인됨
    } catch (error: any) {
      console.error('Login error:', error);
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        setAuthError('이메일 또는 비밀번호가 일치하지 않습니다.');
      } else if (error.code === 'auth/invalid-email') {
        setAuthError('유효하지 않은 이메일 형식입니다.');
      } else {
        setAuthError('로그인 실패: ' + error.message);
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
      setStats(INITIAL_STATS);
      setWeapon(INITIAL_WEAPON);
      setLogs([]);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleEnhance = async () => {
    if (weapon.level >= MAX_LEVEL) {
      alert('이미 최대 레벨에 도달했습니다!');
      return;
    }

    const { cost, successChance, maintainChance, destroyChance } = getEnhanceConfig(weapon.level);

    if (stats.gold < cost) {
      alert(`골드가 부족합니다! ${cost.toLocaleString()}G 필요`);
      return;
    }

    // 주문서 사용 여부 확인
    const willUseScroll = useScrollForEnhance && stats.scrolls > 0;

    setIsEnhancing(true);
    setShowEnhanceResult(null);

    // 골드 차감 (주문서 사용 시 주문서도 차감)
    setStats(prev => ({
      ...prev,
      gold: prev.gold - cost,
      scrolls: willUseScroll ? prev.scrolls - 1 : prev.scrolls
    }));

    // Cinematic delay
    await new Promise(resolve => setTimeout(resolve, 1800));

    // 🌟 행운의 여신 등장 체크 (10% 확률)
    const goddessRoll = Math.random();
    const isGoddessAppeared = goddessRoll < 0.10;

    const roll = Math.random();
    const prevLevel = weapon.level;
    const newTotalCost = weapon.totalEnhanceCost + cost;
    let flavorData;
    let updatedWeapon = { ...weapon, totalEnhanceCost: newTotalCost };
    let resultType: 'success' | 'maintain' | 'destroy';

    // 주문서 사용 시 성공 확률 +20%
    let bonusChance = willUseScroll ? 0.20 : 0;

    // 승리 랭킹 1위 패널티 (-10% 성공 확률)
    const rankPenalty = isTopWinner ? 0.10 : 0;

    // 치트 활성화 시 90% 성공률
    const cheatBonus = isCheatActive ? 0.90 : 0;
    if (isCheatActive) {
      console.log('🎮 치트 사용! 90% 성공률 적용');
      setIsCheatActive(false); // 치트 사용 후 리셋
    }

    const adjustedSuccessChance = cheatBonus > 0
      ? 0.90
      : Math.min(Math.max(successChance + bonusChance - rankPenalty, 0.05), 0.95);
    const adjustedDestroyChance = cheatBonus > 0
      ? 0
      : Math.max(destroyChance - bonusChance + (rankPenalty * 0.5), 0);

    // 🌟 행운의 여신이 등장하면 무조건 성공 + 3단계 상승!
    if (isGoddessAppeared || roll < adjustedSuccessChance) {
      // 강화 성공
      resultType = 'success';
      // 행운의 여신 강림 시 3단계 상승, 일반 성공 시 1단계 상승
      const levelIncrease = isGoddessAppeared ? 3 : 1;
      const newLevel = Math.min(prevLevel + levelIncrease, MAX_LEVEL);
      flavorData = await generateEnhancementFlavor(weapon, true, newLevel);

      updatedWeapon = {
        ...weapon,
        level: newLevel,
        name: flavorData.weaponName,
        description: flavorData.description,
        totalEnhanceCost: newTotalCost
      };
      setWeapon(updatedWeapon);

      const goddessMsg = isGoddessAppeared ? '🌟 행운의 여신이 강림했습니다! ' : '';
      addLog('enhancement', `${goddessMsg}강화 성공! +${prevLevel} → +${newLevel}`, flavorData.quote, true);

      const remainingGold = stats.gold - cost;
      sendGlobalChatMessage('enhancement',
        (isGoddessAppeared
          ? `【 🌟 행운의 여신 강림! 🌟 】\n\n✨ 여신의 축복으로 +${levelIncrease}단계 강화 성공!\n+${prevLevel} → +${newLevel}\n\n`
          : `【 ✨ 강화 성공 ✨  +${prevLevel} → +${newLevel} 】\n\n`) +
        `🔨 대장장이: "${flavorData.quote}"`, {
        success: true,
        weaponLevel: newLevel,
        weaponName: flavorData.weaponName,
        weaponType: updatedWeapon.type,
        weaponDescription: flavorData.description,
        weaponElement: updatedWeapon.element,
        weaponElementLevel: updatedWeapon.elementLevel,
        goldChange: -cost
      });

    } else if (roll < adjustedSuccessChance + maintainChance) {
      // 강화 유지
      resultType = 'maintain';
      flavorData = await generateEnhancementFlavor(weapon, false, prevLevel);

      updatedWeapon = { ...weapon, totalEnhanceCost: newTotalCost };
      setWeapon(updatedWeapon);
      addLog('enhancement', `강화 유지 +${prevLevel}`, flavorData.quote, undefined);

      const remainingGold = stats.gold - cost;
      sendGlobalChatMessage('enhancement',
        `【 🛡️ 강화 유지 🛡️ 】\n\n` +
        `🔨 대장장이: "${flavorData.quote}"\n\n` +
        `"[+${prevLevel}] ${weapon.name}"의 레벨이 유지되었습니다.\n\n` +
        `💸 사용 골드: -${cost.toLocaleString()}G\n` +
        `💰 남은 골드: ${remainingGold.toLocaleString()}G`, {
        success: undefined,
        weaponLevel: prevLevel,
        weaponName: weapon.name,
        goldChange: -cost
      });

    } else {
      // 강화 파괴
      resultType = 'destroy';
      const refundAmount = Math.floor(newTotalCost * 0.2);

      flavorData = await generateEnhancementFlavor(weapon, false, 0);

      // 골드 환급
      setStats(prev => ({ ...prev, gold: prev.gold + refundAmount }));

      // 무기 초기화
      const destroyedWeaponName = weapon.name;
      const baseName = {
        [WeaponType.SWORD]: '녹슨 검',
        [WeaponType.AXE]: '무딘 도끼',
        [WeaponType.HAMMER]: '금이 간 망치',
        [WeaponType.SPEAR]: '휘어진 창'
      }[weapon.type];

      updatedWeapon = {
        id: `weapon_${Date.now()}`,
        type: weapon.type,
        name: baseName,
        level: 0,
        baseDamage: weapon.type === WeaponType.HAMMER ? 15 : weapon.type === WeaponType.AXE ? 12 : 10,
        description: '파괴된 무기의 잔해로 새로 만든 무기입니다.',
        totalEnhanceCost: 0
      };
      setWeapon(updatedWeapon);
      addLog('enhancement', `💥 강화 파괴! [+${prevLevel}] ${destroyedWeaponName}`, "장비가 파괴되었습니다.", false);

      const remainingGold = stats.gold - cost + refundAmount;
      sendGlobalChatMessage('enhancement',
        `【 💥 강화 파괴 💥 】\n\n` +
        `🔨 대장장이: "${flavorData.quote}"\n\n` +
        `💸 사용 골드: -${cost.toLocaleString()}G\n` +
        `💰 남은 골드: ${remainingGold.toLocaleString()}G\n\n` +
        `"[+${prevLevel}] ${destroyedWeaponName}" 산산조각 나서, "[+0] ${baseName}"이 지급되었습니다.\n` +
        `💵 환급 골드: +${refundAmount.toLocaleString()}G (총 강화비용의 20%)`, {
        success: false,
        weaponLevel: 0,
        weaponName: baseName,
        goldChange: -cost + refundAmount
      });
    }

    setShowEnhanceResult({
      success: resultType === 'success',
      message: flavorData?.quote || (resultType === 'success' ? "성공했습니다!" : resultType === 'maintain' ? "유지되었습니다." : "파괴되었습니다."),
      isGoddess: isGoddessAppeared && resultType === 'success'
    });
    setIsEnhancing(false);

    // 강화 후 채팅 스크롤 하단으로
    setTimeout(() => scrollChatToBottom(true), 500);
  };

  const handleBattle = async (opponent?: { profile: UserProfile, gameData: any }) => {
    if (!firebaseConfigured || !firebaseUser) {
      alert('Firebase가 설정되지 않았거나 로그인되지 않았습니다.');
      return;
    }

    // 일일 전투 횟수 체크
    const today = new Date().toDateString();
    if (lastBattleDate !== today) {
      setDailyBattleCount(0);
      setLastBattleDate(today);
    }

    if (dailyBattleCount >= MAX_DAILY_BATTLES) {
      alert(`오늘의 전투 횟수를 모두 사용했습니다! (${MAX_DAILY_BATTLES}회/일)`);
      return;
    }

    // 상대가 지정되지 않은 경우
    if (!opponent) {
      alert('전투할 상대를 선택해주세요!');
      return;
    }

    // 전투 횟수 증가
    setDailyBattleCount(prev => prev + 1);

    // 전투력 계산
    const myPower = weapon.baseDamage + (weapon.level * 25) + (weapon.level * weapon.level * 2);
    const opponentWeapon = opponent.gameData.weapon;
    const opponentPower = opponentWeapon.baseDamage + (opponentWeapon.level * 25) + (opponentWeapon.level * opponentWeapon.level * 2);

    // 무기 상성 체크
    const typeAdvantage = getTypeAdvantage(weapon.type, opponentWeapon.type);
    const typeBonus = typeAdvantage === 'advantage' ? 0.15 : typeAdvantage === 'disadvantage' ? -0.15 : 0;

    // 속성 상성 체크
    const elementAdvantage = getElementAdvantage(weapon.element, opponentWeapon.element);
    const elementBonus = elementAdvantage === 'advantage' ? 0.10 : elementAdvantage === 'disadvantage' ? -0.10 : 0;

    // 속성 레벨 보너스 (레벨당 1% 추가)
    const myElementLevel = weapon.elementLevel || 0;
    const oppElementLevel = opponentWeapon.elementLevel || 0;
    const elementLevelBonus = (myElementLevel - oppElementLevel) * 0.01;

    // 승률 계산 (전투력 차이 + 무기 상성 + 속성 상성 + 속성 레벨)
    const powerDiff = myPower - opponentPower;
    let winChance = 0.5 + (powerDiff / (Math.max(myPower, opponentPower) * 2)) + typeBonus + elementBonus + elementLevelBonus;
    winChance = Math.max(0.1, Math.min(0.9, winChance)); // 10% ~ 90% 범위로 제한

    const isWin = Math.random() < winChance;
    const baseReward = 100 + (opponentWeapon.level * 20);

    // 레벨 차이 보너스 (낮은 레벨이 높은 레벨을 이겼을 때)
    const levelDiff = opponentWeapon.level - weapon.level;
    const underDogBonus = (isWin && levelDiff > 0) ? (1 + (levelDiff * 0.5)) : 1; // 레벨 차이 1당 50% 보너스
    const reward = isWin ? Math.floor(baseReward * underDogBonus) : Math.floor(baseReward * 0.2);

    setStats(prev => ({
      ...prev,
      gold: prev.gold + reward,
      wins: isWin ? prev.wins + 1 : prev.wins,
      losses: isWin ? prev.losses : prev.losses + 1
    }));

    const battleLog = await generateBattleLog(weapon, `@${opponent.profile.username}의 [+${opponentWeapon.level}] ${opponentWeapon.name}`, isWin ? 'win' : 'loss');

    // 무기 상성 메시지
    const typeAdvMsg = typeAdvantage === 'advantage'
      ? `\n⚔️ 무기 상성 유리! (${WEAPON_TYPE_NAMES[weapon.type]} > ${WEAPON_TYPE_NAMES[opponentWeapon.type]})`
      : typeAdvantage === 'disadvantage'
        ? `\n⚔️ 무기 상성 불리! (${WEAPON_TYPE_NAMES[weapon.type]} < ${WEAPON_TYPE_NAMES[opponentWeapon.type]})`
        : '';

    // 속성 상성 메시지
    const elementAdvMsg = elementAdvantage === 'advantage'
      ? `\n🔮 속성 상성 유리! (${ELEMENT_NAMES[weapon.element!]} > ${ELEMENT_NAMES[opponentWeapon.element]})`
      : elementAdvantage === 'disadvantage'
        ? `\n🔮 속성 상성 불리! (${ELEMENT_NAMES[weapon.element!]} < ${ELEMENT_NAMES[opponentWeapon.element]})`
        : '';

    const advantageMsg = typeAdvMsg + elementAdvMsg;

    addLog('battle', isWin ? `승리! vs ${opponent.profile.username} +${reward}G` : `패배... vs ${opponent.profile.username} +${reward}G`, battleLog, isWin);

    // 속성 표시 문자열
    const myElementStr = weapon.element && weapon.element !== ElementType.NONE
      ? ` [${ELEMENT_NAMES[weapon.element]}+${weapon.elementLevel || 0}]` : '';
    const oppElementStr = opponentWeapon.element && opponentWeapon.element !== ElementType.NONE
      ? ` [${ELEMENT_NAMES[opponentWeapon.element]}+${opponentWeapon.elementLevel || 0}]` : '';

    // 언더독 보너스 메시지
    const underDogMsg = (isWin && levelDiff > 0)
      ? `\n🎯 언더독 보너스! (+${levelDiff}레벨 차이 → x${underDogBonus.toFixed(1)} 보상!)`
      : '';

    sendGlobalChatMessage('battle',
      `⚔️ PvP 매치!\n\n` +
      `[+${weapon.level}] ${weapon.name} (${WEAPON_TYPE_NAMES[weapon.type]})${myElementStr} - 전투력: ${myPower.toLocaleString()}\n` +
      `  VS\n` +
      `@${opponent.profile.username} [+${opponentWeapon.level}] ${opponentWeapon.name} (${WEAPON_TYPE_NAMES[opponentWeapon.type]})${oppElementStr} - 전투력: ${opponentPower.toLocaleString()}` +
      advantageMsg + `\n\n` +
      `${battleLog}\n\n` +
      (isWin
        ? `🏆 승리! @${opponent.profile.username}님을 물리쳤습니다!${underDogMsg}\n💰 +${reward.toLocaleString()}G 획득!`
        : `💀 패배... @${opponent.profile.username}님에게 패배했습니다.\n💰 +${reward.toLocaleString()}G 위로금`), {
      success: isWin,
      opponentName: opponent.profile.username,
      goldChange: reward
    });

    // 전투 후 정보창으로 이동하고 스크롤 하단으로
    setView(GameView.HOME);
    setTimeout(() => scrollChatToBottom(true), 300);
  };

  const buyScroll = () => {
    if (stats.gold >= SCROLL_PRICE) {
      setStats(prev => ({ ...prev, gold: prev.gold - SCROLL_PRICE, scrolls: prev.scrolls + 1 }));
      addLog('shop', '강화 주문서 구매 완료', `-${SCROLL_PRICE.toLocaleString()}G`);
    } else {
      alert(`골드가 부족합니다! ${SCROLL_PRICE.toLocaleString()}G 필요`);
    }
  };

  // 속성 부여
  const assignElement = (element: ElementType) => {
    const cost = 50000;
    if (stats.gold < cost) {
      alert(`골드가 부족합니다! ${cost.toLocaleString()}G 필요`);
      return;
    }
    if (weapon.element && weapon.element !== ElementType.NONE) {
      if (!confirm(`기존 속성(${ELEMENT_NAMES[weapon.element]} +${weapon.elementLevel || 0})이 초기화됩니다. 계속하시겠습니까?`)) {
        return;
      }
    }
    setStats(prev => ({ ...prev, gold: prev.gold - cost }));
    setWeapon(prev => ({ ...prev, element, elementLevel: 0 }));
    setSelectedElement(null);
    addLog('enhancement', `${ELEMENT_NAMES[element]} 속성 부여 완료`, `-${cost.toLocaleString()}G`);

    sendGlobalChatMessage('enhancement',
      `🔮 속성 부여!\n\n` +
      `[+${weapon.level}] ${weapon.name}에 ${ELEMENT_NAMES[element]} 속성을 부여했습니다!`, {
      weaponLevel: weapon.level,
      weaponName: weapon.name,
      weaponType: weapon.type
    });
  };

  // 속성 강화
  const handleElementEnhance = async () => {
    if (!weapon.element || weapon.element === ElementType.NONE) {
      alert('먼저 속성을 부여해주세요!');
      return;
    }
    if ((weapon.elementLevel || 0) >= MAX_ELEMENT_LEVEL) {
      alert('이미 최대 속성 레벨에 도달했습니다!');
      return;
    }

    const currentLevel = weapon.elementLevel || 0;
    const { cost, successChance, maintainChance } = getElementEnhanceConfig(currentLevel);

    if (stats.gold < cost) {
      alert(`골드가 부족합니다! ${cost.toLocaleString()}G 필요`);
      return;
    }

    setIsElementEnhancing(true);
    setShowElementResult(null);
    setStats(prev => ({ ...prev, gold: prev.gold - cost }));

    await new Promise(resolve => setTimeout(resolve, 1500));

    const roll = Math.random();
    let resultType: 'success' | 'maintain' | 'destroy';
    const elementName = ELEMENT_NAMES[weapon.element];

    if (roll < successChance) {
      resultType = 'success';
      const newLevel = currentLevel + 1;
      setWeapon(prev => ({ ...prev, elementLevel: newLevel }));
      addLog('enhancement', `${elementName} 속성 강화 성공! +${currentLevel} → +${newLevel}`, '', true);
      setShowElementResult({ success: true, message: `${elementName} 속성이 +${newLevel}로 강화되었습니다!` });

      sendGlobalChatMessage('enhancement',
        `✨ 속성 강화 성공!\n\n` +
        `[+${weapon.level}] ${weapon.name}의 ${elementName} 속성이 +${newLevel}로 강화되었습니다!`, {
        weaponLevel: weapon.level,
        weaponName: weapon.name,
        weaponType: weapon.type
      });
    } else if (roll < successChance + maintainChance) {
      resultType = 'maintain';
      setShowElementResult({ success: false, message: `${elementName} 속성이 유지되었습니다.` });
      addLog('enhancement', `${elementName} 속성 강화 유지 +${currentLevel}`, '', undefined);
    } else {
      resultType = 'destroy';
      setWeapon(prev => ({ ...prev, elementLevel: 0 }));
      setShowElementResult({ success: false, message: `${elementName} 속성이 파괴되어 +0으로 초기화되었습니다!` });
      addLog('enhancement', `${elementName} 속성 강화 파괴!`, '속성 레벨이 0으로 초기화', false);

      sendGlobalChatMessage('enhancement',
        `💥 속성 강화 파괴!\n\n` +
        `[+${weapon.level}] ${weapon.name}의 ${elementName} 속성이 파괴되었습니다...`, {
        weaponLevel: weapon.level,
        weaponName: weapon.name,
        weaponType: weapon.type
      });
    }

    setIsElementEnhancing(false);
  };

  const handleChatSubmit = async (input: string) => {
    if (!input) return;

    // 명령어 처리 (슬래시로 시작하는 경우만)
    if (input.startsWith('/')) {
      const command = input.slice(1).toLowerCase();
      if (command === '강화' || command === 'enhance') {
        handleEnhance();
        return;
      } else if (command === '전투' || command === 'battle') {
        setView(GameView.BATTLE);
        return;
      } else if (command === '주문서' || command === 'scroll') {
        buyScroll();
        return;
      }
    }

    // 일반 채팅 메시지
    await sendGlobalChatMessage('chat', input);
  };

  // 자랑하기 함수
  const handleShowOff = async () => {
    const totalDamage = weapon.baseDamage + (weapon.level * 10) + Math.floor(Math.pow(weapon.level, 1.8));
    await sendGlobalChatMessage('showoff',
      `🏆 내 무기를 자랑합니다!\n\n` +
      `⚔️ [+${weapon.level}] ${weapon.name}\n` +
      `💪 공격력: ${totalDamage.toLocaleString()}\n` +
      `📜 "${weapon.description}"`, {
      weaponLevel: weapon.level,
      weaponName: weapon.name,
      weaponType: weapon.type,
      weaponDescription: weapon.description,
      weaponElement: weapon.element,
      weaponElementLevel: weapon.elementLevel
    });
  };

  const resetWeapon = async (type: WeaponType) => {
    if (confirm("무기를 변경하면 강화 수치가 초기화됩니다. 계속하시겠습니까?")) {
      const baseName = {
        [WeaponType.SWORD]: '녹슨 검',
        [WeaponType.AXE]: '무딘 도끼',
        [WeaponType.HAMMER]: '금이 간 망치',
        [WeaponType.SPEAR]: '휘어진 창'
      }[type];

      setWeapon({
        id: `weapon_${Date.now()}`,
        type,
        name: baseName,
        level: 0,
        baseDamage: type === WeaponType.HAMMER ? 15 : type === WeaponType.AXE ? 12 : 10,
        description: '새로운 모험을 시작할 준비가 된 무기입니다.',
        totalEnhanceCost: 0
      });
      addLog('shop', `무기 변경: ${type}`, '모든 강화가 초기화되었습니다.');
    }
  };

  // --- Render Views ---

  const renderLogin = (isFrame = false) => (
    <div className={`${isFrame ? 'h-full pt-12' : 'min-h-screen pt-safe'} flex flex-col items-center justify-center px-5 py-8 relative overflow-hidden`}>
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-mesh opacity-50 z-0"></div>
      <div className="absolute top-1/4 left-1/4 w-48 h-48 bg-blue-500/20 rounded-full blur-[80px] animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-yellow-500/10 rounded-full blur-[80px] animate-pulse" style={{ animationDelay: '1s' }}></div>

      <div className="relative z-10 w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="inline-flex p-5 bg-slate-800/50 rounded-full border border-white/10 mb-5 shadow-[0_0_40px_rgba(234,179,8,0.25)]">
            <ShieldCheck size={56} className="text-yellow-400" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-yellow-200 to-yellow-500">JOY&JAY</span>
            <br />
            <span className="text-2xl">KNIGHT'S FIGHT</span>
          </h1>
          <p className="text-slate-400 text-sm mt-2">당신의 운명을 개척하세요, 기사여.</p>
        </div>

        <div className="glass-panel p-5 rounded-3xl border border-white/10 shadow-2xl backdrop-blur-xl">
          {/* Auth Mode Tabs */}
          <div className="flex mb-5 bg-slate-900/60 rounded-2xl p-1.5">
            <button
              onClick={() => { setAuthMode('login'); setAuthError(''); }}
              className={`flex-1 py-3.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 active:scale-95 ${authMode === 'login'
                ? 'bg-slate-700 text-yellow-400 shadow-lg'
                : 'text-slate-500 active:text-slate-300'
                }`}
            >
              <LogIn size={18} />
              로그인
            </button>
            <button
              onClick={() => { setAuthMode('register'); setAuthError(''); }}
              className={`flex-1 py-3.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 active:scale-95 ${authMode === 'register'
                ? 'bg-slate-700 text-yellow-400 shadow-lg'
                : 'text-slate-500 active:text-slate-300'
                }`}
            >
              <UserPlus size={18} />
              회원가입
            </button>
          </div>

          {/* Email Input */}
          <label className="block text-xs uppercase text-slate-400 font-bold mb-2 ml-1">이메일</label>
          <div className="relative mb-4">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
              <UserIcon size={20} />
            </div>
            <input
              type="email"
              value={inputEmail}
              onChange={(e) => setInputEmail(e.target.value)}
              placeholder="이메일 입력..."
              className="w-full bg-slate-950/60 border border-slate-700 rounded-2xl py-4 pl-12 pr-4 text-base text-white placeholder:text-slate-600 focus:outline-none focus:border-yellow-500/50 focus:ring-2 focus:ring-yellow-500/30 transition-all"
              autoComplete="email"
              autoCapitalize="off"
            />
          </div>

          {/* Username Input (Register only) */}
          {authMode === 'register' && (
            <>
              <label className="block text-xs uppercase text-slate-400 font-bold mb-2 ml-1">닉네임</label>
              <div className="relative mb-4">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                  <Globe size={20} />
                </div>
                <input
                  type="text"
                  value={inputUsername}
                  onChange={(e) => setInputUsername(e.target.value)}
                  placeholder="닉네임 입력 (2~12자)..."
                  className="w-full bg-slate-950/60 border border-slate-700 rounded-2xl py-4 pl-12 pr-4 text-base text-white placeholder:text-slate-600 focus:outline-none focus:border-yellow-500/50 focus:ring-2 focus:ring-yellow-500/30 transition-all"
                  maxLength={12}
                  autoCapitalize="off"
                />
              </div>
            </>
          )}

          {/* Password Input */}
          <label className="block text-xs uppercase text-slate-400 font-bold mb-2 ml-1">비밀번호</label>
          <div className="relative mb-5">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
              <Lock size={20} />
            </div>
            <input
              type="password"
              value={inputPassword}
              onChange={(e) => setInputPassword(e.target.value)}
              placeholder="비밀번호 입력..."
              className="w-full bg-slate-950/60 border border-slate-700 rounded-2xl py-4 pl-12 pr-4 text-base text-white placeholder:text-slate-600 focus:outline-none focus:border-yellow-500/50 focus:ring-2 focus:ring-yellow-500/30 transition-all"
              onKeyDown={(e) => e.key === 'Enter' && (authMode === 'login' ? handleLogin() : handleRegister())}
              autoComplete="current-password"
            />
          </div>

          {/* Error Message */}
          {authError && (
            <div className="mb-5 p-4 bg-red-500/20 border border-red-500/50 rounded-2xl text-red-300 text-sm flex items-center gap-3">
              <AlertCircle size={20} className="shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          <button
            onClick={authMode === 'login' ? handleLogin : handleRegister}
            disabled={authLoading}
            className="w-full bg-gradient-to-r from-yellow-600 to-orange-600 active:from-yellow-700 active:to-orange-700 text-white font-bold py-4 rounded-2xl shadow-lg shadow-orange-900/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-base disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {authLoading ? (
              <>
                <RefreshCw size={20} className="animate-spin" />
                <span>처리 중...</span>
              </>
            ) : (
              <>
                <span>{authMode === 'login' ? '로그인' : '회원가입'}</span>
                <ChevronRight size={20} />
              </>
            )}
          </button>
        </div>

        <p className="text-center text-xs text-slate-500 mt-6 px-4">
          {authMode === 'login' ? '계정이 없으신가요? 회원가입 탭을 클릭하세요.' : '닉네임 2~12자, 비밀번호 6자 이상'}
        </p>

        {!firebaseConfigured && (
          <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-yellow-400 text-xs text-center">
            <WifiOff size={16} className="inline mr-2" />
            Firebase가 설정되지 않았습니다. .env 파일을 확인하세요.
          </div>
        )}
      </div>
    </div>
  );

  const renderHome = () => (
    <div className="space-y-4 animate-fade-in">
      <div className="relative z-10">
        <WeaponCard weapon={weapon} />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="glass-panel p-4 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden active:scale-95 transition-transform">
          <Trophy size={28} className="text-yellow-500 mb-2" />
          <div className="text-[11px] text-slate-400 uppercase tracking-wider font-bold">승리</div>
          <div className="text-2xl font-bold text-white">{stats.wins}</div>
        </div>
        <div className="glass-panel p-4 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden active:scale-95 transition-transform">
          <Skull size={28} className="text-slate-500 mb-2" />
          <div className="text-[11px] text-slate-400 uppercase tracking-wider font-bold">패배</div>
          <div className="text-2xl font-bold text-white">{stats.losses}</div>
        </div>
      </div>

      {/* Recent Logs Preview */}
      <div className="glass-panel rounded-2xl p-4 border border-slate-800">
        <h2 className="text-sm font-bold mb-3 flex items-center gap-2 text-slate-300 uppercase tracking-wider">
          <ScrollText size={16} className="text-blue-400" />
          최근 활동
        </h2>
        <div className="space-y-3">
          {logs.length === 0 && <p className="text-slate-600 text-center py-3 text-sm italic">기록이 없습니다.</p>}
          {logs.slice(0, 3).map((log) => (
            <div key={log.id} className="relative pl-4 border-l-2 border-slate-800 py-1" style={{ borderColor: log.success === true ? '#4ade80' : log.success === false ? '#ef4444' : '#64748b' }}>
              <div className="flex justify-between items-start gap-2">
                <span className="font-bold text-sm text-slate-200 flex-1">{log.message}</span>
                <span className="text-[10px] text-slate-500 shrink-0">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              {log.subtext && <p className="text-xs text-slate-500 mt-1 line-clamp-1">{log.subtext}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderEnhance = () => {
    const config = getEnhanceConfig(weapon.level);
    const canUseScroll = stats.scrolls > 0;
    const willUseScroll = useScrollForEnhance && canUseScroll;

    return (
      <div className="space-y-4 flex flex-col animate-fade-in">
        <WeaponCard weapon={weapon} showStats={false} isEnhancing={isEnhancing} />

        {/* Interaction Area */}
        <div className="glass-panel p-5 rounded-3xl border-t border-white/10 relative overflow-hidden">
          {/* Background decoration */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl -z-10"></div>

          {/* 강화 결과 메시지 */}
          {showEnhanceResult && (
            <div className={`mb-4 p-4 rounded-2xl border text-center animate-shake ${showEnhanceResult.isGoddess
              ? 'bg-gradient-to-r from-yellow-500/30 to-pink-500/30 border-yellow-400/50 text-yellow-100'
              : showEnhanceResult.success
                ? 'bg-green-500/20 border-green-500/50 text-green-100'
                : 'bg-red-500/20 border-red-500/50 text-red-100'
              }`}>
              {showEnhanceResult.isGoddess && (
                <div className="text-2xl mb-2">🌟✨🌟</div>
              )}
              <div className="font-bold text-xl mb-1">
                {showEnhanceResult.isGoddess
                  ? '행운의 여신 강림! +3단계!'
                  : showEnhanceResult.success
                    ? '성공!'
                    : '실패...'}
              </div>
              <p className="text-sm opacity-80">{showEnhanceResult.message}</p>
            </div>
          )}

          {/* 강화 비용 */}
          <div className="flex justify-between items-center mb-3 bg-slate-800/50 rounded-xl p-3">
            <div className="text-slate-400 text-sm">강화 비용</div>
            <div className="text-xl font-bold text-yellow-400 font-mono">{config.cost.toLocaleString()}<span className="text-sm ml-1">G</span></div>
          </div>

          {/* 주문서 사용 토글 */}
          <div
            onClick={() => canUseScroll && setUseScrollForEnhance(!useScrollForEnhance)}
            className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${willUseScroll
              ? 'bg-blue-950/50 border-blue-500/50'
              : canUseScroll
                ? 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                : 'bg-slate-800/30 border-slate-800 opacity-50 cursor-not-allowed'
              }`}
          >
            <div className="flex items-center gap-3">
              <ScrollText size={20} className={willUseScroll ? 'text-blue-400' : 'text-slate-500'} />
              <div>
                <div className={`text-sm font-bold ${willUseScroll ? 'text-blue-300' : 'text-slate-400'}`}>
                  강화 주문서 사용
                </div>
                <div className="text-xs text-slate-500">성공 확률 +20% (보유: {stats.scrolls}개)</div>
              </div>
            </div>
            <div className={`w-12 h-6 rounded-full transition-all ${willUseScroll ? 'bg-blue-600' : 'bg-slate-700'}`}>
              <div className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-all mt-0.5 ${willUseScroll ? 'ml-6' : 'ml-0.5'}`}></div>
            </div>
          </div>

          {/* 행운의 여신 안내 */}
          <div className="mt-3 flex items-center gap-3 text-sm text-yellow-400 bg-yellow-950/30 p-3 rounded-xl border border-yellow-900/50">
            <Sparkles size={18} className="shrink-0" />
            <span>10% 확률로 행운의 여신이 강림하여 +3단계 강화!</span>
          </div>

          {/* 랭킹 1위 패널티 경고 */}
          {isTopWinner && (
            <div className="mt-3 flex items-center gap-3 text-sm text-orange-400 bg-orange-950/30 p-3 rounded-xl border border-orange-900/50">
              <Trophy size={18} className="shrink-0" />
              <span>승리 랭킹 1위! 강화 확률이 약간 감소합니다.</span>
            </div>
          )}

          {/* 파괴 경고 */}
          {config.destroyChance > 0 && (
            <div className="mt-3 flex items-center gap-3 text-sm text-rose-400 bg-rose-950/30 p-3 rounded-xl border border-rose-900/50">
              <AlertCircle size={18} className="shrink-0" />
              <span>파괴 시 강화비용의 20%만 환급됩니다</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  // 속성 아이콘 컴포넌트
  const ElementIcon: React.FC<{ element: ElementType; size?: number; className?: string }> = ({ element, size = 20, className = '' }) => {
    switch (element) {
      case ElementType.FIRE: return <Flame size={size} className={className} />;
      case ElementType.WATER: return <Droplets size={size} className={className} />;
      case ElementType.LIGHT: return <Sun size={size} className={className} />;
      case ElementType.DARK: return <Moon size={size} className={className} />;
      case ElementType.CURSE: return <Ghost size={size} className={className} />;
      default: return <Sparkles size={size} className={className} />;
    }
  };

  const renderElementEnhance = () => {
    const hasElement = weapon.element && weapon.element !== ElementType.NONE;
    const elementLevel = weapon.elementLevel || 0;
    const config = hasElement ? getElementEnhanceConfig(elementLevel) : null;

    const elements = [
      { type: ElementType.FIRE, name: '화염', icon: Flame, color: 'orange', beats: '저주' },
      { type: ElementType.WATER, name: '물', icon: Droplets, color: 'blue', beats: '화염' },
      { type: ElementType.LIGHT, name: '빛', icon: Sun, color: 'yellow', beats: '어둠' },
      { type: ElementType.DARK, name: '어둠', icon: Moon, color: 'purple', beats: '물' },
      { type: ElementType.CURSE, name: '저주', icon: Ghost, color: 'green', beats: '빛' },
    ];

    return (
      <div className="space-y-4 flex flex-col animate-fade-in">
        {/* 현재 무기 정보 */}
        <div className="glass-panel p-4 rounded-2xl">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-400">현재 무기</div>
              <div className="text-lg font-bold text-white">[+{weapon.level}] {weapon.name}</div>
            </div>
            {hasElement && (
              <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${ELEMENT_BG_COLORS[weapon.element!]}`}>
                <ElementIcon element={weapon.element!} className={ELEMENT_COLORS[weapon.element!]} />
                <span className={`font-bold ${ELEMENT_COLORS[weapon.element!]}`}>
                  {ELEMENT_NAMES[weapon.element!]} +{elementLevel}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 결과 메시지 */}
        {showElementResult && (
          <div className={`p-4 rounded-2xl border text-center animate-shake ${showElementResult.success
            ? 'bg-green-500/20 border-green-500/50 text-green-100'
            : 'bg-red-500/20 border-red-500/50 text-red-100'
            }`}>
            <div className="font-bold text-xl mb-1">{showElementResult.success ? '성공!' : '실패...'}</div>
            <p className="text-sm opacity-80">{showElementResult.message}</p>
          </div>
        )}

        {/* 속성 선택 (속성이 없을 때) */}
        {!hasElement && (
          <div className="glass-panel p-4 rounded-2xl">
            <h3 className="text-sm font-bold text-slate-300 mb-3">🔮 속성 부여 (50,000G)</h3>
            <div className="grid grid-cols-5 gap-2">
              {elements.map((el) => (
                <button
                  key={el.type}
                  onClick={() => assignElement(el.type)}
                  className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all active:scale-95 ${`bg-${el.color}-900/30 border-${el.color}-500/30 hover:border-${el.color}-400`
                    }`}
                >
                  <el.icon size={24} className={`text-${el.color}-400`} />
                  <span className={`text-xs font-bold text-${el.color}-300`}>{el.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 속성 강화 (속성이 있을 때) */}
        {hasElement && config && (
          <div className="glass-panel p-4 rounded-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-300">⚡ 속성 강화</h3>
              <span className="text-xs text-slate-500">최대 레벨: {MAX_ELEMENT_LEVEL}</span>
            </div>

            {/* 강화 비용 */}
            <div className="flex justify-between items-center mb-3 bg-slate-800/50 rounded-xl p-3">
              <div className="text-slate-400 text-sm">강화 비용</div>
              <div className="text-xl font-bold text-yellow-400 font-mono">
                {config.cost.toLocaleString()}<span className="text-sm ml-1">G</span>
              </div>
            </div>

            {/* 속성 변경 버튼 */}
            <button
              onClick={() => {
                if (confirm('속성을 변경하면 현재 속성 레벨이 초기화됩니다. 계속하시겠습니까?')) {
                  setWeapon(prev => ({ ...prev, element: ElementType.NONE, elementLevel: 0 }));
                }
              }}
              className="w-full mb-3 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
            >
              다른 속성으로 변경하기
            </button>

            {/* 강화 버튼 */}
            <button
              onClick={handleElementEnhance}
              disabled={isElementEnhancing || elementLevel >= MAX_ELEMENT_LEVEL}
              className={`w-full py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 shadow-lg transition-all active:scale-[0.98] ${isElementEnhancing
                ? 'bg-slate-700 text-slate-400'
                : `bg-gradient-to-r ${weapon.element === ElementType.FIRE ? 'from-orange-600 to-red-600' :
                  weapon.element === ElementType.WATER ? 'from-blue-600 to-cyan-600' :
                    weapon.element === ElementType.LIGHT ? 'from-yellow-500 to-amber-500' :
                      weapon.element === ElementType.DARK ? 'from-purple-600 to-indigo-600' :
                        'from-green-600 to-emerald-600'
                } text-white`
                }`}
            >
              {isElementEnhancing ? (
                <>
                  <Sparkles size={22} className="animate-spin" />
                  <span>강화 중...</span>
                </>
              ) : elementLevel >= MAX_ELEMENT_LEVEL ? (
                '최대 레벨 달성!'
              ) : (
                <>
                  <ElementIcon element={weapon.element!} size={22} />
                  <span>속성 강화 ({config.cost.toLocaleString()}G)</span>
                </>
              )}
            </button>
          </div>
        )}

      </div>
    );
  };

  const renderBattle = () => {
    const myPower = weapon.baseDamage + (weapon.level * 25) + (weapon.level * weapon.level * 2);

    return (
      <div className="flex flex-col animate-fade-in space-y-4">
        {/* Header */}
        <div className="text-center space-y-1">
          <h2 className="text-2xl font-bold text-white tracking-tight uppercase">아레나</h2>
          <p className="text-slate-400 text-sm">
            오늘 전투: <span className="text-yellow-400 font-bold">{dailyBattleCount}</span> / {MAX_DAILY_BATTLES}회
          </p>
        </div>

        {/* My Power */}
        <div className="glass-panel p-3 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center text-white font-bold">
              {stats.username[0]?.toUpperCase()}
            </div>
            <div>
              <div className="text-sm font-bold text-white">{stats.username}</div>
              <div className="text-xs text-slate-400">
                [{WEAPON_TYPE_NAMES[weapon.type]}] [+{weapon.level}] {weapon.name}
                {weapon.element && weapon.element !== ElementType.NONE && (
                  <span className={`ml-1 ${ELEMENT_COLORS[weapon.element]}`}>
                    [{ELEMENT_NAMES[weapon.element]}+{weapon.elementLevel || 0}]
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-500">전투력</div>
            <div className="text-lg font-bold text-yellow-400">{myPower.toLocaleString()}</div>
          </div>
        </div>

        {/* Opponent List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-300">상대 선택</h3>
            <button
              onClick={loadOpponents}
              className="text-xs text-blue-400 flex items-center gap-1"
            >
              <RefreshCw size={12} className={isLoadingOpponents ? 'animate-spin' : ''} />
              새로고침
            </button>
          </div>

          {isLoadingOpponents ? (
            <div className="text-center py-8 text-slate-500">
              <RefreshCw size={24} className="animate-spin mx-auto mb-2" />
              <p className="text-sm">상대 목록 불러오는 중...</p>
            </div>
          ) : availableOpponents.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Skull size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">전투할 수 있는 상대가 없습니다.</p>
              <p className="text-xs mt-1">다른 기사들이 가입하길 기다려주세요!</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[40vh] overflow-y-auto">
              {availableOpponents.map((opp) => {
                const oppWeapon = opp.gameData.weapon;
                const oppPower = oppWeapon.baseDamage + (oppWeapon.level * 25) + (oppWeapon.level * oppWeapon.level * 2);
                const isSelected = selectedOpponent?.profile.uid === opp.profile.uid;
                const powerDiff = myPower - oppPower;
                const typeAdv = getTypeAdvantage(weapon.type, oppWeapon.type);
                const elemAdv = getElementAdvantage(weapon.element, oppWeapon.element);
                const hasElement = oppWeapon.element && oppWeapon.element !== ElementType.NONE;

                return (
                  <div
                    key={opp.profile.uid}
                    onClick={() => setSelectedOpponent(opp)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all active:scale-[0.98] ${isSelected
                      ? 'bg-rose-950/50 border-rose-500/50'
                      : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${isSelected ? 'bg-rose-600' : 'bg-slate-700'
                          }`}>
                          {opp.profile.username[0]?.toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-white">{opp.profile.username}</div>
                          <div className="text-xs text-slate-400">
                            [{WEAPON_TYPE_NAMES[oppWeapon.type]}] [+{oppWeapon.level}] {oppWeapon.name}
                            {hasElement && (
                              <span className={`ml-1 ${ELEMENT_COLORS[oppWeapon.element]}`}>
                                [{ELEMENT_NAMES[oppWeapon.element]}+{oppWeapon.elementLevel || 0}]
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1 justify-end flex-wrap">
                          {/* 무기 상성 */}
                          {typeAdv === 'advantage' && (
                            <span className="text-[9px] px-1 py-0.5 bg-green-500/20 text-green-400 rounded border border-green-500/30">
                              무기↑
                            </span>
                          )}
                          {typeAdv === 'disadvantage' && (
                            <span className="text-[9px] px-1 py-0.5 bg-red-500/20 text-red-400 rounded border border-red-500/30">
                              무기↓
                            </span>
                          )}
                          {/* 속성 상성 */}
                          {elemAdv === 'advantage' && (
                            <span className="text-[9px] px-1 py-0.5 bg-cyan-500/20 text-cyan-400 rounded border border-cyan-500/30">
                              속성↑
                            </span>
                          )}
                          {elemAdv === 'disadvantage' && (
                            <span className="text-[9px] px-1 py-0.5 bg-purple-500/20 text-purple-400 rounded border border-purple-500/30">
                              속성↓
                            </span>
                          )}
                          <span className={`text-xs ${powerDiff > 0 ? 'text-green-400' : powerDiff < 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                            {powerDiff > 0 ? '유리' : powerDiff < 0 ? '불리' : '동등'}
                          </span>
                        </div>
                        <div className="text-sm font-bold text-slate-300">{oppPower.toLocaleString()}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Battle Button */}
        <button
          onClick={() => selectedOpponent && handleBattle(selectedOpponent)}
          disabled={!selectedOpponent || dailyBattleCount >= MAX_DAILY_BATTLES}
          className={`w-full py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 shadow-lg transition-all active:scale-[0.98] ${selectedOpponent && dailyBattleCount < MAX_DAILY_BATTLES
            ? 'bg-gradient-to-r from-rose-600 to-orange-600 text-white'
            : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
        >
          <Swords size={22} />
          {dailyBattleCount >= MAX_DAILY_BATTLES
            ? '오늘 전투 완료'
            : selectedOpponent
              ? `${selectedOpponent.profile.username}에게 도전!`
              : '상대를 선택하세요'}
        </button>
      </div>
    );
  };

  const renderShop = () => (
    <div className="space-y-6 animate-fade-in">
      {/* Scroll Shop Item */}
      <div className="glass-panel p-5 rounded-2xl border border-slate-700/50 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-28 h-28 bg-blue-500/10 rounded-full blur-2xl -mr-8 -mt-8"></div>

        <div className="flex items-center justify-between relative z-10 gap-3">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-slate-800 rounded-2xl flex items-center justify-center text-blue-400 border border-slate-700 shadow-inner">
              <ScrollText size={28} />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-200">강화 주문서</h3>
              <p className="text-xs text-slate-500">강화 성공 확률 +20%</p>
              <p className="text-xs text-blue-400">보유: {stats.scrolls}개</p>
            </div>
          </div>

          <button
            onClick={buyScroll}
            disabled={stats.gold < SCROLL_PRICE}
            className="bg-emerald-600 active:bg-emerald-700 disabled:bg-slate-700 disabled:opacity-50 text-white px-4 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-emerald-900/30 border border-white/10 active:scale-95 transition-all disabled:cursor-not-allowed"
          >
            <Coins size={16} />
            <span>100,000</span>
          </button>
        </div>
      </div>

      {/* Weapon Crafting */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <RefreshCw size={20} className="text-blue-400" />
          <h3 className="font-bold text-white text-base">새 무기 제작</h3>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[WeaponType.SWORD, WeaponType.AXE, WeaponType.HAMMER, WeaponType.SPEAR].map(type => {
            const typeNames: Record<WeaponType, string> = {
              [WeaponType.SWORD]: '검',
              [WeaponType.AXE]: '도끼',
              [WeaponType.HAMMER]: '망치',
              [WeaponType.SPEAR]: '창'
            };
            const imagePath = `/weapons/${type.toLowerCase()}_mythic.png`;
            return (
              <button
                key={type}
                onClick={() => resetWeapon(type)}
                className={`p-3 rounded-2xl border flex flex-col items-center gap-2 transition-all relative overflow-hidden active:scale-95 ${weapon.type === type
                  ? 'bg-slate-800/50 border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.1)]'
                  : 'bg-slate-900/30 border-slate-800 active:bg-slate-800'
                  }`}
              >
                {weapon.type === type && <div className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-yellow-500 rounded-full animate-pulse"></div>}
                <div className="w-full h-16 flex items-center justify-center">
                  <img
                    src={imagePath}
                    alt={typeNames[type]}
                    className="h-full w-auto object-contain max-w-full"
                    style={{ filter: weapon.type === type ? 'drop-shadow(0 0 8px rgba(234,179,8,0.5))' : 'none' }}
                  />
                </div>
                <span className={`font-bold text-sm ${weapon.type === type ? 'text-yellow-100' : 'text-slate-400'}`}>{typeNames[type]}</span>
              </button>
            );
          })}
        </div>
        <p className="text-center text-xs text-slate-600 mt-4">
          새 무기 제작 시 현재 강화 수치가 초기화됩니다.
        </p>
      </div>
    </div>
  );

  // Chat Message Component
  const ChatMessageItem: React.FC<{ message: GlobalChatMessage; isOwnMessage: boolean }> = ({ message, isOwnMessage }) => {
    const isSystem = message.type === 'system';
    const isChat = message.type === 'chat';
    const isEnhancement = message.type === 'enhancement';
    const isBattle = message.type === 'battle';
    const isShowOff = message.type === 'showoff';

    // 무기 카드 표시 여부
    const showWeaponCard = (isEnhancement && message.metadata?.success) || isShowOff;
    const weaponForCard = showWeaponCard && message.metadata ? {
      id: 'chat_weapon',
      type: (message.metadata.weaponType as WeaponType) || WeaponType.SWORD,
      name: message.metadata.weaponName || '무기',
      level: message.metadata.weaponLevel || 0,
      baseDamage: 10,
      description: message.metadata.weaponDescription || '',
      totalEnhanceCost: 0,
      element: message.metadata.weaponElement as ElementType | undefined,
      elementLevel: message.metadata.weaponElementLevel
    } : null;

    if (isSystem) {
      return (
        <div className="flex justify-center my-4">
          <div className="bg-slate-800/50 px-4 py-2 rounded-full text-xs text-slate-400 border border-slate-700/50">
            {message.content}
          </div>
        </div>
      );
    }

    if (isChat && isOwnMessage) {
      return (
        <div className="flex justify-end mb-3">
          <div className="max-w-[80%] bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl rounded-br-md px-4 py-3 text-sm text-white shadow-lg">
            <div className="text-xs text-blue-200 mb-1">{message.username}</div>
            {message.content}
          </div>
        </div>
      );
    }

    // Enhancement, Battle, ShowOff, or other user's chat messages
    const isMaintain = isEnhancement && message.metadata?.success === undefined;

    return (
      <div className="flex justify-start mb-3">
        <div className="flex gap-2 max-w-[85%]">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white font-bold text-xs ${isEnhancement ? (message.metadata?.success ? 'bg-green-600' : isMaintain ? 'bg-blue-600' : 'bg-red-600') :
            isBattle ? (message.metadata?.success ? 'bg-yellow-600' : 'bg-slate-600') :
              isShowOff ? 'bg-gradient-to-br from-yellow-500 to-orange-500' :
                'bg-gradient-to-br from-purple-600 to-indigo-600'
            }`}>
            {isEnhancement ? <Hammer size={16} className="text-white" /> :
              isBattle ? <Swords size={16} className="text-white" /> :
                isShowOff ? <Trophy size={16} className="text-white" /> :
                  message.username[0].toUpperCase()}
          </div>
          <div className={`rounded-2xl rounded-bl-md px-4 py-3 text-sm shadow-lg ${isEnhancement ? (
            message.metadata?.success ? 'bg-green-950 border border-green-500/30 text-green-100' :
              isMaintain ? 'bg-blue-950 border border-blue-500/30 text-blue-100' :
                'bg-red-950 border border-red-500/30 text-red-100'
          ) :
            isBattle ? (message.metadata?.success ? 'bg-yellow-950 border border-yellow-500/30 text-yellow-100' : 'bg-slate-900 border border-slate-600/30 text-slate-200') :
              isShowOff ? 'bg-gradient-to-br from-yellow-950 to-orange-950 border border-yellow-500/30 text-yellow-100' :
                'bg-slate-900 border border-slate-700/50 text-slate-200'
            }`}>
            <div className="text-xs text-slate-400 mb-1 font-bold">{message.username}</div>
            <div className="whitespace-pre-wrap">{message.content}</div>
            {/* 무기 카드 표시 */}
            {weaponForCard && (
              <div className="mt-3">
                <ChatWeaponCard weapon={weaponForCard} />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Main Chat UI
  const renderChatUI = (isFrame = false) => (
    <div className={`flex flex-col ${isFrame ? 'h-full' : 'h-screen'} overflow-hidden`}>
      {/* Header with Mini Weapon Card - Fixed Top */}
      <div className={`flex-shrink-0 z-40 bg-slate-950/95 backdrop-blur-xl border-b border-white/5 ${isFrame ? 'pt-8' : 'pt-safe'}`}>
        <div className="px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            {/* Mini Weapon Card */}
            <div className="flex-1">
              <MiniWeaponCard weapon={weapon} onClick={() => setShowWeaponDetail(true)} />
            </div>
            {/* Resources */}
            <div className="flex flex-col gap-1.5">
              <div className="glass-panel px-2.5 py-1.5 rounded-lg flex items-center gap-1.5">
                <Coins size={14} className="text-yellow-400" />
                <span className="text-xs font-mono font-bold text-yellow-100">{stats.gold.toLocaleString()}</span>
              </div>
              <div className="glass-panel px-2.5 py-1.5 rounded-lg flex items-center gap-1.5">
                <ScrollText size={14} className="text-blue-400" />
                <span className="text-xs font-mono font-bold text-blue-100">{stats.scrolls}</span>
              </div>
            </div>
            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700 transition-all"
              title="로그아웃"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area - Scrollable */}
      <div id="chat-scroll-container" ref={chatContainerRef} className="flex-1 overflow-y-auto overflow-x-hidden bg-black" style={{ WebkitOverflowScrolling: 'touch' }}>
        {view === GameView.HOME && (
          <div className="px-4 py-4 min-h-full">
              {globalMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-12">
                  <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center mb-4">
                    <Globe size={40} className="text-slate-500" />
                  </div>
                  <p className="text-slate-400 text-sm mb-2">실시간 글로벌 채팅</p>
                  <p className="text-slate-500 text-xs">모든 기사들의 활동이 여기에 표시됩니다.</p>
                </div>
              ) : (
                <>
                  {globalMessages.map((msg) => (
                    <ChatMessageItem key={msg.id} message={msg} isOwnMessage={msg.uid === firebaseUser?.uid} />
                  ))}
                  <div id="chat-end-marker" ref={chatEndRef} />
                </>
              )}
            </div>
          )}
          {view === GameView.SHOP && (
            <div className="px-4 py-4">
              {renderShop()}
            </div>
          )}
          {view === GameView.ENHANCE && (
            <div className="px-4 py-4">
              {renderEnhance()}
            </div>
          )}
          {view === GameView.ELEMENT && (
            <div className="px-4 py-4">
              {renderElementEnhance()}
            </div>
          )}
          {view === GameView.BATTLE && (
            <div className="px-4 py-4">
              {renderBattle()}
            </div>
          )}
      </div>

      {/* Scroll to Bottom Button */}
      {view === GameView.HOME && showScrollButton && globalMessages.length > 0 && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            scrollChatToBottom(true);
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            e.stopPropagation();
            scrollChatToBottom(true);
          }}
          className="fixed top-40 right-3 md:top-36 md:right-auto md:left-1/2 md:translate-x-[200px] w-11 h-11 bg-blue-600 text-white rounded-full shadow-xl flex items-center justify-center active:scale-90 z-[9999] border-2 border-white/30"
          style={{ touchAction: 'manipulation' }}
          title="맨 아래로"
        >
          <ChevronDown size={24} />
        </button>
      )}

      {/* Bottom Fixed Section */}
      <div className={`flex-shrink-0 bg-slate-950 border-t border-white/10 ${isFrame ? '' : ''}`}>
        {/* Action Buttons */}
        <div className="px-4 py-2">
          <div className="flex gap-2">
            <button
              onClick={handleEnhance}
              disabled={isEnhancing}
              className="flex-1 bg-gradient-to-r from-violet-600 to-indigo-600 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50 shadow-lg"
            >
              <Hammer size={18} />
              강화
            </button>
            <button
              onClick={() => setView(GameView.ELEMENT)}
              className="flex-1 bg-gradient-to-r from-cyan-600 to-blue-600 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg"
            >
              <Sparkles size={18} />
              속성
            </button>
            <button
              onClick={() => setView(GameView.BATTLE)}
              className="flex-1 bg-gradient-to-r from-rose-600 to-orange-600 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg"
            >
              <Swords size={18} />
              전투
            </button>
            <button
              onClick={handleShowOff}
              className="bg-gradient-to-r from-yellow-600 to-orange-600 text-white px-3 py-3 rounded-xl font-bold text-sm flex items-center justify-center active:scale-95 transition-all shadow-lg"
              title="자랑하기"
            >
              <Trophy size={18} />
            </button>
          </div>
        </div>

        {/* Chat Input */}
        <div className="px-4 py-2 border-t border-white/5">
          <ChatInput onSubmit={handleChatSubmit} />
        </div>

        {/* Navigation Bar */}
        <nav className="flex justify-around items-center h-16 px-2 border-t border-white/10 bg-slate-900/95 pb-safe">
          {[
            { id: GameView.HOME, icon: UserIcon, label: '정보' },
            { id: GameView.SHOP, icon: ShoppingBag, label: '상점' },
            { id: GameView.ENHANCE, icon: Hammer, label: '강화' },
            { id: GameView.ELEMENT, icon: Sparkles, label: '속성' },
            { id: GameView.BATTLE, icon: Sword, label: '전투' },
          ].map((item) => {
            const isActive = view === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`relative flex flex-col items-center justify-center min-w-[72px] h-14 rounded-2xl transition-all duration-200 active:scale-95 ${isActive
                  ? 'text-yellow-400 bg-yellow-500/10'
                  : 'text-slate-500 active:text-slate-300 active:bg-slate-800/50'
                  }`}
              >
                <item.icon size={22} strokeWidth={isActive ? 2.5 : 2} className={isActive ? 'drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]' : ''} />
                <span className={`text-[10px] font-semibold mt-0.5 ${isActive ? 'text-yellow-400' : 'text-slate-500'}`}>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Weapon Detail Modal */}
      {showWeaponDetail && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowWeaponDetail(false)}>
          <div className="w-full max-w-sm animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <WeaponCard weapon={weapon} />
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="glass-panel p-3 rounded-2xl text-center">
                <Trophy size={24} className="text-yellow-500 mx-auto mb-1" />
                <div className="text-xs text-slate-400">승리</div>
                <div className="text-lg font-bold text-white">{stats.wins}</div>
              </div>
              <div className="glass-panel p-3 rounded-2xl text-center">
                <Skull size={24} className="text-slate-500 mx-auto mb-1" />
                <div className="text-xs text-slate-400">패배</div>
                <div className="text-lg font-bold text-white">{stats.losses}</div>
              </div>
            </div>
            <button
              onClick={() => setShowWeaponDetail(false)}
              className="w-full mt-4 py-3 bg-slate-800 text-slate-300 rounded-2xl font-bold active:scale-95 transition-all"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* 출석체크 팝업 */}
      {showAttendancePopup && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm animate-fade-in glass-panel p-6 rounded-3xl text-center">
            <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-full flex items-center justify-center animate-pulse">
              <Gift size={40} className="text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">🎉 출석체크!</h2>
            <p className="text-slate-400 mb-4">4시간마다 받을 수 있는 보상이 준비되었습니다!</p>
            <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-2xl p-4 mb-6">
              <div className="flex items-center justify-center gap-2">
                <Coins size={28} className="text-yellow-400" />
                <span className="text-2xl font-bold text-yellow-300">+{ATTENDANCE_REWARD.toLocaleString()}G</span>
              </div>
            </div>
            <button
              onClick={handleAttendanceCheck}
              className="w-full py-4 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-2xl font-bold text-lg active:scale-95 transition-all shadow-lg shadow-yellow-500/30"
            >
              보상 받기
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop: Wide container */}
      <div className="hidden md:flex min-h-screen bg-slate-950 items-center justify-center p-4">
        <div className="relative w-full max-w-[480px] h-[90vh] bg-slate-900 rounded-3xl shadow-2xl shadow-black/50 border border-slate-700 overflow-hidden">
          {/* Screen Content */}
          <div className="relative w-full h-full overflow-hidden bg-mesh">
            {view === GameView.LOGIN ? renderLogin(true) : renderChatUI(true)}
          </div>
        </div>
      </div>

      {/* Mobile: Full screen */}
      <div className="md:hidden min-h-screen bg-mesh relative">
        {view === GameView.LOGIN ? renderLogin() : renderChatUI()}
      </div>
    </>
  );
}