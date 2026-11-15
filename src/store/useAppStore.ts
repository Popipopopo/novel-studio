import { create } from 'zustand';

export type TopView = 'write' | 'board' | 'settings';
export type WriteMode = 'edit' | 'read' | 'focus';
export type RightTab = 'outline' | 'comments' | 'revisions';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface AppState {
  activeProjectId: string | null;
  activeChapterId: string | null;
  topView: TopView;
  writeMode: WriteMode;
  rightTab: RightTab;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  theme: 'light' | 'dark';
  saveStatus: SaveStatus;
  searchQuery: string;
  activeCommentId: string | null;
  activeRevisionId: string | null;

  setActiveProject: (id: string | null) => void;
  setActiveChapter: (id: string | null) => void;
  setTopView: (v: TopView) => void;
  setWriteMode: (v: WriteMode) => void;
  setRightTab: (v: RightTab) => void;
  toggleLeft: () => void;
  toggleRight: () => void;
  toggleTheme: () => void;
  setSaveStatus: (v: SaveStatus) => void;
  setSearchQuery: (q: string) => void;
  setActiveCommentId: (id: string | null) => void;
  setActiveRevisionId: (id: string | null) => void;
}

const pref = <T>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem('ns.' + key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};
const persist = (key: string, value: unknown) => {
  try {
    localStorage.setItem('ns.' + key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
};

export const useAppStore = create<AppState>((set, get) => ({
  activeProjectId: pref<string | null>('activeProjectId', null),
  activeChapterId: pref<string | null>('activeChapterId', null),
  topView: pref<TopView>('topView', 'write'),
  writeMode: pref<WriteMode>('writeMode', 'edit'),
  rightTab: 'outline',
  leftCollapsed: pref<boolean>('leftCollapsed', false),
  rightCollapsed: pref<boolean>('rightCollapsed', false),
  theme: pref<'light' | 'dark'>('theme', 'light'),
  saveStatus: 'idle',
  searchQuery: '',
  activeCommentId: null,
  activeRevisionId: null,

  setActiveProject: (id) => {
    persist('activeProjectId', id);
    set({ activeProjectId: id, activeChapterId: null });
  },
  setActiveChapter: (id) => {
    persist('activeChapterId', id);
    set({ activeChapterId: id, activeCommentId: null, activeRevisionId: null });
  },
  setTopView: (v) => {
    persist('topView', v);
    set({ topView: v });
  },
  setWriteMode: (v) => {
    persist('writeMode', v);
    set({ writeMode: v });
  },
  setRightTab: (v) => set({ rightTab: v }),
  toggleLeft: () => {
    const v = !get().leftCollapsed;
    persist('leftCollapsed', v);
    set({ leftCollapsed: v });
  },
  toggleRight: () => {
    const v = !get().rightCollapsed;
    persist('rightCollapsed', v);
    set({ rightCollapsed: v });
  },
  toggleTheme: () => {
    const v = get().theme === 'light' ? 'dark' : 'light';
    persist('theme', v);
    document.documentElement.classList.toggle('dark', v === 'dark');
    set({ theme: v });
  },
  setSaveStatus: (v) => set({ saveStatus: v }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setActiveCommentId: (id) => set({ activeCommentId: id }),
  setActiveRevisionId: (id) => set({ activeRevisionId: id }),
}));

// Apply persisted theme on load.
if (typeof document !== 'undefined') {
  const t = pref<'light' | 'dark'>('theme', 'light');
  document.documentElement.classList.toggle('dark', t === 'dark');
}
