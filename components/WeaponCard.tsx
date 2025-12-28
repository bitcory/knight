import React from 'react';
import { Weapon, WeaponType, ElementType } from '../types';
import { Sword, Axe, Hammer, Zap, Flame, Droplets, Sun, Moon, Ghost } from 'lucide-react';

// --- Procedural Visual System ---

const getVisualTier = (level: number) => {
  if (level >= 20) return 'mythic';
  if (level >= 15) return 'legendary';
  if (level >= 10) return 'epic';
  if (level >= 5) return 'rare';
  return 'common';
};

const TIER_NAMES_KR: Record<string, string> = {
  common: '일반',
  rare: '희귀',
  epic: '영웅',
  legendary: '전설',
  mythic: '신화'
};

const WEAPON_TYPE_NAMES_KR: Record<string, string> = {
  'Sword': '검',
  'Axe': '도끼',
  'Hammer': '망치',
  'Spear': '창'
};

// 무기 이미지 경로 생성
const getWeaponImagePath = (type: WeaponType, tier: string): string => {
  const typeKey = type.toLowerCase();
  return `/weapons/${typeKey}_${tier}.png`;
};

const TIER_STYLES = {
  common: {
    wrapper: 'border-slate-700 bg-slate-900/80',
    bgGradient: 'from-slate-800 to-slate-900',
    iconColor: 'text-slate-400',
    accentColor: 'text-slate-500',
    glow: '',
    particles: 'bg-slate-500',
    badge: 'bg-slate-800 text-slate-300'
  },
  rare: {
    wrapper: 'border-blue-500/50 bg-slate-900/80 shadow-[0_0_20px_-5px_rgba(59,130,246,0.3)]',
    bgGradient: 'from-blue-900/40 via-slate-900 to-slate-900',
    iconColor: 'text-blue-400',
    accentColor: 'text-blue-500',
    glow: 'shadow-blue-500/20',
    particles: 'bg-blue-400',
    badge: 'bg-blue-900/80 text-blue-200 border-blue-500/30'
  },
  epic: {
    wrapper: 'border-purple-500/60 bg-slate-900/80 shadow-[0_0_30px_-5px_rgba(168,85,247,0.4)]',
    bgGradient: 'from-purple-900/40 via-slate-900 to-slate-900',
    iconColor: 'text-purple-300',
    accentColor: 'text-purple-400',
    glow: 'shadow-purple-500/30',
    particles: 'bg-purple-300',
    badge: 'bg-purple-900/80 text-purple-200 border-purple-500/30'
  },
  legendary: {
    wrapper: 'border-yellow-500/70 bg-slate-900/80 shadow-[0_0_40px_-5px_rgba(234,179,8,0.5)]',
    bgGradient: 'from-yellow-900/40 via-slate-900 to-amber-950/20',
    iconColor: 'text-yellow-300',
    accentColor: 'text-yellow-400',
    glow: 'shadow-yellow-500/40',
    particles: 'bg-yellow-300',
    badge: 'bg-yellow-900/80 text-yellow-100 border-yellow-500/50'
  },
  mythic: {
    wrapper: 'border-red-600/80 bg-slate-900/80 shadow-[0_0_50px_-10px_rgba(220,38,38,0.6)] animate-pulse',
    bgGradient: 'from-red-900/50 via-slate-900 to-red-950/30',
    iconColor: 'text-red-400',
    accentColor: 'text-red-500',
    glow: 'shadow-red-600/50',
    particles: 'bg-red-500',
    badge: 'bg-red-900 text-white border-red-500'
  }
};

const WeaponIcon: React.FC<{ type: WeaponType, className?: string, style?: React.CSSProperties }> = ({ type, className, style }) => {
  switch (type) {
    case WeaponType.SWORD: return <Sword className={className} style={style} />;
    case WeaponType.AXE: return <Axe className={className} style={style} />;
    case WeaponType.HAMMER: return <Hammer className={className} style={style} />;
    case WeaponType.SPEAR: return <Zap className={`${className} rotate-45`} style={style} />;
    default: return <Sword className={className} style={style} />;
  }
};

