/**
 * Analytics Routes
 * User analytics, trends, and reporting endpoints
 */

import type { Env } from '../worker';

interface AnalyticsResult {
  [key: string]: unknown;
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function errorResponse(status: number, message: string): Response {
  return jsonResponse({ error: message }, status);
}

/**
 * Verify admin authentication
 */
async function verifyAdmin(request: Request, env: Env): Promise<{ userId: number; workspaceId: number } | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7);

  const session = await env.DB
    .prepare(`
      SELECT s.user_id, wu.workspace_id
      FROM sessions s
      JOIN workspace_users wu ON wu.user_id = s.user_id
      WHERE s.token = ?
        AND s.expires_at > datetime('now')
        AND wu.role IN ('owner', 'admin', 'member')
      LIMIT 1
    `)
    .bind(token)
    .first<{ user_id: number; workspace_id: number }>();

  if (!session) {
    return null;
  }

  return { userId: session.user_id, workspaceId: session.workspace_id };
}

// ============================================================================
// Epic 4.1: User Analytics Breakdowns
// ============================================================================

/**
 * Get feedback breakdown by user segments
 */
async function getUserAnalytics(
  env: Env,
  workspaceId: number,
  params: URLSearchParams
): Promise<Response> {
  const startDate = params.get('start_date') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const endDate = params.get('end_date') || new Date().toISOString().split('T')[0];
  const groupBy = params.get('group_by') || 'source'; // source, board, status

  // Feedback by source
  const bySource = await env.DB
    .prepare(`
      SELECT
        f.source,
        COUNT(*) as count,
        AVG(f.sentiment_score) as avg_sentiment,
        SUM(CASE WHEN f.status = 'done' THEN 1 ELSE 0 END) as resolved_count
      FROM feedback_items f
      JOIN boards b ON b.id = f.board_id
      WHERE b.workspace_id = ?
        AND date(f.created_at) >= ?
        AND date(f.created_at) <= ?
      GROUP BY f.source
      ORDER BY count DESC
    `)
    .bind(workspaceId, startDate, endDate)
    .all<{ source: string; count: number; avg_sentiment: number | null; resolved_count: number }>();

  // Feedback by board
  const byBoard = await env.DB
    .prepare(`
      SELECT
        b.slug as board,
        b.name as board_name,
        COUNT(*) as count,
        AVG(f.sentiment_score) as avg_sentiment
      FROM feedback_items f
      JOIN boards b ON b.id = f.board_id
      WHERE b.workspace_id = ?
        AND date(f.created_at) >= ?
        AND date(f.created_at) <= ?
      GROUP BY b.id
      ORDER BY count DESC
    `)
    .bind(workspaceId, startDate, endDate)
    .all<{ board: string; board_name: string; count: number; avg_sentiment: number | null }>();

  // Top voters
  const topVoters = await env.DB
    .prepare(`
      SELECT
        v.voter_id,
        COUNT(*) as vote_count
      FROM feedback_votes v
      JOIN feedback_items f ON f.id = v.feedback_id
      JOIN boards b ON b.id = f.board_id
      WHERE b.workspace_id = ?
        AND date(v.created_at) >= ?
        AND date(v.created_at) <= ?
      GROUP BY v.voter_id
      ORDER BY vote_count DESC
      LIMIT 10
    `)
    .bind(workspaceId, startDate, endDate)
    .all<{ voter_id: string; vote_count: number }>();

  // Top contributors (feedback + comments)
  const topContributors = await env.DB
    .prepare(`
      SELECT
        eu.external_user_id,
        eu.email,
        eu.name,
        COUNT(DISTINCT f.id) as feedback_count,
        COUNT(DISTINCT c.id) as comment_count,
        (COUNT(DISTINCT f.id) + COUNT(DISTINCT c.id)) as total_contributions
      FROM end_users eu
      LEFT JOIN feedback_items f ON f.user_id = eu.id
      LEFT JOIN feedback_comments c ON c.author_type = 'user' AND c.author_name = eu.external_user_id
      JOIN boards b ON b.id = f.board_id OR b.workspace_id = eu.workspace_id
      WHERE eu.workspace_id = ?
        AND (
          date(f.created_at) >= ? AND date(f.created_at) <= ?
          OR date(c.created_at) >= ? AND date(c.created_at) <= ?
        )
      GROUP BY eu.id
      HAVING total_contributions > 0
      ORDER BY total_contributions DESC
      LIMIT 10
    `)
    .bind(workspaceId, startDate, endDate, startDate, endDate)
    .all<{ external_user_id: string; email: string | null; name: string | null; feedback_count: number; comment_count: number; total_contributions: number }>();

  // User engagement funnel
  const uniqueVisitors = await env.DB
    .prepare(`
      SELECT COUNT(DISTINCT voter_id) as count
      FROM feedback_votes v
      JOIN feedback_items f ON f.id = v.feedback_id
      JOIN boards b ON b.id = f.board_id
      WHERE b.workspace_id = ?
        AND date(v.created_at) >= ?
        AND date(v.created_at) <= ?
    `)
    .bind(workspaceId, startDate, endDate)
    .first<{ count: number }>();

  const uniqueSubmitters = await env.DB
    .prepare(`
      SELECT COUNT(DISTINCT user_id) as count
      FROM feedback_items f
      JOIN boards b ON b.id = f.board_id
      WHERE b.workspace_id = ?
        AND f.user_id IS NOT NULL
        AND date(f.created_at) >= ?
        AND date(f.created_at) <= ?
    `)
    .bind(workspaceId, startDate, endDate)
    .first<{ count: number }>();

  return jsonResponse({
    period: { start_date: startDate, end_date: endDate },
    by_source: bySource.results,
    by_board: byBoard.results,
    top_voters: topVoters.results,
    top_contributors: topContributors.results.map(c => ({
      user_id: c.external_user_id,
      email: c.email,
      name: c.name,
      feedback_count: c.feedback_count,
      comment_count: c.comment_count,
    })),
    engagement_funnel: {
      unique_voters: uniqueVisitors?.count || 0,
      unique_submitters: uniqueSubmitters?.count || 0,
    },
  });
}

