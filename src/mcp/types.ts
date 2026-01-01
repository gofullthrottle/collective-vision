/**
 * MCP (Model Context Protocol) Types
 * Based on JSON-RPC 2.0 and MCP specification
 */

// JSON-RPC 2.0 types
export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: JsonRpcError;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

// MCP error codes
export const MCP_ERROR_CODES = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  // Custom error codes
  UNAUTHORIZED: -32000,
  FORBIDDEN: -32001,
  NOT_FOUND: -32002,
  RATE_LIMITED: -32003,
  VALIDATION_ERROR: -32004,
} as const;

// MCP tool definition
export interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
      default?: unknown;
      minimum?: number;
      maximum?: number;
    }>;
    required?: string[];
  };
}

// MCP context passed to tool handlers
export interface MCPContext {
  workspaceId: number;
  workspaceSlug: string;
  apiKeyId: string;
  permissions: ('read' | 'write')[];
  rateLimitRemaining: number;
}

// Tool handler function type
export type ToolHandler = (
  params: Record<string, unknown>,
  context: MCPContext,
  env: MCPEnv
) => Promise<unknown>;

// Environment bindings for MCP
export interface MCPEnv {
  DB: D1Database;
  VECTORIZE?: {
    query(
      vector: number[],
      options: { topK: number; filter?: Record<string, unknown>; returnMetadata?: boolean }
    ): Promise<{ matches: Array<{ id: string; score: number; metadata?: Record<string, unknown> }>; count: number }>;
  };
  AI?: {
    run(model: string, inputs: { text: string | string[] }): Promise<{ data: number[][] }>;
  };
}

// MCP discovery response
export interface MCPDiscoveryResponse {
  name: string;
  version: string;
  description: string;
  tools: MCPToolDefinition[];
  authentication: {
    type: 'api_key';
    header: string;
    description: string;
  };
}

// API key record from database
export interface ApiKeyRecord {
  id: number;
  user_id: number;
  workspace_id: number | null;
  name: string;
  key_hash: string;
  scopes: string;
  last_used_at: string | null;
  created_at: string;
}

// Feedback item from database (extended with AI fields)
export interface FeedbackItem {
  id: number;
  board_id: number;
  user_id: number | null;
  title: string;
  description: string | null;
  status: string;
  moderation_state: string;
  is_hidden: number;
  source: string;
  priority: number | null;
  vote_count?: number;
  comment_count?: number;
  sentiment_score?: number | null;
  urgency_score?: number | null;
  ai_tags?: string | null;
  theme_id?: string | null;
  embedding_id?: string | null;
  created_at: string;
  updated_at: string;
}

// Theme record
export interface ThemeRecord {
  id: string;
  workspace_id: number;
  name: string;
  description: string | null;
  centroid_embedding_id: string | null;
  item_count: number;
  created_at: string;
  updated_at: string;
}

// List feedback response
export interface ListFeedbackResponse {
  items: FeedbackItem[];
  total: number;
  has_more: boolean;
}

// Search feedback response
export interface SearchFeedbackResponse {
  items: Array<{
    feedback: FeedbackItem;
    similarity_score: number;
  }>;
  total: number;
}

// Get themes response
export interface GetThemesResponse {
  themes: Array<{
    id: string;
    name: string;
    description: string | null;
    item_count: number;
    trend: 'rising' | 'stable' | 'falling';
  }>;
}

// Get trends response
export interface GetTrendsResponse {
  trending_themes: Array<{
    id: string;
    name: string;
    growth_rate: number;
  }>;
  anomalies: Array<{
    type: 'spike' | 'drop';
    description: string;
    severity: 'low' | 'medium' | 'high';
  }>;
  summary: string;
}

// Statistics response
export interface StatisticsResponse {
  total_feedback: number;
  total_votes: number;
  total_comments: number;
  by_status: Record<string, number>;
  by_source: Record<string, number>;
  avg_sentiment: number | null;
  avg_urgency: number | null;
  top_themes: Array<{ id: string; name: string; count: number }>;
}

// Submit feedback input
export interface SubmitFeedbackInput {
  board_slug: string;
  title: string;
  description?: string;
  source_context?: {
    agent_id?: string;
    original_source?: string;
    original_url?: string;
    user_identifier?: string;
  };
}

// Vote feedback input
export interface VoteFeedbackInput {
  feedback_id: string;
  user_identifier?: string;
}

// Add comment input
export interface AddCommentInput {
  feedback_id: string;
  body: string;
  is_internal?: boolean;
}

// Update status input
export interface UpdateStatusInput {
  feedback_id: string;
  status: 'open' | 'under_review' | 'planned' | 'in_progress' | 'done' | 'declined';
  comment?: string;
}