// 속성별 스타일 및 애니메이션
const ELEMENT_STYLES: Record<ElementType, {
  color: string;
  glowColor: string;
  particleColor: string;
  bgGradient: string;
  borderColor: string;
}> = {
  [ElementType.NONE]: {
    color: 'text-slate-400',
    glowColor: 'rgba(148, 163, 184, 0.5)',
    particleColor: 'bg-slate-400',
    bgGradient: 'from-slate-500/0 to-slate-500/0',
    borderColor: 'border-slate-500/0'
  },
  [ElementType.FIRE]: {
    color: 'text-orange-400',
    glowColor: 'rgba(251, 146, 60, 0.8)',
    particleColor: 'bg-orange-400',
    bgGradient: 'from-orange-600/30 via-red-600/20 to-yellow-500/30',
    borderColor: 'border-orange-500/50'
  },
  [ElementType.WATER]: {
    color: 'text-blue-400',
    glowColor: 'rgba(96, 165, 250, 0.8)',
    particleColor: 'bg-blue-400',
    bgGradient: 'from-blue-600/30 via-cyan-500/20 to-blue-400/30',
    borderColor: 'border-blue-500/50'
  },
  [ElementType.LIGHT]: {
    color: 'text-yellow-300',
    glowColor: 'rgba(253, 224, 71, 0.9)',
    particleColor: 'bg-yellow-300',
    bgGradient: 'from-yellow-400/30 via-amber-300/20 to-white/30',
    borderColor: 'border-yellow-400/50'
  },
  [ElementType.DARK]: {
    color: 'text-purple-400',
    glowColor: 'rgba(167, 139, 250, 0.8)',
    particleColor: 'bg-purple-400',
    bgGradient: 'from-purple-600/30 via-indigo-600/20 to-violet-500/30',
    borderColor: 'border-purple-500/50'
  },
  [ElementType.CURSE]: {
    color: 'text-green-400',
    glowColor: 'rgba(74, 222, 128, 0.8)',
    particleColor: 'bg-green-400',
    bgGradient: 'from-green-600/30 via-emerald-500/20 to-lime-500/30',
    borderColor: 'border-green-500/50'
  }
};

// 속성 아이콘
const ElementIcon: React.FC<{ element: ElementType; size?: number; className?: string }> = ({ element, size = 16, className = '' }) => {
  switch (element) {
    case ElementType.FIRE: return <Flame size={size} className={className} />;
    case ElementType.WATER: return <Droplets size={size} className={className} />;
    case ElementType.LIGHT: return <Sun size={size} className={className} />;
    case ElementType.DARK: return <Moon size={size} className={className} />;
    case ElementType.CURSE: return <Ghost size={size} className={className} />;
    default: return null;
  }
};

// 무기 글로우 효과 (레벨에 따라 강도 증가)
const WeaponElementEffect: React.FC<{ element: ElementType; level: number; children: React.ReactNode }> = ({ element, level, children }) => {
  if (!element || element === ElementType.NONE || level === 0) {
    return <>{children}</>;
  }

  // 속성별 글로우 색상 (레벨에 따라 더 선명해짐)
  const getGlowColor = () => {
    const intensity = Math.min(0.4 + level * 0.06, 1); // 레벨에 따라 투명도 증가
    switch (element) {
      case ElementType.FIRE:
        return `rgba(255, 69, 0, ${intensity})`;
      case ElementType.WATER:
        return `rgba(30, 144, 255, ${intensity})`;
      case ElementType.LIGHT:
        return `rgba(255, 215, 0, ${intensity})`;
      case ElementType.DARK:
        return `rgba(138, 43, 226, ${intensity})`;
      case ElementType.CURSE:
        return `rgba(50, 205, 50, ${intensity})`;
      default:
        return 'transparent';
    }
  };

  const glowColor = getGlowColor();

  // 레벨에 따른 글로우 크기 (더 강해짐)
  const innerGlow = 4 + level * 2;
  const middleGlow = 8 + level * 3;
  const outerGlow = 12 + level * 4;

  return (
    <div
      className="relative"
      style={{
        filter: `
          drop-shadow(0 0 ${innerGlow}px ${glowColor})
          drop-shadow(0 0 ${middleGlow}px ${glowColor})
          drop-shadow(0 0 ${outerGlow}px ${glowColor})
        `,
      }}
    >
      {children}
    </div>
  );
};