// ============================================================================
// Epic 4.2: Feedback Trends Over Time
// ============================================================================

/**
 * Get feedback trends over time
 */
async function getFeedbackTrends(
  env: Env,
  workspaceId: number,
  params: URLSearchParams
): Promise<Response> {
  const startDate = params.get('start_date') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const endDate = params.get('end_date') || new Date().toISOString().split('T')[0];
  const interval = params.get('interval') || 'day'; // day, week, month

  // Generate date format based on interval
  let dateFormat: string;
  switch (interval) {
    case 'week':
      dateFormat = '%Y-W%W';
      break;
    case 'month':
      dateFormat = '%Y-%m';
      break;
    default:
      dateFormat = '%Y-%m-%d';
  }

  // Feedback volume over time
  const volumeTrend = await env.DB
    .prepare(`
      SELECT
        strftime('${dateFormat}', f.created_at) as period,
        COUNT(*) as total,
        SUM(CASE WHEN f.source = 'widget' THEN 1 ELSE 0 END) as widget,
        SUM(CASE WHEN f.source = 'mcp' THEN 1 ELSE 0 END) as mcp,
        SUM(CASE WHEN f.source = 'import' THEN 1 ELSE 0 END) as import,
        SUM(CASE WHEN f.source = 'api' THEN 1 ELSE 0 END) as api
      FROM feedback_items f
      JOIN boards b ON b.id = f.board_id
      WHERE b.workspace_id = ?
        AND date(f.created_at) >= ?
        AND date(f.created_at) <= ?
      GROUP BY period
      ORDER BY period
    `)
    .bind(workspaceId, startDate, endDate)
    .all<{ period: string; total: number; widget: number; mcp: number; import: number; api: number }>();

  // Sentiment trend over time
  const sentimentTrend = await env.DB
    .prepare(`
      SELECT
        strftime('${dateFormat}', f.created_at) as period,
        AVG(f.sentiment_score) as avg_sentiment,
        MIN(f.sentiment_score) as min_sentiment,
        MAX(f.sentiment_score) as max_sentiment,
        COUNT(CASE WHEN f.sentiment_score >= 0.7 THEN 1 END) as positive,
        COUNT(CASE WHEN f.sentiment_score <= 0.3 THEN 1 END) as negative,
        COUNT(CASE WHEN f.sentiment_score > 0.3 AND f.sentiment_score < 0.7 THEN 1 END) as neutral
      FROM feedback_items f
      JOIN boards b ON b.id = f.board_id
      WHERE b.workspace_id = ?
        AND f.sentiment_score IS NOT NULL
        AND date(f.created_at) >= ?
        AND date(f.created_at) <= ?
      GROUP BY period
      ORDER BY period
    `)
    .bind(workspaceId, startDate, endDate)
    .all<{ period: string; avg_sentiment: number; min_sentiment: number; max_sentiment: number; positive: number; negative: number; neutral: number }>();

  // Resolution rate over time
  const resolutionTrend = await env.DB
    .prepare(`
      SELECT
        strftime('${dateFormat}', f.updated_at) as period,
        COUNT(*) as resolved,
        AVG(julianday(f.updated_at) - julianday(f.created_at)) as avg_resolution_days
      FROM feedback_items f
      JOIN boards b ON b.id = f.board_id
      WHERE b.workspace_id = ?
        AND f.status = 'done'
        AND date(f.updated_at) >= ?
        AND date(f.updated_at) <= ?
      GROUP BY period
      ORDER BY period
    `)
    .bind(workspaceId, startDate, endDate)
    .all<{ period: string; resolved: number; avg_resolution_days: number }>();

  // Vote activity over time
  const voteTrend = await env.DB
    .prepare(`
      SELECT
        strftime('${dateFormat}', v.created_at) as period,
        SUM(v.weight) as total_votes,
        COUNT(DISTINCT v.voter_id) as unique_voters
      FROM feedback_votes v
      JOIN feedback_items f ON f.id = v.feedback_id
      JOIN boards b ON b.id = f.board_id
      WHERE b.workspace_id = ?
        AND date(v.created_at) >= ?
        AND date(v.created_at) <= ?
      GROUP BY period
      ORDER BY period
    `)
    .bind(workspaceId, startDate, endDate)
    .all<{ period: string; total_votes: number; unique_voters: number }>();

  // Theme trends
  const themeTrend = await env.DB
    .prepare(`
      SELECT
        t.name as theme_name,
        strftime('${dateFormat}', f.created_at) as period,
        COUNT(*) as count
      FROM feedback_items f
      JOIN themes t ON t.id = f.theme_id
      JOIN boards b ON b.id = f.board_id
      WHERE b.workspace_id = ?
        AND f.theme_id IS NOT NULL
        AND date(f.created_at) >= ?
        AND date(f.created_at) <= ?
      GROUP BY t.id, period
      ORDER BY period, count DESC
    `)
    .bind(workspaceId, startDate, endDate)
    .all<{ theme_name: string; period: string; count: number }>();

  // Reorganize theme data by period
  const themesByPeriod: Record<string, Array<{ theme: string; count: number }>> = {};
  for (const item of themeTrend.results) {
    if (!themesByPeriod[item.period]) {
      themesByPeriod[item.period] = [];
    }
    themesByPeriod[item.period].push({ theme: item.theme_name, count: item.count });
  }

  return jsonResponse({
    period: { start_date: startDate, end_date: endDate, interval },
    volume: volumeTrend.results,
    sentiment: sentimentTrend.results,
    resolution: resolutionTrend.results,
    votes: voteTrend.results,
    themes_by_period: themesByPeriod,
  });
}

