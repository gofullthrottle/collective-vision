export type FeedbackStatus = 'open' | 'planned' | 'in_progress' | 'done' | 'declined';
export type ModerationState = 'pending' | 'approved' | 'rejected';

export interface FeedbackItem {
  id: number;
  board_id: number;
  user_id: number;
  title: string;
  description: string;
  status: FeedbackStatus;
  moderation_state: ModerationState;
  is_hidden: number;
  source: string;
  vote_count: number;
  created_at: string;
  updated_at: string;
}

export interface FeedbackFilters {
  status?: FeedbackStatus[];
  moderation_state?: ModerationState[];
  search?: string;
}

export interface FeedbackListResponse {
  items: FeedbackItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface BulkActionPayload {
  ids: number[];
  action: 'approve' | 'reject' | 'set_status';
  status?: FeedbackStatus;
}
