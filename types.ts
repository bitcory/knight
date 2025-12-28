export enum WeaponType {
  SWORD = 'Sword',
  AXE = 'Axe',
  HAMMER = 'Hammer',
  SPEAR = 'Spear'
}

export enum ElementType {
  NONE = 'None',
  FIRE = 'Fire',
  WATER = 'Water',
  LIGHT = 'Light',
  DARK = 'Dark',
  CURSE = 'Curse'
}

export interface Weapon {
  id: string;
  type: WeaponType;
  name: string;
  level: number;
  baseDamage: number;
  description: string;
  totalEnhanceCost: number; // 총 강화 비용 추적
  element?: ElementType; // 속성
  elementLevel?: number; // 속성 강화 레벨 (0-10)
  // imageUrl removed - using procedural visuals
}

export interface PlayerStats {
  username: string;
  gold: number;
  scrolls: number;
  wins: number;
  losses: number;
}

export interface GameLog {
  id: string;
  type: 'enhancement' | 'battle' | 'shop';
  message: string;
  subtext?: string;
  timestamp: number;
  success?: boolean;
}

export enum GameView {
  LOGIN = 'LOGIN',
  HOME = 'HOME',
  ENHANCE = 'ENHANCE',
  ELEMENT = 'ELEMENT',
  BATTLE = 'BATTLE',
  SHOP = 'SHOP',
  PROFILE = 'PROFILE'
}

export const MAX_LEVEL = 20;

export interface EnhancementConfig {
  cost: number;
  successChance: number;    // 성공 확률
  maintainChance: number;   // 유지 확률
  destroyChance: number;    // 파괴 확률
}

export interface User {
  id: string;
  username: string;
  password: string;
}

export interface SavedGameData {
  stats: PlayerStats;
  weapon: Weapon;
  logs: GameLog[];
  chatMessages?: ChatMessage[];
}

export interface ChatMessage {
  id: string;
  type: 'system' | 'user' | 'bot' | 'enhancement' | 'battle';
  content: string;
  timestamp: number;
  metadata?: {
    success?: boolean;
    weapon?: Weapon;
    goldChange?: number;
    action?: string;
  };
}