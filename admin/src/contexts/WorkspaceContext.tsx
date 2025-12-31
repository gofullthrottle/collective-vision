import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

const WORKSPACE_KEY = 'cv_admin_workspace';
const BOARD_KEY = 'cv_admin_board';
const DEFAULT_WORKSPACE = 'demo-workspace';
const DEFAULT_BOARD = 'main';

interface WorkspaceContextType {
  workspace: string;
  board: string;
  setWorkspace: (workspace: string) => void;
  setBoard: (board: string) => void;
}

const WorkspaceContext = createContext<WorkspaceContextType | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspace, setWorkspaceState] = useState<string>(() => {
    return localStorage.getItem(WORKSPACE_KEY) || DEFAULT_WORKSPACE;
  });

  const [board, setBoardState] = useState<string>(() => {
    return localStorage.getItem(BOARD_KEY) || DEFAULT_BOARD;
  });

  const setWorkspace = (newWorkspace: string) => {
    localStorage.setItem(WORKSPACE_KEY, newWorkspace);
    setWorkspaceState(newWorkspace);
  };

  const setBoard = (newBoard: string) => {
    localStorage.setItem(BOARD_KEY, newBoard);
    setBoardState(newBoard);
  };

  // Sync from localStorage on mount (in case changed in another tab)
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === WORKSPACE_KEY && e.newValue) {
        setWorkspaceState(e.newValue);
      }
      if (e.key === BOARD_KEY && e.newValue) {
        setBoardState(e.newValue);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  return (
    <WorkspaceContext.Provider value={{ workspace, board, setWorkspace, setBoard }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}
