export type ThemeId =
  | 'rose'
  | 'lavender'
  | 'matcha'
  | 'milktea'
  | 'sky'
  | 'berry'
  | 'rosegold'
  | 'starry'
  | 'dark'
  | 'light';

export interface ThemeMeta {
  id: ThemeId;
  name: string;
  subtitle: string;
  isDark: boolean;
  category: 'feminine' | 'classic';
  swatchBg: string;
  swatchSurface: string;
  swatchAccent: string;
  themeColorMeta: string;
}

export const IDE_THEMES: ThemeMeta[] = [
  {
    id: 'rose',
    name: '櫻花蜜桃',
    subtitle: '柔粉日間少女感',
    isDark: false,
    category: 'feminine',
    swatchBg: '#FFF7F9',
    swatchSurface: '#FFE4EC',
    swatchAccent: '#DB2777',
    themeColorMeta: '#FFF7F9',
  },
  {
    id: 'lavender',
    name: '薰衣草霧紫',
    subtitle: '莫蘭迪粉紫氣質',
    isDark: false,
    category: 'feminine',
    swatchBg: '#F7F5FF',
    swatchSurface: '#EDE9FE',
    swatchAccent: '#7C3AED',
    themeColorMeta: '#F7F5FF',
  },
  {
    id: 'milktea',
    name: '焦糖厚奶茶',
    subtitle: '溫柔暖杏咖啡廳風',
    isDark: false,
    category: 'feminine',
    swatchBg: '#FBF7F2',
    swatchSurface: '#F3E8DC',
    swatchAccent: '#C26A3A',
    themeColorMeta: '#FBF7F2',
  },
  {
    id: 'matcha',
    name: '抹茶生乳捲',
    subtitle: '清新森系淡雅綠',
    isDark: false,
    category: 'feminine',
    swatchBg: '#F5FAF6',
    swatchSurface: '#E3F2E7',
    swatchAccent: '#15803D',
    themeColorMeta: '#F5FAF6',
  },
  {
    id: 'sky',
    name: '海鹽蘇打糖',
    subtitle: '澄澈晴空馬卡龍藍',
    isDark: false,
    category: 'feminine',
    swatchBg: '#F3F9FF',
    swatchSurface: '#E0F0FF',
    swatchAccent: '#0284C7',
    themeColorMeta: '#F3F9FF',
  },
  {
    id: 'berry',
    name: '絲絨莓果夜',
    subtitle: '微甜深紫夜讀模式',
    isDark: true,
    category: 'feminine',
    swatchBg: '#170E19',
    swatchSurface: '#241628',
    swatchAccent: '#EC4899',
    themeColorMeta: '#170E19',
  },
  {
    id: 'rosegold',
    name: '黑曜玫瑰金',
    subtitle: '輕奢深色金屬粉金',
    isDark: true,
    category: 'feminine',
    swatchBg: '#151013',
    swatchSurface: '#241B20',
    swatchAccent: '#E28C97',
    themeColorMeta: '#151013',
  },
  {
    id: 'starry',
    name: '星夜紫羅蘭',
    subtitle: '夢幻深藍星辰夜景',
    isDark: true,
    category: 'feminine',
    swatchBg: '#101024',
    swatchSurface: '#1A1B38',
    swatchAccent: '#A78BFA',
    themeColorMeta: '#101024',
  },
  {
    id: 'dark',
    name: '極夜深灰',
    subtitle: '經典開發者深色',
    isDark: true,
    category: 'classic',
    swatchBg: '#0B0F17',
    swatchSurface: '#121826',
    swatchAccent: '#10B981',
    themeColorMeta: '#0B0F17',
  },
  {
    id: 'light',
    name: '晨光純白',
    subtitle: '高對比清爽日間',
    isDark: false,
    category: 'classic',
    swatchBg: '#F8FAFC',
    swatchSurface: '#FFFFFF',
    swatchAccent: '#059669',
    themeColorMeta: '#F8FAFC',
  },
];

export function getThemeMeta(id: ThemeId): ThemeMeta {
  return IDE_THEMES.find((t) => t.id === id) ?? IDE_THEMES[0];
}
