/**
 * API Response Types for Collective Vision Admin UI
 */

export interface DashboardStats {
  totalFeedback: number;
  pendingModeration: number;
  approvedToday: number;
  topVotedId: number | null;
  topVotedTitle: string | null;
  topVotedVotes: number;
}

export interface FeedbackItem {
  id: number;
  board_id: number;
  author_id: number | null;
  title: string;
  description: string | null;
  status: 'open' | 'under_review' | 'planned' | 'in_progress' | 'done' | 'declined';
  source: string | null;
  moderation_state: 'pending' | 'approved' | 'rejected';
  is_hidden: number;
  created_at: string;
  updated_at: string;
  vote_count?: number;
  author_name?: string | null;
  board_name?: string;
}

export interface Workspace {
  id: number;
  slug: string;
  name: string;
  created_at: string;
}

export interface Board {
  id: number;
  workspace_id: number;
  slug: string;
  name: string;
  is_public: number;
  created_at: string;
}

export interface ApiError {
  error: string;
}