// 속성 오라 효과
const ElementAura: React.FC<{ element: ElementType; level: number }> = ({ element, level }) => {
  if (!element || element === ElementType.NONE || level === 0) return null;

  const style = ELEMENT_STYLES[element];
  const intensity = Math.min(level / 10, 1); // 0 ~ 1

  return (
    <div
      className={`absolute inset-0 pointer-events-none z-5 rounded-3xl`}
      style={{
        boxShadow: `inset 0 0 ${30 + level * 5}px ${style.glowColor.replace('0.8', String(0.2 + intensity * 0.3))}`,
        animation: level >= 5 ? 'auraPulse 2s ease-in-out infinite' : undefined,
      }}
    >
      <style>{`
        @keyframes auraPulse {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

// Background Particle Effect Component
const Particles: React.FC<{ color: string, intensity: number }> = ({ color, intensity }) => {
  const particles = Array.from({ length: intensity * 4 + 3 }).map((_, i) => ({
    left: `${(i * 19) % 100}%`,
    top: `${(i * 29) % 100}%`,
    delay: `${(i * 0.3) % 4}s`,
    duration: `${3 + (i % 4)}s`,
    size: i % 2 === 0 ? 'w-1 h-1' : 'w-0.5 h-0.5'
  }));

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p, i) => (
        <div
          key={i}
          className={`absolute rounded-full ${color} opacity-60 animate-pulse`}
          style={{
            left: p.left,
            top: p.top,
            width: '3px',
            height: '3px',
            animation: `float ${p.duration} ease-in-out infinite`,
            animationDelay: p.delay,
          }}
        />
      ))}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) scale(1); opacity: 0.4; }
          50% { transform: translateY(-20px) scale(1.5); opacity: 0.8; }
        }
      `}</style>
    </div>
  );
};

interface WeaponCardProps {
  weapon: Weapon;
  showStats?: boolean;
  className?: string;
  isEnhancing?: boolean;
}

