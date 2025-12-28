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
  Gift,
  Camera,
  HelpCircle,
  X,
  EyeOff
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
  updateUserProfile,
  sendGlobalMessage,
  subscribeToGlobalChat,
  getRandomOpponent,
  isFirebaseConfigured,
  getAllUsers,
  getAllGameData,
  giftGoldToUser,
  clearAllChatMessages,
  clearOldChatMessages,
  clearAllDataExceptAdmin,
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

// 관리자 아이디 (내부적으로 @knight.game 이메일로 저장됨)
const ADMIN_EMAILS = ['knight@knight.game'];

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
const ChatInput: React.FC<{ onSubmit: (text: string, whisperTo?: string) => void; userList: string[]; currentUsername?: string }> = React.memo(({ onSubmit, userList, currentUsername }) => {
  // 본인 제외한 유저 리스트
  const otherUsers = currentUsername ? userList.filter(u => u !== currentUsername) : userList;
  const [input, setInput] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownType, setDropdownType] = useState<'mention' | 'whisper'>('mention');
  const [searchText, setSearchText] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  // 고정 모드: 'none' | 'mention' | 'whisper'
  const [fixedMode, setFixedMode] = useState<'none' | 'mention' | 'whisper'>('none');
  const [fixedTarget, setFixedTarget] = useState<string>('');
  const [showModeDropdown, setShowModeDropdown] = useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // 검색어에 맞는 유저 필터링 (본인 제외)
  const filteredUsers = otherUsers.filter(u =>
    u.toLowerCase().includes(searchText.toLowerCase())
  ).slice(0, 5);

  // 모드 버튼 클릭 시 유저 선택 드롭다운 표시
  const handleModeClick = (mode: 'mention' | 'whisper') => {
    if (fixedMode === mode && fixedTarget) {
      // 같은 모드 다시 클릭하면 해제
      setFixedMode('none');
      setFixedTarget('');
      setShowModeDropdown(false);
    } else {
      setDropdownType(mode);
      setShowModeDropdown(true);
      setSearchText('');
      setSelectedIndex(0);
    }
  };

  // 모드 드롭다운에서 유저 선택
  const selectModeTarget = (username: string) => {
    setFixedMode(dropdownType);
    setFixedTarget(username);
    setShowModeDropdown(false);
    setSearchText('');
    inputRef.current?.focus();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInput(value);

    // 고정 모드가 설정되어 있으면 자동 감지 안함
    if (fixedMode !== 'none') {
      setShowDropdown(false);
      return;
    }

    // / 귓속말 감지 (맨 앞에서 시작하는 경우)
    if (value.startsWith('/')) {
      const afterSlash = value.slice(1);
      const spaceIndex = afterSlash.indexOf(' ');
      if (spaceIndex === -1) {
        // 아직 공백이 없으면 유저 선택 중
        setShowDropdown(true);
        setDropdownType('whisper');
        setSearchText(afterSlash);
        setSelectedIndex(0);
        return;
      }
    }

    // @ 멘션 감지
    const lastAtIndex = value.lastIndexOf('@');
    if (lastAtIndex !== -1) {
      const afterAt = value.slice(lastAtIndex + 1);
      if (!afterAt.includes(' ')) {
        setShowDropdown(true);
        setDropdownType('mention');
        setSearchText(afterAt);
        setSelectedIndex(0);
        return;
      }
    }

    setShowDropdown(false);
  };

  const insertUser = (username: string) => {
    if (dropdownType === 'whisper') {
      setInput('/' + username + ' ');
    } else {
      const lastAtIndex = input.lastIndexOf('@');
      const newInput = input.slice(0, lastAtIndex) + '@' + username + ' ';
      setInput(newInput);
    }
    setShowDropdown(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showDropdown && filteredUsers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % filteredUsers.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredUsers.length) % filteredUsers.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertUser(filteredUsers[selectedIndex]);
        return;
      } else if (e.key === 'Escape') {
        setShowDropdown(false);
        return;
      }
    }

    if (e.key === 'Enter' && !e.nativeEvent.isComposing && !showDropdown) {
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    const text = input.trim();
    if (!text) return;

    // 고정 모드가 설정되어 있으면 해당 모드로 전송
    if (fixedMode === 'whisper' && fixedTarget) {
      setInput('');
      onSubmit(text, fixedTarget);
      return;
    }

    if (fixedMode === 'mention' && fixedTarget) {
      const messageWithMention = `@${fixedTarget} ${text}`;
      setInput('');
      onSubmit(messageWithMention);
      return;
    }

    // 귓속말 파싱: /유저이름 메시지
    if (text.startsWith('/')) {
      const spaceIndex = text.indexOf(' ');
      if (spaceIndex > 1) {
        const whisperTo = text.slice(1, spaceIndex);
        const message = text.slice(spaceIndex + 1).trim();
        if (message && userList.includes(whisperTo)) {
          setInput('');
          setShowDropdown(false);
          onSubmit(message, whisperTo);
          return;
        }
      }
    }

    setInput('');
    setShowDropdown(false);
    onSubmit(text);
  };

  // 귓속말 모드인지 확인 (고정 모드 또는 수동 입력)
  const isWhisperMode = fixedMode === 'whisper' || (input.startsWith('/') && input.indexOf(' ') > 1);
  const isMentionMode = fixedMode === 'mention';
  const whisperTarget = fixedMode === 'whisper' ? fixedTarget : (input.startsWith('/') && input.indexOf(' ') > 1 ? input.slice(1, input.indexOf(' ')) : null);

  return (
    <div className="relative">
      {/* 유저 선택 드롭다운 */}
      {showDropdown && filteredUsers.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 mb-2 bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-xl z-50">
          <div className={`px-3 py-1.5 text-xs font-bold border-b border-slate-700 ${dropdownType === 'whisper' ? 'text-pink-400 bg-pink-500/10' : 'text-blue-400 bg-blue-500/10'}`}>
            {dropdownType === 'whisper' ? '🤫 귓속말 대상 선택' : '@ 멘션'}
          </div>
          {filteredUsers.map((user, idx) => (
            <button
              key={user}
              onClick={() => insertUser(user)}
              className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-2 transition-colors ${
                idx === selectedIndex
                  ? (dropdownType === 'whisper' ? 'bg-pink-600 text-white' : 'bg-blue-600 text-white')
                  : 'text-slate-300 hover:bg-slate-700'
              }`}
            >
              <span className={dropdownType === 'whisper' ? 'text-pink-400' : 'text-blue-400'}>
                {dropdownType === 'whisper' ? '/' : '@'}
              </span>
              <span>{user}</span>
            </button>
          ))}
        </div>
      )}

      {/* 모드 선택 드롭다운 - 바깥 클릭 시 닫기 */}
      {showModeDropdown && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => { setShowModeDropdown(false); setSearchText(''); }} />
          <div className="absolute bottom-full left-0 right-0 mb-2 bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-xl z-50">
          <div className={`px-3 py-1.5 text-xs font-bold border-b border-slate-700 ${dropdownType === 'whisper' ? 'text-pink-400 bg-pink-500/10' : 'text-blue-400 bg-blue-500/10'}`}>
            {dropdownType === 'whisper' ? '🤫 귓속말 대상 선택' : '@ 멘션 대상 선택'}
          </div>
          {/* 검색창 */}
          <div className="p-2 border-b border-slate-700">
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="사용자 검색..."
              autoFocus
              className="w-full bg-slate-900 border border-slate-600 rounded-lg py-2 px-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-slate-500"
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {otherUsers
              .filter(u => u.toLowerCase().includes(searchText.toLowerCase()))
              .slice(0, 10)
              .map((user) => (
              <button
                key={user}
                onClick={() => selectModeTarget(user)}
                className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-2 transition-colors text-slate-300 hover:bg-slate-700`}
              >
                <span className={dropdownType === 'whisper' ? 'text-pink-400' : 'text-blue-400'}>
                  {dropdownType === 'whisper' ? '/' : '@'}
                </span>
                <span>{user}</span>
              </button>
            ))}
            {otherUsers.filter(u => u.toLowerCase().includes(searchText.toLowerCase())).length === 0 && (
              <div className="px-4 py-3 text-sm text-slate-500 text-center">
                검색 결과가 없습니다
              </div>
            )}
          </div>
          {/* 닫기 버튼 */}
          <button
            onClick={() => { setShowModeDropdown(false); setSearchText(''); }}
            className="w-full px-4 py-2 text-xs text-slate-500 hover:text-slate-300 border-t border-slate-700 hover:bg-slate-700/50"
          >
            닫기
          </button>
        </div>
        </>
      )}

      {/* 고정 모드 표시 */}
      {fixedMode !== 'none' && fixedTarget && (
        <div className={`absolute -top-7 left-0 text-xs flex items-center gap-1 ${fixedMode === 'whisper' ? 'text-pink-400' : 'text-blue-400'}`}>
          <span>{fixedMode === 'whisper' ? '🤫' : '@'}</span>
          <span>{fixedTarget}{fixedMode === 'whisper' ? '에게 귓속말' : ' 멘션'} 모드</span>
          <button
            onClick={() => { setFixedMode('none'); setFixedTarget(''); }}
            className="ml-1 text-slate-500 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      <div className="flex gap-2">
        {/* 모드 버튼 */}
        <div className="flex">
          <button
            onClick={() => handleModeClick('mention')}
            className={`px-3 py-3 rounded-l-2xl flex items-center justify-center active:scale-95 transition-all border-r border-slate-600 ${
              fixedMode === 'mention'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
            }`}
          >
            <span className="font-bold text-sm">@</span>
          </button>
          <button
            onClick={() => handleModeClick('whisper')}
            className={`px-3 py-3 rounded-r-2xl flex items-center justify-center active:scale-95 transition-all ${
              fixedMode === 'whisper'
                ? 'bg-pink-600 text-white'
                : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
            }`}
          >
            <span className="font-bold text-sm">/</span>
          </button>
        </div>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={fixedMode === 'whisper' ? `${fixedTarget}에게 귓속말...` : fixedMode === 'mention' ? `@${fixedTarget} 멘션...` : '채팅 (@멘션 /귓속말)'}
          className={`flex-1 bg-slate-800/80 border rounded-2xl py-3 px-4 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 transition-all ${
            isWhisperMode
              ? 'border-pink-500/50 focus:border-pink-500/50 focus:ring-pink-500/20'
              : isMentionMode
                ? 'border-blue-500/50 focus:border-blue-500/50 focus:ring-blue-500/20'
                : 'border-slate-700 focus:border-blue-500/50 focus:ring-blue-500/20'
          }`}
        />
        <button
          onClick={handleSubmit}
          className={`px-4 py-3 rounded-2xl flex items-center justify-center active:scale-95 transition-all ${
            isWhisperMode
              ? 'bg-pink-600 active:bg-pink-700 text-white'
              : 'bg-blue-600 active:bg-blue-700 text-white'
          }`}
        >
          <Send size={20} />
        </button>
        <button
          onClick={() => setShowHelp(true)}
          className="px-3 py-3 rounded-2xl bg-slate-700 hover:bg-slate-600 text-slate-300 flex items-center justify-center active:scale-95 transition-all"
        >
          <HelpCircle size={20} />
        </button>
      </div>

      {/* 도움말 모달 */}
      {showHelp && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowHelp(false)}>
          <div className="bg-slate-800 rounded-2xl w-full max-w-sm shadow-2xl border border-slate-700 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-700">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <HelpCircle size={20} className="text-blue-400" />
                채팅 도움말
              </h3>
              <button onClick={() => setShowHelp(false)} className="p-1 rounded-lg hover:bg-slate-700 transition-colors">
                <X size={20} className="text-slate-400" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="space-y-3">
                <div className="bg-slate-900/50 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-blue-400 font-bold">@</span>
                    <span className="font-semibold text-white">멘션</span>
                  </div>
                  <p className="text-sm text-slate-400">@유저이름을 입력하면 해당 유저에게 알림이 갑니다.</p>
                  <p className="text-xs text-slate-500 mt-1">예: @코리 안녕하세요!</p>
                </div>

                <div className="bg-slate-900/50 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-pink-400 font-bold">/</span>
                    <span className="font-semibold text-white">귓속말</span>
                  </div>
                  <p className="text-sm text-slate-400">/유저이름 메시지를 입력하면 해당 유저에게만 보이는 비밀 메시지를 보냅니다.</p>
                  <p className="text-xs text-slate-500 mt-1">예: /코리 비밀이야</p>
                </div>

                <div className="bg-slate-900/50 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-yellow-400">💬</span>
                    <span className="font-semibold text-white">일반 채팅</span>
                  </div>
                  <p className="text-sm text-slate-400">그냥 메시지를 입력하면 모든 유저에게 공개됩니다.</p>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-700">
                <p className="text-xs text-slate-500 text-center">자동완성: @나 /를 입력하면 유저 목록이 표시됩니다</p>
              </div>
            </div>
          </div>
        </div>
      )}
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

  // 무기 도감 State
  const [showWeaponGuide, setShowWeaponGuide] = useState<WeaponType | null>(null);

  // 프로필 설정 State
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Firebase Auth State
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isFirebaseReady, setIsFirebaseReady] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  // Login State
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [inputId, setInputId] = useState(''); // 아이디 (내부적으로 @knight.game 이메일로 변환)
  const [inputUsername, setInputUsername] = useState('');
  const [inputPassword, setInputPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Chat State - Global chat from Firebase
  const [globalMessages, setGlobalMessages] = useState<GlobalChatMessage[]>([]);
  const [showWeaponDetail, setShowWeaponDetail] = useState(false);
  const [useScrollForEnhance, setUseScrollForEnhance] = useState(false); // 주문서 사용 여부
  const chatEndRef = React.useRef<HTMLDivElement>(null);

  // 멘션 알림 State
  const [allUsernames, setAllUsernames] = useState<string[]>([]);
  const [userProfilesMap, setUserProfilesMap] = useState<Record<string, UserProfile>>({});
  const mentionSoundRef = React.useRef<HTMLAudioElement | null>(null);
  const lastMessageIdRef = React.useRef<string>('');

  // Battle State
  const [availableOpponents, setAvailableOpponents] = useState<{ profile: UserProfile, gameData: any }[]>([]);
  const [dailyBattleCount, setDailyBattleCount] = useState(0);
  const [lastBattleDate, setLastBattleDate] = useState<string>('');
  const [selectedOpponent, setSelectedOpponent] = useState<{ profile: UserProfile, gameData: any } | null>(null);
  const [isLoadingOpponents, setIsLoadingOpponents] = useState(false);
  const MAX_DAILY_BATTLES = 20;

  // 관리자 골드 선물 State
  const [giftGoldAmount, setGiftGoldAmount] = useState<string>('');
  const [showGiftModal, setShowGiftModal] = useState<{ profile: UserProfile, gameData: any } | null>(null);
  const [showSecretGiftModal, setShowSecretGiftModal] = useState<{ profile: UserProfile, gameData: any } | null>(null);
  const isAdmin = ADMIN_EMAILS.includes(firebaseUser?.email || '');

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

    // 상점, 강화 탭 클릭 시 스크롤 최상단으로
    if (viewId === GameView.SHOP || viewId === GameView.ENHANCE) {
      setTimeout(() => {
        const container = chatContainerRef.current;
        if (container) {
          container.scrollTop = 0;
        }
      }, 100);
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

  // 실시간 글로벌 채팅 구독 + 멘션 알림
  useEffect(() => {
    if (!firebaseConfigured || !firebaseUser) return;

    // 알림음 초기화
    if (!mentionSoundRef.current) {
      mentionSoundRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleivH5f+z2rqWgIBmT1dWVkpCPUBRaXuAgHJlY3V7f4WNlYmDf4WMnqWwnYV2dIaVp7CrmI1/eISNlqOynZqXoKq2xca6q5yYlJ2ssbu7rqmho6qytcPGyLuwnJmdqLayv8LBurKpr7jEx8/LuqGVl5+qt7/Av7y4uMDM1dfOuaKTkpmeqrW7vry4ucPO2NzZz7SZjoiTn6y2ur69w8zX4uPe0LCYh4SNo6+5vL7Dx83Z5urt5dG2m4iGkKKwu8HDyM/Y4+zy8unYv6CKhoqZqre/w8jP2eLt9PTs3cWokYeLlqSwu8HHz9fh7PP18+bPtp2Mh4+eq7a+xMrT3Ofw9fXv5NO6opGLkZ2rs73DytLb5e/29fHn2cWqmI+Pmaexu8HGztfd5+/19O/l18OpmJGSm6iyvL/GzdXe5+/z8+7j1cGnmZSXnqiyu7/Fzdbf6PL18+3h08CmmpWYn6ixu7/ExtPc5e3z9O/k1sKomZWYn6myu7/Fzdbf6PH08+3i1MGomZaYn6iyu8DFzdXe5+7z8+7k1sOnmZaYoKmyu8DGztbd5u7z9O7k1sOnmZaYoKmyusDGztbd5u7z8+7k1sOomZaYoKmyusHGztXe5+7z8+3j1cKnmZaYoKmyusDGztbd5u7z8+7k1sOnmZaYoKmyusDGztXd5u7z8+7k1sOnmZaYoKmyu8DGztbd5u7z9O7k1sOnmJaYoKmyusDGztXe5+7z8+3k1sOomZaYn6myusDGztbd5u7z8+7k1sOnmZaYoKmyusDGztXe5+7z8+3k1sOomZaYoKmyu8DGztbd5u/z8+7k1sOomZaYoKmyusDFzdbd5+7z9O7k1sOomZaYoKmyusDFztXe5+7z8+7k1sOomZaYn6myusDGztXe5+7z8+7k1sOomZaYoKmyusHGztXe5+7z8+3k1sOnmZaYoKmyu8DFztbd5u7z8+7k1sOn');
    }

    const unsubscribe = subscribeToGlobalChat((messages) => {
      // 새 메시지 확인 및 멘션 알림
      if (messages.length > 0) {
        const latestMsg = messages[messages.length - 1];

        // 새 메시지이고, 내 메시지가 아닌 경우
        if (latestMsg.id && latestMsg.id !== lastMessageIdRef.current && latestMsg.uid !== firebaseUser.uid) {
          // 귓속말 알림
          if (latestMsg.type === 'whisper' && latestMsg.whisperTo === stats.username) {
            mentionSoundRef.current?.play().catch(() => {});
            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
              new Notification('🤫 귓속말', {
                body: `${latestMsg.username}: ${latestMsg.content}`,
                icon: '/favicon.ico'
              });
            }
          }
          // 멘션 알림
          else if (latestMsg.content && latestMsg.content.includes(`@${stats.username}`)) {
            mentionSoundRef.current?.play().catch(() => {});
            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
              new Notification('멘션 알림', {
                body: `${latestMsg.username}: ${latestMsg.content}`,
                icon: '/favicon.ico'
              });
            }
          }
          lastMessageIdRef.current = latestMsg.id;
        }

        // 유저 이름 목록 업데이트 (멘션 자동완성용)
        const usernames = [...new Set(messages.map(m => m.username))];
        setAllUsernames(usernames);
      }

      setGlobalMessages(messages);
    }, 100);

    // 브라우저 알림 권한 요청 (Notification API 지원 브라우저만)
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    return () => unsubscribe();
  }, [firebaseConfigured, firebaseUser, stats.username]);

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
        .filter(u => !ADMIN_EMAILS.includes(u.email)) // 관리자 계정 숨김
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

  // 유저 프로필 로드 (프로필 이미지 표시용)
  useEffect(() => {
    const loadUserProfiles = async () => {
      try {
        const users = await getAllUsers();
        const profilesMap: Record<string, UserProfile> = {};
        users.forEach(user => {
          profilesMap[user.uid] = user;
        });
        setUserProfilesMap(profilesMap);
      } catch (error) {
        console.error('Failed to load user profiles:', error);
      }
    };

    if (firebaseUser) {
      loadUserProfiles();
      // 30초마다 프로필 업데이트 (새 유저 프로필 이미지 반영)
      const interval = setInterval(loadUserProfiles, 30000);
      return () => clearInterval(interval);
    }
  }, [firebaseUser]);

  // 관리자: 주간 채팅 자동 정리 (7일 이상 된 메시지 삭제)
  useEffect(() => {
    if (!firebaseUser || !isAdmin) return;

    const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
    const LAST_CLEANUP_KEY = 'lastChatCleanup';
    const lastCleanup = parseInt(localStorage.getItem(LAST_CLEANUP_KEY) || '0', 10);
    const now = Date.now();

    if (now - lastCleanup >= WEEK_MS) {
      // 일주일이 지났으면 정리 실행
      clearOldChatMessages(7).then((count) => {
        if (count > 0) {
          console.log(`[자동 정리] ${count}개의 오래된 채팅 메시지 삭제됨`);
        }
        localStorage.setItem(LAST_CLEANUP_KEY, now.toString());
      }).catch(console.error);
    }
  }, [firebaseUser, isAdmin]);

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

  // 아이디를 이메일 형식으로 변환
  const idToEmail = (id: string) => `${id.toLowerCase()}@knight.game`;

  const handleRegister = async () => {
    if (!firebaseConfigured) {
      setAuthError('Firebase가 설정되지 않았습니다. .env 파일을 확인해주세요.');
      return;
    }

    setAuthError('');
    if (!inputId.trim() || !inputPassword.trim() || !inputUsername.trim()) {
      setAuthError('모든 필드를 입력해주세요.');
      return;
    }
    if (inputId.trim().length < 6) {
      setAuthError('아이디는 6자 이상으로 입력해주세요.');
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(inputId.trim())) {
      setAuthError('아이디는 영문, 숫자, 밑줄(_)만 사용할 수 있습니다.');
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
      const fakeEmail = idToEmail(inputId.trim());
      await registerUser(fakeEmail, inputPassword, inputUsername.trim());
      // Firebase Auth 상태 변경으로 자동 로그인됨
      setTimeout(() => {
        sendGlobalChatMessage('system', `🎉 ${inputUsername.trim()}님이 새로운 기사로 등록했습니다!`);
      }, 1000);
    } catch (error: any) {
      console.error('Register error:', error);
      if (error.code === 'auth/email-already-in-use') {
        setAuthError('이미 사용 중인 아이디입니다.');
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
    if (!inputId.trim() || !inputPassword.trim()) {
      setAuthError('아이디와 비밀번호를 입력해주세요.');
      return;
    }
    if (inputId.trim().length < 6) {
      setAuthError('아이디는 6자 이상입니다.');
      return;
    }

    setAuthLoading(true);
    try {
      const fakeEmail = idToEmail(inputId.trim());
      await loginUser(fakeEmail, inputPassword);
      // Firebase Auth 상태 변경으로 자동 로그인됨
    } catch (error: any) {
      console.error('Login error:', error);
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        setAuthError('아이디 또는 비밀번호가 일치하지 않습니다.');
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

    // 전투력 계산 (레벨 기반, 레벨당 +30 전투력 + 레벨² 보너스)
    const myPower = weapon.baseDamage + (weapon.level * 30) + (weapon.level * weapon.level * 3);
    const opponentWeapon = opponent.gameData.weapon;
    const opponentPower = opponentWeapon.baseDamage + (opponentWeapon.level * 30) + (opponentWeapon.level * opponentWeapon.level * 3);

    // 레벨 차이 계산
    const levelGap = weapon.level - opponentWeapon.level;

    // 무기 상성 체크 (약 1.5레벨 가치, ±8%)
    const typeAdvantage = getTypeAdvantage(weapon.type, opponentWeapon.type);
    const typeBonus = typeAdvantage === 'advantage' ? 0.08 : typeAdvantage === 'disadvantage' ? -0.08 : 0;

    // 속성 상성 체크 (약 1레벨 가치, ±5%)
    const elementAdvantage = getElementAdvantage(weapon.element, opponentWeapon.element);
    const elementBonus = elementAdvantage === 'advantage' ? 0.05 : elementAdvantage === 'disadvantage' ? -0.05 : 0;

    // 속성 레벨 보너스 (레벨당 0.8%, 최대 ±8%)
    const myElementLevel = weapon.elementLevel || 0;
    const oppElementLevel = opponentWeapon.elementLevel || 0;
    const elementLevelDiff = myElementLevel - oppElementLevel;
    const elementLevelBonus = Math.max(-0.08, Math.min(0.08, elementLevelDiff * 0.008));

    // 기본 승률 계산 (레벨 차이에 따른 점진적 증가, 디미니싱 리턴 적용)
    // 레벨 차이 1당 약 5% 승률 변화 (최대 ±25%)
    const levelBonus = Math.max(-0.25, Math.min(0.25, levelGap * 0.05));

    // 전투력 차이 보너스 (전투력 비율 기반, 디미니싱 리턴)
    const powerRatio = myPower / Math.max(opponentPower, 1);
    const powerBonus = Math.max(-0.15, Math.min(0.15, (powerRatio - 1) * 0.3));

    // 최종 승률 계산
    // 기본 50% + 레벨 보너스 + 전투력 보너스 + 상성 보너스들
    let winChance = 0.5 + levelBonus + powerBonus + typeBonus + elementBonus + elementLevelBonus;

    // 승률 범위 제한 (20% ~ 80%) - 항상 역전 가능성 유지
    winChance = Math.max(0.20, Math.min(0.80, winChance));

    // 🔥 불굴의 투지: 저레벨이 고레벨 상대 시 5% 확률로 발동 (레벨 차이 3~5)
    const levelDiff = opponentWeapon.level - weapon.level;
    const isUnderdog = levelDiff >= 3 && levelDiff <= 5; // 레벨 차이 3~5일 때만
    const indomitableRoll = Math.random();
    const isIndomitableSpirit = isUnderdog && indomitableRoll < 0.05; // 5% 확률

    // 승리 판정: 불굴의 투지 발동 시 무조건 승리
    const normalWin = Math.random() < winChance;
    const isWin = isIndomitableSpirit || normalWin;

    // 보상 계산
    const baseReward = 100 + (opponentWeapon.level * 20);
    const opponentGold = opponent.gameData.stats?.gold || 0;

    let reward: number;
    let lootedGold = 0;

    if (isIndomitableSpirit) {
      // 불굴의 투지 발동: 상대 골드의 50% 약탈!
      lootedGold = Math.floor(opponentGold * 0.5);
      reward = baseReward + lootedGold;
    } else if (isWin) {
      // 일반 승리: 언더독 보너스 적용
      const underDogBonus = (levelDiff > 0) ? (1 + (levelDiff * 0.5)) : 1;
      reward = Math.floor(baseReward * underDogBonus);
    } else {
      // 패배: 위로금
      reward = Math.floor(baseReward * 0.2);
    }

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

    addLog('battle', isWin ? `승리! vs ${opponent.profile.username} +${reward.toLocaleString()}G` : `패배... vs ${opponent.profile.username} +${reward.toLocaleString()}G`, battleLog, isWin);

    // 속성 표시 문자열
    const myElementStr = weapon.element && weapon.element !== ElementType.NONE
      ? ` [${ELEMENT_NAMES[weapon.element]}+${weapon.elementLevel || 0}]` : '';
    const oppElementStr = opponentWeapon.element && opponentWeapon.element !== ElementType.NONE
      ? ` [${ELEMENT_NAMES[opponentWeapon.element]}+${opponentWeapon.elementLevel || 0}]` : '';

    // 특수 승리 메시지
    let specialMsg = '';
    if (isIndomitableSpirit) {
      specialMsg = `\n\n🔥 【 불굴의 투지 발동! 】 🔥\n약자의 반격! 상대 골드 ${lootedGold.toLocaleString()}G 약탈!`;
    } else if (isWin && levelDiff > 0) {
      const underDogMultiplier = 1 + (levelDiff * 0.5);
      specialMsg = `\n🎯 언더독 보너스! (+${levelDiff}레벨 차이 → x${underDogMultiplier.toFixed(1)} 보상!)`;
    }

    sendGlobalChatMessage('battle',
      `⚔️ PvP 매치!\n\n` +
      `[+${weapon.level}] ${weapon.name} (${WEAPON_TYPE_NAMES[weapon.type]})${myElementStr} - 전투력: ${myPower.toLocaleString()}\n` +
      `  VS\n` +
      `@${opponent.profile.username} [+${opponentWeapon.level}] ${opponentWeapon.name} (${WEAPON_TYPE_NAMES[opponentWeapon.type]})${oppElementStr} - 전투력: ${opponentPower.toLocaleString()}` +
      advantageMsg + `\n\n` +
      `${battleLog}` +
      (isWin
        ? `\n\n🏆 승리! @${opponent.profile.username}님을 물리쳤습니다!${specialMsg}\n💰 +${reward.toLocaleString()}G 획득!`
        : `\n\n💀 패배... @${opponent.profile.username}님에게 패배했습니다.\n💰 +${reward.toLocaleString()}G 위로금`), {
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

  const handleChatSubmit = async (input: string, whisperTo?: string) => {
    if (!input) return;

    // 귓속말 처리
    if (whisperTo) {
      await sendGlobalMessage({
        uid: firebaseUser!.uid,
        username: stats.username,
        type: 'whisper',
        content: input,
        whisperTo: whisperTo
      });
      return;
    }

    // 명령어 처리 (슬래시로 시작하는 경우만) - 귓속말이 아닌 경우에만
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

      // 관리자 비밀 명령어: /선물 유저이름 금액 또는 /gift username amount
      if (isAdmin) {
        const giftMatch = input.match(/^\/(선물|gift)\s+(\S+)\s+(\d+)$/i);
        if (giftMatch) {
          const targetUsername = giftMatch[2];
          const amount = parseInt(giftMatch[3], 10);

          if (amount <= 0) {
            // 귓속말로 에러 표시 (자기 자신에게)
            await sendGlobalMessage({
              uid: firebaseUser!.uid,
              username: '시스템',
              type: 'whisper',
              content: '금액은 1 이상이어야 합니다.',
              whisperTo: stats.username
            });
            return;
          }

          // 유저 찾기
          const users = await getAllUsers();
          const targetUser = users.find(u => u.username === targetUsername);

          if (!targetUser) {
            await sendGlobalMessage({
              uid: firebaseUser!.uid,
              username: '시스템',
              type: 'whisper',
              content: `'${targetUsername}' 유저를 찾을 수 없습니다.`,
              whisperTo: stats.username
            });
            return;
          }

          // 골드 선물
          const success = await giftGoldToUser(targetUser.uid, amount);
          if (success) {
            await sendGlobalMessage({
              uid: firebaseUser!.uid,
              username: '시스템',
              type: 'whisper',
              content: `${targetUsername}에게 ${amount.toLocaleString()}G를 선물했습니다.`,
              whisperTo: stats.username
            });
          } else {
            await sendGlobalMessage({
              uid: firebaseUser!.uid,
              username: '시스템',
              type: 'whisper',
              content: '골드 선물에 실패했습니다.',
              whisperTo: stats.username
            });
          }
          return;
        }
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

          {/* ID Input */}
          <label className="block text-xs uppercase text-slate-400 font-bold mb-2 ml-1">아이디</label>
          <div className="relative mb-4">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
              <UserIcon size={20} />
            </div>
            <input
              type="text"
              value={inputId}
              onChange={(e) => setInputId(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
              placeholder="아이디 입력 (6자 이상, 영문/숫자)..."
              className="w-full bg-slate-950/60 border border-slate-700 rounded-2xl py-4 pl-12 pr-4 text-base text-white placeholder:text-slate-600 focus:outline-none focus:border-yellow-500/50 focus:ring-2 focus:ring-yellow-500/30 transition-all"
              autoComplete="username"
              autoCapitalize="off"
              maxLength={20}
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

    // 랭킹 데이터 생성 (나 + 상대들, 관리자 제외)
    const allPlayers = [
      // 관리자가 아닌 경우만 본인 추가
      ...(isAdmin ? [] : [{ username: stats.username, wins: stats.wins, losses: stats.losses, level: weapon.level, isMe: true, profileImage: userProfile?.profileImage }]),
      ...availableOpponents.map(opp => ({
        username: opp.profile.username,
        wins: opp.gameData.stats?.wins || 0,
        losses: opp.gameData.stats?.losses || 0,
        level: opp.gameData.weapon?.level || 0,
        isMe: false,
        profileImage: opp.profile.profileImage
      }))
    ].sort((a, b) => b.wins - a.wins);

    return (
      <div className="flex flex-col animate-fade-in space-y-4">
        {/* Header */}
        <div className="text-center space-y-1">
          <h2 className="text-2xl font-bold text-white tracking-tight uppercase">아레나</h2>
          <p className="text-slate-400 text-sm">
            오늘 전투: <span className="text-yellow-400 font-bold">{dailyBattleCount}</span> / {MAX_DAILY_BATTLES}회
          </p>
        </div>

        {/* 랭킹 */}
        <div className="glass-panel p-3 rounded-xl">
          <div className="flex items-center gap-2 mb-3">
            <Trophy size={16} className="text-yellow-400" />
            <h3 className="text-sm font-bold text-white">승리 랭킹</h3>
          </div>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {allPlayers.slice(0, 10).map((player, idx) => (
              <div
                key={player.username}
                className={`flex items-center justify-between px-2 py-1.5 rounded-lg ${player.isMe ? 'bg-yellow-500/10 border border-yellow-500/30' : 'bg-slate-800/30'}`}
              >
                <div className="flex items-center gap-2">
                  <span className={`w-5 text-center font-bold text-xs ${idx === 0 ? 'text-yellow-400' : idx === 1 ? 'text-slate-300' : idx === 2 ? 'text-orange-400' : 'text-slate-500'}`}>
                    {idx + 1}
                  </span>
                  <div className="w-6 h-6 rounded-full bg-slate-700 overflow-hidden flex items-center justify-center flex-shrink-0">
                    {player.profileImage ? (
                      <img src={player.profileImage} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <UserIcon size={14} className="text-slate-500" />
                    )}
                  </div>
                  <span className={`text-sm ${player.isMe ? 'text-yellow-400 font-bold' : 'text-slate-300'}`}>
                    {player.username}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-slate-500">+{player.level}</span>
                  <span className="text-green-400">{player.wins}승</span>
                  <span className="text-red-400">{player.losses}패</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* My Power */}
        {(() => {
          const myRank = allPlayers.findIndex(p => p.isMe) + 1;
          return (
            <div className="glass-panel p-3 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-2xl ${myRank === 1 ? 'bg-yellow-500/20 text-yellow-400' : myRank === 2 ? 'bg-slate-400/20 text-slate-300' : myRank === 3 ? 'bg-orange-500/20 text-orange-400' : 'bg-slate-700/50 text-slate-400'}`}>
                  {myRank}
                </div>
                <div className="w-10 h-10 rounded-full bg-slate-700 border-2 border-slate-600 overflow-hidden flex items-center justify-center flex-shrink-0">
                  {userProfile?.profileImage ? (
                    <img src={userProfile.profileImage} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <UserIcon size={20} className="text-slate-500" />
                  )}
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
          );
        })()}

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
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center overflow-hidden ${isSelected ? 'bg-rose-600 border-2 border-rose-400' : 'bg-slate-700 border-2 border-slate-600'
                          }`}>
                          {opp.profile.profileImage ? (
                            <img src={opp.profile.profileImage} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-white font-bold">{opp.profile.username[0]?.toUpperCase()}</span>
                          )}
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
                      <div className="text-right flex items-center gap-2">
                        {/* 관리자용 선물 버튼 */}
                        {isAdmin && (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowGiftModal(opp);
                                setGiftGoldAmount('');
                              }}
                              className="w-8 h-8 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 rounded-lg flex items-center justify-center active:scale-95 transition-all border border-yellow-500/30"
                              title="골드 선물 (공개)"
                            >
                              <Gift size={16} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowSecretGiftModal(opp);
                                setGiftGoldAmount('');
                              }}
                              className="w-8 h-8 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg flex items-center justify-center active:scale-95 transition-all border border-purple-500/30"
                              title="골드 선물 (비밀)"
                            >
                              <EyeOff size={16} />
                            </button>
                          </>
                        )}
                        <div>
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
            const isSelected = showWeaponGuide === type;
            return (
              <button
                key={type}
                onClick={() => setShowWeaponGuide(isSelected ? null : type)}
                className={`p-3 rounded-2xl border flex flex-col items-center gap-2 transition-all relative overflow-hidden active:scale-95 ${isSelected
                  ? 'bg-blue-900/30 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.2)]'
                  : weapon.type === type
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
                    style={{ filter: isSelected ? 'drop-shadow(0 0 8px rgba(59,130,246,0.5))' : weapon.type === type ? 'drop-shadow(0 0 8px rgba(234,179,8,0.5))' : 'none' }}
                  />
                </div>
                <span className={`font-bold text-sm ${isSelected ? 'text-blue-300' : weapon.type === type ? 'text-yellow-100' : 'text-slate-400'}`}>{typeNames[type]}</span>
              </button>
            );
          })}
        </div>

        {/* 무기 도감 */}
        {showWeaponGuide && (
          <div className="mt-4 p-4 bg-slate-800/50 rounded-2xl border border-slate-700/50 animate-fade-in">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-bold text-blue-400 flex items-center gap-2">
                <ScrollText size={16} />
                {showWeaponGuide === WeaponType.SWORD && '검 도감'}
                {showWeaponGuide === WeaponType.AXE && '도끼 도감'}
                {showWeaponGuide === WeaponType.HAMMER && '망치 도감'}
                {showWeaponGuide === WeaponType.SPEAR && '창 도감'}
              </h4>
              <button onClick={() => resetWeapon(showWeaponGuide)} className="text-xs bg-emerald-600 active:bg-emerald-700 px-3 py-1.5 rounded-lg font-bold">
                이 무기로 제작
              </button>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-slate-300">
                <Sword size={14} className="text-green-400" />
                <span className="text-green-400">유리:</span>
                <span>
                  {showWeaponGuide === WeaponType.SWORD && '창 (검으로 창을 쳐내고 접근)'}
                  {showWeaponGuide === WeaponType.AXE && '망치 (빠른 스윙으로 망치를 압도)'}
                  {showWeaponGuide === WeaponType.HAMMER && '검 (묵직한 타격으로 검을 부숨)'}
                  {showWeaponGuide === WeaponType.SPEAR && '도끼 (긴 사거리로 도끼를 제압)'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <Sword size={14} className="text-red-400" />
                <span className="text-red-400">불리:</span>
                <span>
                  {showWeaponGuide === WeaponType.SWORD && '망치 (묵직한 타격에 밀림)'}
                  {showWeaponGuide === WeaponType.AXE && '창 (긴 사거리에 접근 불가)'}
                  {showWeaponGuide === WeaponType.HAMMER && '도끼 (빠른 스윙에 대응 불가)'}
                  {showWeaponGuide === WeaponType.SPEAR && '검 (근접전에서 취약)'}
                </span>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-700/50 text-xs text-slate-500">
                💡 무기 상성은 승률에 ±8% 영향을 줍니다
              </div>

              {/* 무기 등급별 이미지 */}
              <div className="mt-4 pt-3 border-t border-slate-700/50">
                <p className="text-xs text-slate-400 mb-3 text-center">등급별 외형</p>
                <div className="space-y-3">
                  {['common', 'rare', 'epic', 'legendary', 'mythic'].map((rarity) => {
                    const rarityNames: Record<string, string> = {
                      common: '일반',
                      rare: '희귀',
                      epic: '영웅',
                      legendary: '전설',
                      mythic: '신화'
                    };
                    const rarityColors: Record<string, string> = {
                      common: 'text-slate-400 bg-slate-700/30 border-slate-600',
                      rare: 'text-blue-400 bg-blue-900/20 border-blue-700/50',
                      epic: 'text-purple-400 bg-purple-900/20 border-purple-700/50',
                      legendary: 'text-yellow-400 bg-yellow-900/20 border-yellow-700/50',
                      mythic: 'text-red-400 bg-red-900/20 border-red-700/50'
                    };
                    return (
                      <div key={rarity} className={`p-3 rounded-2xl border ${rarityColors[rarity]}`}>
                        <div className="w-full h-24 bg-slate-900/50 rounded-xl flex items-center justify-center mb-2">
                          <img
                            src={`/weapons/${showWeaponGuide!.toLowerCase()}_${rarity}.png`}
                            alt={rarityNames[rarity]}
                            className="h-20 w-auto object-contain"
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className={`font-bold text-sm ${rarityColors[rarity].split(' ')[0]}`}>{rarityNames[rarity]}</span>
                          <span className="text-xs text-slate-500">
                            {rarity === 'common' && '+0 ~ +3'}
                            {rarity === 'rare' && '+4 ~ +7'}
                            {rarity === 'epic' && '+8 ~ +11'}
                            {rarity === 'legendary' && '+12 ~ +16'}
                            {rarity === 'mythic' && '+17 ~ +20'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        <p className="text-center text-xs text-slate-600 mt-4">
          무기를 눌러 도감을 확인하세요
        </p>
      </div>
    </div>
  );

  // Profile/Settings render
  const renderProfile = () => {
    // 30일(밀리초) = 30 * 24 * 60 * 60 * 1000
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    const lastChange = userProfile?.lastUsernameChange || 0;
    const now = Date.now();
    const canChangeName = now - lastChange >= THIRTY_DAYS_MS;
    const daysRemaining = Math.ceil((THIRTY_DAYS_MS - (now - lastChange)) / (24 * 60 * 60 * 1000));

    const handleUsernameChange = async () => {
      if (!canChangeName) {
        setProfileMessage({ type: 'error', text: `이름 변경은 ${daysRemaining}일 후에 가능합니다` });
        return;
      }
      if (!newUsername.trim()) {
        setProfileMessage({ type: 'error', text: '새 이름을 입력해주세요' });
        return;
      }
      if (newUsername.length < 2 || newUsername.length > 10) {
        setProfileMessage({ type: 'error', text: '이름은 2~10자로 입력해주세요' });
        return;
      }
      try {
        // Update username in stats and Firestore
        const updatedStats = { ...stats, username: newUsername };
        setStats(updatedStats);
        if (firebaseUser) {
          await saveGameData(firebaseUser.uid, updatedStats, weapon);
          // Update lastUsernameChange timestamp
          await updateUserProfile(firebaseUser.uid, { username: newUsername, lastUsernameChange: Date.now() });
          setUserProfile(prev => prev ? { ...prev, username: newUsername, lastUsernameChange: Date.now() } : null);
        }
        setProfileMessage({ type: 'success', text: '이름이 변경되었습니다!' });
        setNewUsername('');
      } catch (error) {
        setProfileMessage({ type: 'error', text: '이름 변경에 실패했습니다' });
      }
    };

    const handlePasswordChange = async () => {
      if (!newPassword || !confirmPassword) {
        setProfileMessage({ type: 'error', text: '비밀번호를 입력해주세요' });
        return;
      }
      if (newPassword.length < 6) {
        setProfileMessage({ type: 'error', text: '비밀번호는 6자 이상이어야 합니다' });
        return;
      }
      if (newPassword !== confirmPassword) {
        setProfileMessage({ type: 'error', text: '비밀번호가 일치하지 않습니다' });
        return;
      }
      try {
        if (firebaseUser) {
          const { updatePassword } = await import('firebase/auth');
          await updatePassword(firebaseUser, newPassword);
          setProfileMessage({ type: 'success', text: '비밀번호가 변경되었습니다!' });
          setNewPassword('');
          setConfirmPassword('');
        }
      } catch (error: any) {
        if (error.code === 'auth/requires-recent-login') {
          setProfileMessage({ type: 'error', text: '보안을 위해 다시 로그인 후 시도해주세요' });
        } else {
          setProfileMessage({ type: 'error', text: '비밀번호 변경에 실패했습니다' });
        }
      }
    };

    const handleLogout = async () => {
      if (confirm('정말 로그아웃 하시겠습니까?')) {
        await logoutUser();
        setView(GameView.LOGIN);
      }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!file.type.startsWith('image/')) {
        setProfileMessage({ type: 'error', text: '이미지 파일만 업로드 가능합니다' });
        return;
      }

      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const img = new Image();
            img.onload = () => {
              const canvas = document.createElement('canvas');
              const size = 128; // 128x128로 리사이즈
              canvas.width = size;
              canvas.height = size;
              const ctx = canvas.getContext('2d')!;

              // 중앙 크롭
              const minDim = Math.min(img.width, img.height);
              const sx = (img.width - minDim) / 2;
              const sy = (img.height - minDim) / 2;
              ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);

              // 자동 압축: 용량이 50KB 이하가 될 때까지 품질 낮춤
              let quality = 0.9;
              let result = canvas.toDataURL('image/jpeg', quality);
              const maxSize = 50 * 1024; // 50KB 목표

              while (result.length > maxSize && quality > 0.1) {
                quality -= 0.1;
                result = canvas.toDataURL('image/jpeg', quality);
              }

              resolve(result);
            };
            img.onerror = reject;
            img.src = reader.result as string;
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        if (firebaseUser) {
          await updateUserProfile(firebaseUser.uid, { profileImage: base64 });
          setUserProfile(prev => prev ? { ...prev, profileImage: base64 } : null);
          setProfileMessage({ type: 'success', text: '프로필 사진이 변경되었습니다!' });
        }
      } catch (error) {
        setProfileMessage({ type: 'error', text: '이미지 업로드에 실패했습니다' });
      }
    };

    const handleRemoveImage = async () => {
      if (!firebaseUser) return;
      try {
        await updateUserProfile(firebaseUser.uid, { profileImage: '' });
        setUserProfile(prev => prev ? { ...prev, profileImage: '' } : null);
        setProfileMessage({ type: 'success', text: '프로필 사진이 삭제되었습니다' });
      } catch (error) {
        setProfileMessage({ type: 'error', text: '삭제에 실패했습니다' });
      }
    };

    return (
      <div className="space-y-3 animate-fade-in">
        {/* 헤더 */}
        <div className="text-center py-2">
          <h2 className="text-lg font-bold text-white">설정</h2>
          <p className="text-xs text-slate-500">{firebaseUser?.email}</p>
        </div>

        {profileMessage && (
          <div className={`p-2.5 rounded-xl text-xs ${profileMessage.type === 'success' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
            {profileMessage.text}
          </div>
        )}

        {/* 프로필 사진 - 컴팩트 */}
        <div className="glass-panel p-3 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 rounded-full bg-slate-700 border-2 border-slate-600 overflow-hidden flex items-center justify-center flex-shrink-0">
              {userProfile?.profileImage ? (
                <img src={userProfile.profileImage} alt="프로필" className="w-full h-full object-cover" />
              ) : (
                <UserIcon size={28} className="text-slate-500" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <Camera size={14} className="text-slate-400" />
                <span className="text-xs font-bold text-white">프로필 사진</span>
              </div>
              <div className="flex gap-2">
                <label className="flex-1">
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  <span className="block bg-blue-600 active:bg-blue-700 text-white py-1.5 px-3 rounded-lg text-xs font-bold text-center cursor-pointer active:scale-95 transition-all">
                    선택
                  </span>
                </label>
                {userProfile?.profileImage && (
                  <button
                    onClick={handleRemoveImage}
                    className="flex-1 bg-slate-700 active:bg-slate-600 text-slate-300 py-1.5 px-3 rounded-lg text-xs active:scale-95 transition-all"
                  >
                    삭제
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 이름 변경 - 컴팩트 */}
        <div className="glass-panel p-3 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserIcon size={14} className="text-slate-400" />
              <span className="text-xs font-bold text-white">이름 변경</span>
            </div>
            <span className="text-yellow-400 text-xs font-bold">{stats.username}</span>
          </div>
          {!canChangeName && (
            <div className="bg-slate-800/50 rounded-lg px-2.5 py-1.5 text-xs text-slate-400 flex items-center gap-1.5">
              <Lock size={12} />
              <span>{daysRemaining}일 후 변경 가능</span>
            </div>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder="새 이름 (2~10자)"
              maxLength={10}
              disabled={!canChangeName}
              className="flex-1 bg-slate-800/80 border border-slate-700 rounded-lg py-2 px-3 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500/50 disabled:opacity-50"
            />
            <button
              onClick={handleUsernameChange}
              disabled={!canChangeName}
              className="bg-blue-600 active:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-500 text-white py-2 px-4 rounded-lg font-bold text-xs active:scale-95 transition-all"
            >
              변경
            </button>
          </div>
          <p className="text-[10px] text-slate-500">이름 변경은 30일에 1회 가능합니다</p>
        </div>

        {/* 비밀번호 변경 - 컴팩트 */}
        <div className="glass-panel p-3 rounded-xl space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <Lock size={14} className="text-slate-400" />
            <span className="text-xs font-bold text-white">비밀번호 변경</span>
          </div>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="새 비밀번호 (6자 이상)"
            className="w-full bg-slate-800/80 border border-slate-700 rounded-lg py-2 px-3 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500/50"
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="비밀번호 확인"
            className="w-full bg-slate-800/80 border border-slate-700 rounded-lg py-2 px-3 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500/50"
          />
          <button
            onClick={handlePasswordChange}
            className="w-full bg-violet-600 active:bg-violet-700 text-white py-2 rounded-lg font-bold text-xs active:scale-95 transition-all"
          >
            비밀번호 변경
          </button>
        </div>

        {/* 관리자 패널 */}
        {isAdmin && (
          <div className="glass-panel p-3 rounded-xl space-y-2 border-2 border-red-500/30">
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck size={14} className="text-red-400" />
              <span className="text-xs font-bold text-red-400">관리자 도구</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={async () => {
                  if (confirm('모든 채팅 메시지를 삭제하시겠습니까?')) {
                    try {
                      const count = await clearAllChatMessages();
                      setProfileMessage({ type: 'success', text: `채팅 ${count}개 삭제 완료` });
                    } catch (error) {
                      setProfileMessage({ type: 'error', text: '채팅 삭제 실패' });
                    }
                  }
                }}
                className="bg-orange-600 active:bg-orange-700 text-white py-2 px-3 rounded-lg text-xs font-bold active:scale-95 transition-all"
              >
                채팅 초기화
              </button>
              <button
                onClick={async () => {
                  if (confirm('관리자를 제외한 모든 유저/게임 데이터를 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다!')) {
                    if (confirm('정말 삭제하시겠습니까? 마지막 확인입니다.')) {
                      try {
                        const result = await clearAllDataExceptAdmin(firebaseUser?.uid || '');
                        setProfileMessage({ type: 'success', text: `유저 ${result.users}명, 게임 ${result.gameData}개 삭제 완료` });
                        // 상대 목록 새로고침
                        loadOpponents();
                      } catch (error) {
                        setProfileMessage({ type: 'error', text: '데이터 삭제 실패' });
                      }
                    }
                  }
                }}
                className="bg-red-600 active:bg-red-700 text-white py-2 px-3 rounded-lg text-xs font-bold active:scale-95 transition-all"
              >
                유저 초기화
              </button>
            </div>
            <p className="text-[10px] text-red-400/70">유저 초기화는 관리자 계정을 제외한 모든 데이터를 삭제합니다</p>
          </div>
        )}

        {/* 로그아웃 */}
        <button
          onClick={handleLogout}
          className="w-full bg-slate-800/50 active:bg-slate-700 text-slate-400 py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 active:scale-95 transition-all border border-slate-700/50"
        >
          <LogOut size={14} />
          로그아웃
        </button>
      </div>
    );
  };

  // Chat Message Component
  const ChatMessageItem: React.FC<{ message: GlobalChatMessage; isOwnMessage: boolean; profileImage?: string }> = ({ message, isOwnMessage, profileImage }) => {
    const isSystem = message.type === 'system';
    const isChat = message.type === 'chat';
    const isEnhancement = message.type === 'enhancement';
    const isBattle = message.type === 'battle';
    const isShowOff = message.type === 'showoff';
    const isWhisper = message.type === 'whisper';

    // 멘션 하이라이트 처리
    const isMentioned = message.content?.includes(`@${stats.username}`);

    // 메시지 내용에서 @멘션을 하이라이트하는 함수
    const renderContent = (content: string) => {
      const mentionRegex = /@(\S+)/g;
      const parts = content.split(mentionRegex);

      return parts.map((part, idx) => {
        // 홀수 인덱스는 멘션된 유저이름
        if (idx % 2 === 1) {
          const isMeMentioned = part === stats.username;
          return (
            <span
              key={idx}
              className={`font-bold ${isMeMentioned ? 'text-yellow-300 bg-yellow-500/20 px-1 rounded' : 'text-blue-400'}`}
            >
              @{part}
            </span>
          );
        }
        return part;
      });
    };

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

    // 귓속말 메시지
    if (isWhisper) {
      const isFromMe = isOwnMessage;
      return (
        <div className={`flex ${isFromMe ? 'justify-end' : 'justify-start'} mb-3`}>
          <div className={`flex gap-2 max-w-[80%] ${isFromMe ? 'flex-row-reverse' : ''}`}>
            {/* 프로필 이미지 */}
            {profileImage ? (
              <img src={profileImage} alt="" className="w-8 h-8 rounded-full object-cover shrink-0 border-2 border-pink-500/50" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-600 to-purple-600 flex items-center justify-center shrink-0 text-white font-bold text-xs">
                {(message.username || '?')[0]?.toUpperCase()}
              </div>
            )}
            <div className={`${isFromMe ? 'rounded-2xl rounded-br-md' : 'rounded-2xl rounded-bl-md'} px-4 py-3 text-sm shadow-lg bg-gradient-to-br from-pink-900/80 to-purple-900/80 border border-pink-500/30`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-pink-300 text-[10px]">🤫 귓속말</span>
                <span className="text-xs text-pink-200">
                  {isFromMe ? `→ ${message.whisperTo}` : `← ${message.username}`}
                </span>
              </div>
              <div className="whitespace-pre-wrap text-pink-100">{message.content}</div>
            </div>
          </div>
        </div>
      );
    }

    if (isChat && isOwnMessage) {
      return (
        <div className="flex justify-end mb-3">
          <div className="flex gap-2 max-w-[80%] flex-row-reverse">
            {/* 프로필 이미지 */}
            {profileImage ? (
              <img src={profileImage} alt="" className="w-8 h-8 rounded-full object-cover shrink-0 border-2 border-blue-500/50" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shrink-0 text-white font-bold text-xs">
                {(message.username || '?')[0]?.toUpperCase()}
              </div>
            )}
            <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl rounded-br-md px-4 py-3 text-sm text-white shadow-lg">
              <div className="text-xs text-blue-200 mb-1">{message.username}</div>
              <div className="whitespace-pre-wrap">{renderContent(message.content)}</div>
            </div>
          </div>
        </div>
      );
    }

    // Enhancement, Battle, ShowOff, or other user's chat messages
    const isMaintain = isEnhancement && message.metadata?.success === undefined;

    // 아이콘 표시 여부 (강화/전투/자랑은 아이콘 사용)
    const showIcon = isEnhancement || isBattle || isShowOff;

    return (
      <div className={`flex justify-start mb-3 ${isMentioned ? 'animate-pulse' : ''}`}>
        <div className="flex gap-2 max-w-[85%]">
          {showIcon ? (
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white font-bold text-xs ${isEnhancement ? (message.metadata?.success ? 'bg-green-600' : isMaintain ? 'bg-blue-600' : 'bg-red-600') :
              isBattle ? (message.metadata?.success ? 'bg-yellow-600' : 'bg-slate-600') :
                'bg-gradient-to-br from-yellow-500 to-orange-500'
              }`}>
              {isEnhancement ? <Hammer size={16} className="text-white" /> :
                isBattle ? <Swords size={16} className="text-white" /> :
                  <Trophy size={16} className="text-white" />}
            </div>
          ) : profileImage ? (
            <img src={profileImage} alt="" className="w-8 h-8 rounded-full object-cover shrink-0 border-2 border-purple-500/50" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center shrink-0 text-white font-bold text-xs">
              {(message.username || '?')[0]?.toUpperCase()}
            </div>
          )}
          <div className={`rounded-2xl rounded-bl-md px-4 py-3 text-sm shadow-lg ${
            isMentioned ? 'ring-2 ring-yellow-400/50 ' : ''
          }${isEnhancement ? (
            message.metadata?.success ? 'bg-green-950 border border-green-500/30 text-green-100' :
              isMaintain ? 'bg-blue-950 border border-blue-500/30 text-blue-100' :
                'bg-red-950 border border-red-500/30 text-red-100'
          ) :
            isBattle ? (message.metadata?.success ? 'bg-yellow-950 border border-yellow-500/30 text-yellow-100' : 'bg-slate-900 border border-slate-600/30 text-slate-200') :
              isShowOff ? 'bg-gradient-to-br from-yellow-950 to-orange-950 border border-yellow-500/30 text-yellow-100' :
                'bg-slate-900 border border-slate-700/50 text-slate-200'
            }`}>
            <div className="text-xs text-slate-400 mb-1 font-bold">{message.username}</div>
            <div className="whitespace-pre-wrap">{renderContent(message.content)}</div>
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
                  {globalMessages
                    .filter((msg) => {
                      // 귓속말은 보낸 사람과 받는 사람만 볼 수 있음
                      if (msg.type === 'whisper') {
                        return msg.uid === firebaseUser?.uid || msg.whisperTo === stats.username;
                      }
                      return true;
                    })
                    .map((msg) => (
                    <ChatMessageItem
                      key={msg.id}
                      message={msg}
                      isOwnMessage={msg.uid === firebaseUser?.uid}
                      profileImage={msg.uid ? userProfilesMap[msg.uid]?.profileImage : undefined}
                    />
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
          {view === GameView.PROFILE && (
            <div className="px-4 py-4">
              {renderProfile()}
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
          <ChatInput onSubmit={handleChatSubmit} userList={allUsernames} currentUsername={stats.username} />
        </div>

        {/* Navigation Bar */}
        <nav className="flex justify-around items-center h-16 px-2 border-t border-white/10 bg-slate-900/95 pb-safe">
          {[
            { id: GameView.HOME, icon: UserIcon, label: '정보' },
            { id: GameView.SHOP, icon: ShoppingBag, label: '상점' },
            { id: GameView.ENHANCE, icon: Hammer, label: '강화' },
            { id: GameView.ELEMENT, icon: Sparkles, label: '속성' },
            { id: GameView.BATTLE, icon: Sword, label: '전투' },
            { id: GameView.PROFILE, icon: Lock, label: '설정' },
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

      {/* 관리자 골드 선물 모달 (공개) */}
      {showGiftModal && isAdmin && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowGiftModal(null)}>
          <div className="w-full max-w-sm animate-fade-in glass-panel p-5 rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center">
                <Gift size={24} className="text-yellow-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">골드 선물</h3>
                <p className="text-sm text-slate-400">{showGiftModal.profile.username}에게 선물</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">선물할 골드</label>
                <input
                  type="number"
                  value={giftGoldAmount}
                  onChange={(e) => setGiftGoldAmount(e.target.value)}
                  placeholder="골드 수량 입력"
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-xl py-3 px-4 text-white placeholder:text-slate-500 focus:outline-none focus:border-yellow-500/50"
                />
              </div>

              {/* 빠른 선택 버튼 */}
              <div className="grid grid-cols-4 gap-2">
                {[100000, 500000, 1000000, 5000000].map((amount) => (
                  <button
                    key={amount}
                    onClick={() => setGiftGoldAmount(amount.toString())}
                    className="py-2 bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 rounded-lg text-xs font-bold active:scale-95 transition-all"
                  >
                    {amount >= 1000000 ? `${amount / 1000000}M` : `${amount / 1000}K`}
                  </button>
                ))}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setShowGiftModal(null)}
                  className="flex-1 py-3 bg-slate-700 text-slate-300 rounded-xl font-bold text-sm active:scale-95 transition-all"
                >
                  취소
                </button>
                <button
                  onClick={async () => {
                    const amount = parseInt(giftGoldAmount);
                    if (!amount || amount <= 0) {
                      alert('올바른 골드 수량을 입력해주세요');
                      return;
                    }
                    const success = await giftGoldToUser(showGiftModal.profile.uid, amount);
                    if (success) {
                      // 글로벌 메시지로 알림
                      await sendGlobalMessage({
                        uid: firebaseUser!.uid,
                        username: stats.username,
                        type: 'system',
                        content: `🎁 ${showGiftModal.profile.username}님에게 ${amount.toLocaleString()}G가 선물되었습니다!`
                      });
                      alert(`${showGiftModal.profile.username}님에게 ${amount.toLocaleString()}G를 선물했습니다!`);
                      setShowGiftModal(null);
                      loadOpponents(); // 상대 목록 새로고침
                    } else {
                      alert('선물에 실패했습니다');
                    }
                  }}
                  className="flex-1 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-xl font-bold text-sm active:scale-95 transition-all shadow-lg"
                >
                  선물하기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 관리자 골드 선물 모달 (비밀) */}
      {showSecretGiftModal && isAdmin && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowSecretGiftModal(null)}>
          <div className="w-full max-w-sm animate-fade-in glass-panel p-5 rounded-2xl border-2 border-purple-500/30" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center">
                <EyeOff size={24} className="text-purple-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-purple-300">비밀 골드 선물</h3>
                <p className="text-sm text-slate-400">{showSecretGiftModal.profile.username}에게 선물</p>
              </div>
            </div>

            <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-2 mb-3">
              <p className="text-xs text-purple-300 flex items-center gap-1">
                <EyeOff size={12} />
                이 선물은 채팅에 공개되지 않습니다
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">선물할 골드</label>
                <input
                  type="number"
                  value={giftGoldAmount}
                  onChange={(e) => setGiftGoldAmount(e.target.value)}
                  placeholder="골드 수량 입력"
                  className="w-full bg-slate-800/80 border border-purple-500/30 rounded-xl py-3 px-4 text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500/50"
                />
              </div>

              {/* 빠른 선택 버튼 */}
              <div className="grid grid-cols-4 gap-2">
                {[100000, 500000, 1000000, 5000000].map((amount) => (
                  <button
                    key={amount}
                    onClick={() => setGiftGoldAmount(amount.toString())}
                    className="py-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 rounded-lg text-xs font-bold active:scale-95 transition-all border border-purple-500/20"
                  >
                    {amount >= 1000000 ? `${amount / 1000000}M` : `${amount / 1000}K`}
                  </button>
                ))}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setShowSecretGiftModal(null)}
                  className="flex-1 py-3 bg-slate-700 text-slate-300 rounded-xl font-bold text-sm active:scale-95 transition-all"
                >
                  취소
                </button>
                <button
                  onClick={async () => {
                    const amount = parseInt(giftGoldAmount);
                    if (!amount || amount <= 0) {
                      alert('올바른 골드 수량을 입력해주세요');
                      return;
                    }
                    const success = await giftGoldToUser(showSecretGiftModal.profile.uid, amount);
                    if (success) {
                      // 관리자에게만 귓속말로 알림 (비공개)
                      await sendGlobalMessage({
                        uid: firebaseUser!.uid,
                        username: '시스템',
                        type: 'whisper',
                        content: `🎁 ${showSecretGiftModal.profile.username}에게 ${amount.toLocaleString()}G를 비밀리에 선물했습니다.`,
                        whisperTo: stats.username
                      });
                      setShowSecretGiftModal(null);
                      loadOpponents(); // 상대 목록 새로고침
                    } else {
                      alert('선물에 실패했습니다');
                    }
                  }}
                  className="flex-1 py-3 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-xl font-bold text-sm active:scale-95 transition-all shadow-lg"
                >
                  비밀 선물
                </button>
              </div>
            </div>
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