// ============================================================================
// Epic 4.3: Third-Party Analytics Integration
// ============================================================================

/**
 * Get analytics events for third-party integration (GA4, Mixpanel, etc.)
 */
async function getAnalyticsEvents(
  env: Env,
  workspaceId: number,
  params: URLSearchParams
): Promise<Response> {
  const startDate = params.get('start_date') || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const endDate = params.get('end_date') || new Date().toISOString().split('T')[0];
  const eventType = params.get('event_type'); // feedback_created, vote_cast, comment_added, status_changed

  let query = `
    SELECT
      'feedback_created' as event_type,
      f.id as entity_id,
      f.title as entity_name,
      b.slug as board_slug,
      f.source,
      f.created_at as timestamp,
      json_object(
        'sentiment_score', f.sentiment_score,
        'urgency_score', f.urgency_score,
        'has_description', CASE WHEN f.description IS NOT NULL THEN 1 ELSE 0 END
      ) as properties
    FROM feedback_items f
    JOIN boards b ON b.id = f.board_id
    WHERE b.workspace_id = ?
      AND date(f.created_at) >= ?
      AND date(f.created_at) <= ?
  `;

  if (eventType && eventType !== 'feedback_created') {
    if (eventType === 'vote_cast') {
      query = `
        SELECT
          'vote_cast' as event_type,
          v.id as entity_id,
          f.title as entity_name,
          b.slug as board_slug,
          'vote' as source,
          v.created_at as timestamp,
          json_object(
            'feedback_id', f.id,
            'voter_id', v.voter_id,
            'weight', v.weight
          ) as properties
        FROM feedback_votes v
        JOIN feedback_items f ON f.id = v.feedback_id
        JOIN boards b ON b.id = f.board_id
        WHERE b.workspace_id = ?
          AND date(v.created_at) >= ?
          AND date(v.created_at) <= ?
      `;
    } else if (eventType === 'comment_added') {
      query = `
        SELECT
          'comment_added' as event_type,
          c.id as entity_id,
          SUBSTR(c.body, 1, 50) as entity_name,
          b.slug as board_slug,
          'comment' as source,
          c.created_at as timestamp,
          json_object(
            'feedback_id', f.id,
            'is_internal', c.is_internal,
            'author_type', c.author_type
          ) as properties
        FROM feedback_comments c
        JOIN feedback_items f ON f.id = c.feedback_id
        JOIN boards b ON b.id = f.board_id
        WHERE b.workspace_id = ?
          AND date(c.created_at) >= ?
          AND date(c.created_at) <= ?
      `;
    } else if (eventType === 'status_changed') {
      query = `
        SELECT
          'status_changed' as event_type,
          sh.id as entity_id,
          f.title as entity_name,
          b.slug as board_slug,
          'status' as source,
          sh.created_at as timestamp,
          json_object(
            'feedback_id', f.id,
            'from_status', sh.from_status,
            'to_status', sh.to_status,
            'changed_by', sh.changed_by
          ) as properties
        FROM feedback_status_history sh
        JOIN feedback_items f ON f.id = sh.feedback_id
        JOIN boards b ON b.id = f.board_id
        WHERE b.workspace_id = ?
          AND date(sh.created_at) >= ?
          AND date(sh.created_at) <= ?
      `;
    }
  }

  query += ' ORDER BY timestamp DESC LIMIT 1000';

  const events = await env.DB
    .prepare(query)
    .bind(workspaceId, startDate, endDate)
    .all<{ event_type: string; entity_id: number; entity_name: string; board_slug: string; source: string; timestamp: string; properties: string }>();

  return jsonResponse({
    events: events.results.map(e => ({
      ...e,
      properties: typeof e.properties === 'string' ? JSON.parse(e.properties) : e.properties,
    })),
    total: events.results.length,
    period: { start_date: startDate, end_date: endDate },
  });
}