// Mini version for chat header
export const MiniWeaponCard: React.FC<{ weapon: Weapon; onClick?: () => void }> = ({ weapon, onClick }) => {
  const tier = getVisualTier(weapon.level);
  const style = TIER_STYLES[tier];
  const totalDamage = weapon.baseDamage + (weapon.level * 10) + Math.floor(Math.pow(weapon.level, 1.8));
  const imagePath = getWeaponImagePath(weapon.type, tier);
  const elementStyle = weapon.element ? ELEMENT_STYLES[weapon.element] : null;

  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 p-2 rounded-2xl border backdrop-blur-sm cursor-pointer active:scale-95 transition-all ${style.wrapper}`}
      style={weapon.element && weapon.element !== ElementType.NONE ? {
        boxShadow: `0 0 15px ${elementStyle?.glowColor.replace('0.8', '0.3')}`
      } : undefined}
    >
      <div className={`relative w-14 h-14 rounded-xl bg-gradient-to-br ${style.bgGradient} flex items-center justify-center overflow-hidden`}>
        {/* Mini element glow effect */}
        {weapon.element && weapon.element !== ElementType.NONE && weapon.elementLevel && weapon.elementLevel > 0 && (
          <div
            className="absolute inset-0 rounded-xl"
            style={{
              background: `radial-gradient(circle at center, ${elementStyle?.glowColor.replace('0.8', '0.3')} 0%, transparent 70%)`,
              animation: 'miniElementPulse 2s ease-in-out infinite'
            }}
          />
        )}
        <img
          src={imagePath}
          alt={weapon.name}
          className="w-full h-full object-contain p-1 relative z-10"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
            e.currentTarget.nextElementSibling?.classList.remove('hidden');
          }}
        />
        <WeaponIcon type={weapon.type} className={`w-7 h-7 ${style.iconColor} hidden`} style={{ filter: `drop-shadow(0 0 8px currentColor)` }} />
        <div className={`absolute top-0.5 right-0.5 px-1.5 py-0.5 rounded text-[8px] font-bold ${style.badge} z-20`}>
          +{weapon.level}
        </div>
        {/* Element indicator - 우측 상단 (레벨 아래) */}
        {weapon.element && weapon.element !== ElementType.NONE && (
          <div
            className="absolute top-5 right-0.5 px-1 py-0.5 rounded text-[8px] font-bold flex items-center gap-0.5 z-20"
            style={{ backgroundColor: elementStyle?.glowColor.replace('0.8', '0.6') }}
          >
            <ElementIcon element={weapon.element} size={8} className="text-white" />
            {weapon.elementLevel && weapon.elementLevel > 0 && (
              <span className="text-white font-mono">+{weapon.elementLevel}</span>
            )}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-bold truncate ${style.accentColor}`}>{weapon.name}</div>
        <div className="text-[10px] text-slate-500 flex items-center gap-1">
          <Sword size={10} />
          <span>{totalDamage.toLocaleString()}</span>
          <span className="mx-1">·</span>
          <span>{TIER_NAMES_KR[tier]}</span>
          {weapon.element && weapon.element !== ElementType.NONE && (
            <>
              <span className="mx-1">·</span>
              <span className={elementStyle?.color}>{ELEMENT_NAMES_KR[weapon.element]}{weapon.elementLevel ? `+${weapon.elementLevel}` : ''}</span>
            </>
          )}
        </div>
      </div>
      <style>{`
        @keyframes miniElementPulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 0.8; }
        }
      `}</style>
    </div>
  );
};

// 속성 이름 한글화 (MiniWeaponCard용 - 위에 있어야 함)
const ELEMENT_NAMES_KR: Record<ElementType, string> = {
  [ElementType.NONE]: '없음',
  [ElementType.FIRE]: '화염',
  [ElementType.WATER]: '물',
  [ElementType.LIGHT]: '빛',
  [ElementType.DARK]: '어둠',
  [ElementType.CURSE]: '저주'
};

// Chat message weapon card (for enhancement results)
export const ChatWeaponCard: React.FC<{ weapon: Weapon }> = ({ weapon }) => {
  const tier = getVisualTier(weapon.level);
  const style = TIER_STYLES[tier];
  const imagePath = getWeaponImagePath(weapon.type, tier);
  const elementStyle = weapon.element ? ELEMENT_STYLES[weapon.element] : null;
  const elementLevel = weapon.elementLevel || 0;

  return (
    <div
      className={`rounded-2xl border overflow-hidden ${style.wrapper} max-w-[280px] relative`}
      style={weapon.element && weapon.element !== ElementType.NONE ? {
        boxShadow: `0 0 20px ${elementStyle?.glowColor.replace('0.8', '0.4')}`
      } : undefined}
    >
      {/* Element Aura for chat card */}
      {weapon.element && weapon.element !== ElementType.NONE && elementLevel > 0 && (
        <div
          className="absolute inset-0 pointer-events-none z-0 rounded-2xl"
          style={{
            boxShadow: `inset 0 0 ${15 + elementLevel * 3}px ${elementStyle?.glowColor.replace('0.8', '0.2')}`
          }}
        />
      )}

      <div className={`relative h-32 bg-gradient-to-b ${style.bgGradient} flex items-center justify-center overflow-hidden`}>
        {/* Element gradient overlay */}
        {weapon.element && weapon.element !== ElementType.NONE && elementLevel > 0 && (
          <div className={`absolute inset-0 bg-gradient-to-br ${elementStyle?.bgGradient} opacity-40 z-0`} />
        )}

        {/* Weapon image with element effect */}
        <WeaponElementEffect element={weapon.element || ElementType.NONE} level={elementLevel}>
          <img
            src={imagePath}
            alt={weapon.name}
            className="h-28 object-contain relative z-10"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              (e.currentTarget.parentElement?.querySelector('.weapon-icon-fallback') as HTMLElement)?.classList.remove('hidden');
            }}
          />
          <WeaponIcon type={weapon.type} className={`w-16 h-16 ${style.iconColor} hidden relative z-10 weapon-icon-fallback`} style={{ filter: `drop-shadow(0 0 12px currentColor)` }} />
        </WeaponElementEffect>

        {/* Element Badge in chat card - 우측 상단 */}
        {weapon.element && weapon.element !== ElementType.NONE && (
          <div
            className={`absolute top-2 right-2 px-1.5 py-0.5 rounded-full text-[10px] font-bold shadow-lg z-20 flex items-center gap-1 border ${elementStyle?.borderColor}`}
            style={{
              backgroundColor: elementStyle?.glowColor.replace('0.8', '0.4'),
            }}
          >
            <ElementIcon element={weapon.element} size={10} className={elementStyle?.color} />
            {elementLevel > 0 && (
              <span className={`${elementStyle?.color} font-mono`}>+{elementLevel}</span>
            )}
          </div>
        )}
      </div>
      <div className="p-3 relative z-10">
        <div className={`text-sm font-bold ${style.accentColor}`}>[+{weapon.level}] {weapon.name}</div>
        <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{weapon.description}</p>
      </div>
    </div>
  );
};

