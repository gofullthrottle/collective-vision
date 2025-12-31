// Workspace configuration utilities

const WORKSPACE_KEY = 'cv_admin_workspace';
const BOARD_KEY = 'cv_admin_board';

export function getWorkspace(): string {
  return localStorage.getItem(WORKSPACE_KEY) || 'default';
}

export function setWorkspace(workspace: string): void {
  localStorage.setItem(WORKSPACE_KEY, workspace);
}

export function getBoard(): string {
  return localStorage.getItem(BOARD_KEY) || 'main';
}

export function setBoard(board: string): void {
  localStorage.setItem(BOARD_KEY, board);
}