/**
 * Get analytics tracking snippet
 */
async function getTrackingSnippet(
  env: Env,
  workspaceId: number
): Promise<Response> {
  // Get workspace info
  const workspace = await env.DB
    .prepare('SELECT slug, name FROM workspaces WHERE id = ?')
    .bind(workspaceId)
    .first<{ slug: string; name: string }>();

  if (!workspace) {
    return errorResponse(404, 'Workspace not found');
  }

  const snippet = `
<!-- Collective Vision Analytics -->
<script>
(function(w,d,s,c){
  w.CVAnalytics=w.CVAnalytics||[];
  w.CVAnalytics.push=function(){
    CVAnalytics.q=CVAnalytics.q||[];
    CVAnalytics.q.push(arguments);
  };
  w.CVAnalytics.workspace='${workspace.slug}';
  var f=d.getElementsByTagName(s)[0],
      j=d.createElement(s);
  j.async=true;
  j.src='https://cdn.collective.vision/analytics.js';
  f.parentNode.insertBefore(j,f);
})(window,document,'script');

// Track page view
CVAnalytics.push('pageview');
</script>
<!-- End Collective Vision Analytics -->
  `.trim();

  return jsonResponse({
    workspace: workspace.slug,
    snippet,
    events: [
      { name: 'pageview', description: 'Track page views' },
      { name: 'feedback_view', description: 'Track when feedback is viewed' },
      { name: 'feedback_submit', description: 'Track feedback submissions' },
      { name: 'vote', description: 'Track vote interactions' },
    ],
  });
}

// ============================================================================
// Epic 4.4: Export Reports
// ============================================================================

/**
 * Export feedback data
 */