export const WeaponCard: React.FC<WeaponCardProps> = ({ weapon, showStats = true, className = '', isEnhancing = false }) => {
  const tier = getVisualTier(weapon.level);
  const style = TIER_STYLES[tier];
  const imagePath = getWeaponImagePath(weapon.type, tier);
  const elementStyle = weapon.element ? ELEMENT_STYLES[weapon.element] : null;
  const elementLevel = weapon.elementLevel || 0;

  const totalDamage = weapon.baseDamage + (weapon.level * 10) + Math.floor(Math.pow(weapon.level, 1.8));
  const intensity = tier === 'mythic' ? 5 : tier === 'legendary' ? 4 : tier === 'epic' ? 3 : tier === 'rare' ? 2 : 1;

  return (
    <div className={`relative rounded-3xl overflow-hidden border backdrop-blur-sm transition-all duration-500 ${style.wrapper} ${weapon.element && weapon.element !== ElementType.NONE ? elementStyle?.borderColor : ''} ${className}`}>

      {/* Element Aura Effect */}
      {weapon.element && weapon.element !== ElementType.NONE && (
        <ElementAura element={weapon.element} level={elementLevel} />
      )}

      {/* Card Header / Visuals */}
      <div className={`relative h-44 sm:h-52 w-full bg-gradient-to-b ${style.bgGradient} flex items-center justify-center overflow-hidden`}>

        {/* Element Background Gradient Overlay */}
        {weapon.element && weapon.element !== ElementType.NONE && elementLevel > 0 && (
          <div className={`absolute inset-0 bg-gradient-to-br ${elementStyle?.bgGradient} opacity-${Math.min(30 + elementLevel * 5, 60)} z-0`} />
        )}

        {/* Decorative Grid */}
        <div className="absolute inset-0 opacity-[0.07]"
             style={{
               backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
               backgroundSize: '30px 30px'
             }}>
        </div>

        {/* Glow Center */}
        <div className={`absolute w-28 h-28 rounded-full blur-[50px] opacity-40 ${style.particles.replace('bg-', 'bg-')}`}></div>

        {/* Element Glow (additional glow when element is present) */}
        {weapon.element && weapon.element !== ElementType.NONE && elementLevel > 0 && (
          <div
            className="absolute w-32 h-32 rounded-full blur-[60px] z-5"
            style={{
              backgroundColor: elementStyle?.glowColor,
              opacity: 0.3 + (elementLevel * 0.05)
            }}
          />
        )}

        {/* Particles */}
        <Particles color={style.particles} intensity={intensity} />

        {/* Main Weapon Image with Element Effect */}
        <div className={`relative z-10 transition-transform duration-500 ${isEnhancing ? 'scale-110 animate-bounce' : 'active:scale-95'}`}>
          <WeaponElementEffect element={weapon.element || ElementType.NONE} level={elementLevel}>
            <img
              src={imagePath}
              alt={weapon.name}
              className="h-36 sm:h-44 object-contain drop-shadow-2xl"
              style={{ filter: `drop-shadow(0 0 15px ${style.iconColor.includes('yellow') ? '#facc15' : style.iconColor.includes('purple') ? '#a855f7' : style.iconColor.includes('blue') ? '#3b82f6' : style.iconColor.includes('red') ? '#ef4444' : '#94a3b8'})` }}
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                (e.currentTarget.parentElement?.querySelector('.weapon-icon-fallback') as HTMLElement)?.classList.remove('hidden');
              }}
            />
            <WeaponIcon
              type={weapon.type}
              className={`w-24 h-24 sm:w-32 sm:h-32 ${style.iconColor} drop-shadow-2xl hidden weapon-icon-fallback`}
              style={{ filter: `drop-shadow(0 0 15px currentColor)` }}
            />
          </WeaponElementEffect>
        </div>

        {/* Level Badge */}
        <div className={`absolute top-4 right-4 px-4 py-1.5 rounded-full border text-base font-bold shadow-lg backdrop-blur-md z-20 ${style.badge}`}>
          +{weapon.level}
        </div>

        {/* Tier Badge */}
        <div className={`absolute top-4 left-4 px-3 py-1 rounded-full text-[10px] tracking-widest font-bold shadow-lg backdrop-blur-md z-20 ${style.badge}`}>
          {TIER_NAMES_KR[tier]}
        </div>

        {/* Element Badge - 우측 상단 (레벨 배지 아래) */}
        {weapon.element && weapon.element !== ElementType.NONE && (
          <div
            className={`absolute top-14 right-4 px-2.5 py-1 rounded-full text-xs font-bold shadow-lg backdrop-blur-md z-20 flex items-center gap-1 border ${elementStyle?.borderColor}`}
            style={{
              backgroundColor: elementStyle?.glowColor.replace('0.8', '0.3'),
              boxShadow: `0 0 12px ${elementStyle?.glowColor}`
            }}
          >
            <ElementIcon element={weapon.element} size={12} className={elementStyle?.color} />
            {elementLevel > 0 && (
              <span className={`${elementStyle?.color} font-mono`}>+{elementLevel}</span>
            )}
          </div>
        )}
      </div>

      {/* Card Body */}
      <div className="p-4 sm:p-5 relative z-20">
        <div className="flex justify-between items-center mb-2">
          <h3 className={`text-xl sm:text-2xl font-bold tracking-tight truncate flex-1 mr-2 ${style.accentColor}`}>
            {weapon.name}
          </h3>
          <div className="text-[10px] tracking-wider text-slate-500 font-semibold border border-slate-700 px-2 py-1 rounded shrink-0">
            {WEAPON_TYPE_NAMES_KR[weapon.type] || weapon.type}
          </div>
        </div>

        <p className="text-slate-400 text-xs sm:text-sm italic mb-4 leading-relaxed line-clamp-2 opacity-80">
          "{weapon.description}"
        </p>

        {showStats && (
          <div className="bg-slate-950/50 rounded-xl p-3 sm:p-4 border border-slate-700/50 flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-400 text-xs sm:text-sm">
              <Sword size={18} />
              <span>공격력</span>
            </div>
            <div className="text-xl sm:text-2xl font-bold text-slate-200 font-mono">
              {totalDamage.toLocaleString()}
            </div>
          </div>
        )}
      </div>

      {/* Decorative Border Line at Bottom */}
      <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${style.bgGradient} opacity-50`}></div>
    </div>
  );
};