async function exportFeedback(
  env: Env,
  workspaceId: number,
  params: URLSearchParams
): Promise<Response> {
  const format = params.get('format') || 'json'; // json, csv
  const startDate = params.get('start_date');
  const endDate = params.get('end_date');
  const boardSlug = params.get('board');
  const status = params.get('status');
  const includeComments = params.get('include_comments') === 'true';
  const includeVotes = params.get('include_votes') === 'true';

  let query = `
    SELECT
      f.id,
      b.slug as board,
      f.title,
      f.description,
      f.status,
      f.moderation_state,
      f.source,
      f.priority,
      f.sentiment_score,
      f.urgency_score,
      f.ai_tags,
      t.name as theme_name,
      (SELECT COALESCE(SUM(weight), 0) FROM feedback_votes WHERE feedback_id = f.id) as vote_count,
      (SELECT COUNT(*) FROM feedback_comments WHERE feedback_id = f.id AND is_internal = 0) as comment_count,
      f.created_at,
      f.updated_at
    FROM feedback_items f
    JOIN boards b ON b.id = f.board_id
    LEFT JOIN themes t ON t.id = f.theme_id
    WHERE b.workspace_id = ?
  `;

  const queryParams: unknown[] = [workspaceId];

  if (startDate) {
    query += ' AND date(f.created_at) >= ?';
    queryParams.push(startDate);
  }
  if (endDate) {
    query += ' AND date(f.created_at) <= ?';
    queryParams.push(endDate);
  }
  if (boardSlug) {
    query += ' AND b.slug = ?';
    queryParams.push(boardSlug);
  }
  if (status) {
    query += ' AND f.status = ?';
    queryParams.push(status);
  }

  query += ' ORDER BY f.created_at DESC LIMIT 10000';

  const feedback = await env.DB
    .prepare(query)
    .bind(...queryParams)
    .all<{
      id: number;
      board: string;
      title: string;
      description: string | null;
      status: string;
      moderation_state: string;
      source: string;
      priority: number | null;
      sentiment_score: number | null;
      urgency_score: number | null;
      ai_tags: string | null;
      theme_name: string | null;
      vote_count: number;
      comment_count: number;
      created_at: string;
      updated_at: string;
    }>();

  // Add comments if requested
  let comments: Record<number, Array<{ author: string; body: string; created_at: string }>> = {};
  if (includeComments && feedback.results.length > 0) {
    const feedbackIds = feedback.results.map(f => f.id);
    const commentsResult = await env.DB
      .prepare(`
        SELECT feedback_id, author_name as author, body, created_at
        FROM feedback_comments
        WHERE feedback_id IN (${feedbackIds.map(() => '?').join(',')})
          AND is_internal = 0
        ORDER BY created_at ASC
      `)
      .bind(...feedbackIds)
      .all<{ feedback_id: number; author: string; body: string; created_at: string }>();

    comments = commentsResult.results.reduce((acc, c) => {
      if (!acc[c.feedback_id]) {
        acc[c.feedback_id] = [];
      }
      acc[c.feedback_id].push({ author: c.author, body: c.body, created_at: c.created_at });
      return acc;
    }, {} as Record<number, Array<{ author: string; body: string; created_at: string }>>);
  }

  // Format response
  const data = feedback.results.map(f => ({
    ...f,
    ai_tags: f.ai_tags ? JSON.parse(f.ai_tags) : [],
    comments: includeComments ? (comments[f.id] || []) : undefined,
  }));

  if (format === 'csv') {
    const headers = [
      'id', 'board', 'title', 'description', 'status', 'moderation_state',
      'source', 'priority', 'sentiment_score', 'urgency_score', 'ai_tags',
      'theme_name', 'vote_count', 'comment_count', 'created_at', 'updated_at'
    ];

    const csvRows = [headers.join(',')];
    for (const row of data) {
      csvRows.push(headers.map(h => {
        const value = row[h as keyof typeof row];
        if (value === null || value === undefined) return '';
        if (typeof value === 'string') return `"${value.replace(/"/g, '""')}"`;
        if (Array.isArray(value)) return `"${value.join(';')}"`;
        return String(value);
      }).join(','));
    }

    return new Response(csvRows.join('\n'), {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="feedback-export-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  }

  return jsonResponse({
    data,
    total: data.length,
    exported_at: new Date().toISOString(),
  });
}

/**
 * Generate analytics summary report
 */
async function generateReport(
  env: Env,
  workspaceId: number,
  params: URLSearchParams
): Promise<Response> {
  const reportType = params.get('type') || 'summary'; // summary, detailed, executive
  const startDate = params.get('start_date') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const endDate = params.get('end_date') || new Date().toISOString().split('T')[0];

  // Get workspace info
  const workspace = await env.DB
    .prepare('SELECT name, slug FROM workspaces WHERE id = ?')
    .bind(workspaceId)
    .first<{ name: string; slug: string }>();

  // Overall stats
  const stats = await env.DB
    .prepare(`
      SELECT
        COUNT(*) as total_feedback,
        COUNT(CASE WHEN f.status = 'done' THEN 1 END) as resolved,
        COUNT(CASE WHEN f.status = 'open' THEN 1 END) as open,
        AVG(f.sentiment_score) as avg_sentiment,
        AVG(f.urgency_score) as avg_urgency
      FROM feedback_items f
      JOIN boards b ON b.id = f.board_id
      WHERE b.workspace_id = ?
        AND date(f.created_at) >= ?
        AND date(f.created_at) <= ?
    `)
    .bind(workspaceId, startDate, endDate)
    .first<{ total_feedback: number; resolved: number; open: number; avg_sentiment: number | null; avg_urgency: number | null }>();

  // Previous period comparison
  const daysDiff = Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24));
  const prevStartDate = new Date(new Date(startDate).getTime() - daysDiff * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const prevEndDate = new Date(new Date(startDate).getTime() - 1).toISOString().split('T')[0];

  const prevStats = await env.DB
    .prepare(`
      SELECT
        COUNT(*) as total_feedback,
        COUNT(CASE WHEN f.status = 'done' THEN 1 END) as resolved
      FROM feedback_items f
      JOIN boards b ON b.id = f.board_id
      WHERE b.workspace_id = ?
        AND date(f.created_at) >= ?
        AND date(f.created_at) <= ?
    `)
    .bind(workspaceId, prevStartDate, prevEndDate)
    .first<{ total_feedback: number; resolved: number }>();

  // Top themes
  const topThemes = await env.DB
    .prepare(`
      SELECT t.name, COUNT(*) as count
      FROM feedback_items f
      JOIN themes t ON t.id = f.theme_id
      JOIN boards b ON b.id = f.board_id
      WHERE b.workspace_id = ?
        AND date(f.created_at) >= ?
        AND date(f.created_at) <= ?
      GROUP BY t.id
      ORDER BY count DESC
      LIMIT 5
    `)
    .bind(workspaceId, startDate, endDate)
    .all<{ name: string; count: number }>();

  // Most voted items
  const topVoted = await env.DB
    .prepare(`
      SELECT
        f.id,
        f.title,
        f.status,
        (SELECT COALESCE(SUM(weight), 0) FROM feedback_votes WHERE feedback_id = f.id) as votes
      FROM feedback_items f
      JOIN boards b ON b.id = f.board_id
      WHERE b.workspace_id = ?
        AND date(f.created_at) >= ?
        AND date(f.created_at) <= ?
      ORDER BY votes DESC
      LIMIT 10
    `)
    .bind(workspaceId, startDate, endDate)
    .all<{ id: number; title: string; status: string; votes: number }>();

  // Calculate trends
  const feedbackChange = prevStats?.total_feedback
    ? Math.round(((stats?.total_feedback || 0) - prevStats.total_feedback) / prevStats.total_feedback * 100)
    : 0;

  const resolutionRate = stats?.total_feedback
    ? Math.round((stats.resolved / stats.total_feedback) * 100)
    : 0;

  return jsonResponse({
    report_type: reportType,
    workspace: workspace?.name || 'Unknown',
    period: {
      start_date: startDate,
      end_date: endDate,
      days: daysDiff,
    },
    summary: {
      total_feedback: stats?.total_feedback || 0,
      resolved: stats?.resolved || 0,
      open: stats?.open || 0,
      resolution_rate: resolutionRate,
      avg_sentiment: stats?.avg_sentiment ? Math.round(stats.avg_sentiment * 100) / 100 : null,
      avg_urgency: stats?.avg_urgency ? Math.round(stats.avg_urgency * 100) / 100 : null,
    },
    comparison: {
      previous_period: { start_date: prevStartDate, end_date: prevEndDate },
      feedback_change_percent: feedbackChange,
      trend: feedbackChange > 0 ? 'up' : feedbackChange < 0 ? 'down' : 'stable',
    },
    top_themes: topThemes.results,
    top_voted: topVoted.results,
    generated_at: new Date().toISOString(),
  });
}

// ============================================================================
// Epic 4.5: Dashboard Enhancements
// ============================================================================

/**
 * Get dashboard widgets data
 */
async function getDashboardWidgets(
  env: Env,
  workspaceId: number
): Promise<Response> {
  // Real-time activity (last 24 hours)
  const recentActivity = await env.DB
    .prepare(`
      SELECT
        'feedback' as type,
        f.id,
        f.title,
        f.created_at as timestamp
      FROM feedback_items f
      JOIN boards b ON b.id = f.board_id
      WHERE b.workspace_id = ?
        AND f.created_at >= datetime('now', '-24 hours')
      UNION ALL
      SELECT
        'comment' as type,
        c.id,
        SUBSTR(c.body, 1, 50) as title,
        c.created_at as timestamp
      FROM feedback_comments c
      JOIN feedback_items f ON f.id = c.feedback_id
      JOIN boards b ON b.id = f.board_id
      WHERE b.workspace_id = ?
        AND c.created_at >= datetime('now', '-24 hours')
      ORDER BY timestamp DESC
      LIMIT 20
    `)
    .bind(workspaceId, workspaceId)
    .all<{ type: string; id: number; title: string; timestamp: string }>();

  // Pending moderation count
  const pendingModeration = await env.DB
    .prepare(`
      SELECT COUNT(*) as count
      FROM feedback_items f
      JOIN boards b ON b.id = f.board_id
      WHERE b.workspace_id = ?
        AND f.moderation_state = 'pending'
    `)
    .bind(workspaceId)
    .first<{ count: number }>();

  // Status breakdown
  const statusBreakdown = await env.DB
    .prepare(`
      SELECT f.status, COUNT(*) as count
      FROM feedback_items f
      JOIN boards b ON b.id = f.board_id
      WHERE b.workspace_id = ?
        AND f.moderation_state = 'approved'
      GROUP BY f.status
    `)
    .bind(workspaceId)
    .all<{ status: string; count: number }>();

  // Today's stats
  const todayStats = await env.DB
    .prepare(`
      SELECT
        COUNT(*) as new_feedback,
        (SELECT COUNT(*) FROM feedback_votes v
         JOIN feedback_items f2 ON f2.id = v.feedback_id
         JOIN boards b2 ON b2.id = f2.board_id
         WHERE b2.workspace_id = ? AND date(v.created_at) = date('now')) as new_votes,
        (SELECT COUNT(*) FROM feedback_comments c
         JOIN feedback_items f3 ON f3.id = c.feedback_id
         JOIN boards b3 ON b3.id = f3.board_id
         WHERE b3.workspace_id = ? AND date(c.created_at) = date('now')) as new_comments
      FROM feedback_items f
      JOIN boards b ON b.id = f.board_id
      WHERE b.workspace_id = ?
        AND date(f.created_at) = date('now')
    `)
    .bind(workspaceId, workspaceId, workspaceId)
    .first<{ new_feedback: number; new_votes: number; new_comments: number }>();

  // High urgency items requiring attention
  const urgentItems = await env.DB
    .prepare(`
      SELECT f.id, f.title, f.urgency_score, f.sentiment_score
      FROM feedback_items f
      JOIN boards b ON b.id = f.board_id
      WHERE b.workspace_id = ?
        AND f.moderation_state = 'approved'
        AND f.status IN ('open', 'under_review')
        AND (f.urgency_score >= 0.7 OR f.sentiment_score <= 0.3)
      ORDER BY f.urgency_score DESC, f.sentiment_score ASC
      LIMIT 5
    `)
    .bind(workspaceId)
    .all<{ id: number; title: string; urgency_score: number | null; sentiment_score: number | null }>();

  return jsonResponse({
    recent_activity: recentActivity.results,
    pending_moderation: pendingModeration?.count || 0,
    status_breakdown: Object.fromEntries(statusBreakdown.results.map(s => [s.status, s.count])),
    today: {
      new_feedback: todayStats?.new_feedback || 0,
      new_votes: todayStats?.new_votes || 0,
      new_comments: todayStats?.new_comments || 0,
    },
    urgent_items: urgentItems.results,
    last_updated: new Date().toISOString(),
  });
}

// ============================================================================
// Widget Analytics Config (Public Endpoint)
// ============================================================================

/**
 * Get analytics configuration for the embedded widget
 * This is a public endpoint that returns GA4, Clarity, and custom pixel configs
 */
async function getWidgetAnalyticsConfig(
  env: Env,
  workspaceSlug: string
): Promise<Response> {
  // Get workspace
  const workspace = await env.DB
    .prepare('SELECT id FROM workspaces WHERE slug = ?')
    .bind(workspaceSlug)
    .first<{ id: number }>();

  if (!workspace) {
    return jsonResponse({ error: 'Workspace not found' }, 404);
  }

  // Get workspace settings
  const settings = await env.DB
    .prepare(`
      SELECT
        analytics_enabled,
        ga4_measurement_id,
        clarity_project_id,
        custom_pixels
      FROM workspace_settings
      WHERE workspace_id = ?
    `)
    .bind(workspace.id)
    .first<{
      analytics_enabled: number;
      ga4_measurement_id: string | null;
      clarity_project_id: string | null;
      custom_pixels: string | null;
    }>();

  // If analytics not enabled or no settings, return empty config
  if (!settings || !settings.analytics_enabled) {
    return jsonResponse({
      enabled: false,
      ga4_measurement_id: null,
      clarity_project_id: null,
      custom_pixels: []
    });
  }

  // Parse custom pixels JSON
  let customPixels: Array<{ type: string; src?: string; endpoint?: string }> = [];
  if (settings.custom_pixels) {
    try {
      customPixels = JSON.parse(settings.custom_pixels);
    } catch {
      // Invalid JSON, use empty array
    }
  }

  return jsonResponse({
    enabled: true,
    ga4_measurement_id: settings.ga4_measurement_id,
    clarity_project_id: settings.clarity_project_id,
    custom_pixels: customPixels
  });
}

// ============================================================================
// Main Route Handler
// ============================================================================

export async function handleAnalyticsRoutes(
  request: Request,
  pathname: string,
  env: Env
): Promise<Response | null> {
  const method = request.method;
  const url = new URL(request.url);
  const params = url.searchParams;

  // Public endpoint: Widget analytics config (no auth required)
  // GET /api/v1/:workspace/analytics/config
  const configMatch = pathname.match(/^\/api\/v1\/([^/]+)\/analytics\/config$/);
  if (configMatch && method === 'GET') {
    const workspaceSlug = configMatch[1];
    return getWidgetAnalyticsConfig(env, workspaceSlug);
  }

  // All other analytics routes require auth
  const auth = await verifyAdmin(request, env);
  if (!auth) {
    return errorResponse(401, 'Unauthorized');
  }

  // User analytics: GET /api/v1/:workspace/analytics/users
  if (pathname.match(/^\/api\/v1\/[^/]+\/analytics\/users$/) && method === 'GET') {
    return getUserAnalytics(env, auth.workspaceId, params);
  }

  // Trends: GET /api/v1/:workspace/analytics/trends
  if (pathname.match(/^\/api\/v1\/[^/]+\/analytics\/trends$/) && method === 'GET') {
    return getFeedbackTrends(env, auth.workspaceId, params);
  }

  // Events: GET /api/v1/:workspace/analytics/events
  if (pathname.match(/^\/api\/v1\/[^/]+\/analytics\/events$/) && method === 'GET') {
    return getAnalyticsEvents(env, auth.workspaceId, params);
  }

  // Tracking snippet: GET /api/v1/:workspace/analytics/tracking
  if (pathname.match(/^\/api\/v1\/[^/]+\/analytics\/tracking$/) && method === 'GET') {
    return getTrackingSnippet(env, auth.workspaceId);
  }

  // Export: GET /api/v1/:workspace/analytics/export
  if (pathname.match(/^\/api\/v1\/[^/]+\/analytics\/export$/) && method === 'GET') {
    return exportFeedback(env, auth.workspaceId, params);
  }

  // Report: GET /api/v1/:workspace/analytics/report
  if (pathname.match(/^\/api\/v1\/[^/]+\/analytics\/report$/) && method === 'GET') {
    return generateReport(env, auth.workspaceId, params);
  }

  // Dashboard widgets: GET /api/v1/:workspace/analytics/dashboard
  if (pathname.match(/^\/api\/v1\/[^/]+\/analytics\/dashboard$/) && method === 'GET') {
    return getDashboardWidgets(env, auth.workspaceId);
  }

  return null;
}
