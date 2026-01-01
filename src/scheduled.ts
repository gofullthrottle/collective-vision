/**
 * Scheduled Jobs Handler
 *
 * Cloudflare Cron Triggers for:
 * - Daily/weekly report generation
 * - Brand monitoring crawls
 * - AI processing of pending feedback
 * - Stale data cleanup
 *
 * ASSUMPTIONS:
 * - Cron triggers configured in wrangler.toml
 * - Environment variables for external services set as secrets
 * - D1 database available
 */

import type { Env } from './worker';
import { generatePDFReport, generateSummaryPDF } from './lib/pdf/report-generator';
import { BrandMonitoringCrawler } from './lib/firecrawl/crawler';
import { FirecrawlClient } from './lib/firecrawl/client';
import { LiteLLMClient } from './lib/llm/client';
import { PainPointDetector } from './lib/llm/pain-point-detector';

export interface ScheduledEnv extends Env {
  // Additional environment variables for scheduled jobs
  FIRECRAWL_API_KEY?: string;
  FIRECRAWL_BASE_URL?: string;
  LITELLM_API_KEY?: string;
  LITELLM_BASE_URL?: string;
  // Report distribution
  REPORT_EMAIL_RECIPIENTS?: string; // Comma-separated
}

interface CronContext {
  scheduledTime: number;
  cron: string;
}

/**
 * Main scheduled event handler
 * Routes to appropriate job based on cron pattern
 */
export async function handleScheduled(
  event: CronContext,
  env: ScheduledEnv
): Promise<void> {
  const jobStart = Date.now();
  const cron = event.cron;

  console.log(`[CRON] Starting scheduled job: ${cron} at ${new Date(event.scheduledTime).toISOString()}`);

  try {
    switch (cron) {
      // Daily report generation - 9 AM UTC
      case '0 9 * * *':
        await runDailyReports(env);
        break;

      // Weekly report generation - Monday 9 AM UTC
      case '0 9 * * 1':
        await runWeeklyReports(env);
        break;

      // Brand monitoring crawl - every 6 hours
      case '0 */6 * * *':
        await runBrandMonitoring(env);
        break;

      // AI processing of pending feedback - every hour
      case '0 * * * *':
        await runAIProcessing(env);
        break;

      // Stale data cleanup - daily at 3 AM UTC
      case '0 3 * * *':
        await runCleanup(env);
        break;

      default:
        console.log(`[CRON] Unknown cron pattern: ${cron}`);
    }
  } catch (error) {
    console.error(`[CRON] Job failed: ${cron}`, error instanceof Error ? error.message : error);
    throw error; // Re-throw to mark job as failed
  }

  const duration = Date.now() - jobStart;
  console.log(`[CRON] Completed job: ${cron} in ${duration}ms`);
}

/**
 * Generate daily reports for all workspaces
 */
async function runDailyReports(env: ScheduledEnv): Promise<void> {
  console.log('[CRON:DAILY_REPORTS] Starting daily report generation');

  // Get all workspaces with report settings
  const workspaces = await env.DB.prepare(`
    SELECT DISTINCT w.id, w.slug, w.name
    FROM workspaces w
    INNER JOIN boards b ON b.workspace_id = w.id
    WHERE EXISTS (
      SELECT 1 FROM feedback_items f
      WHERE f.board_id = b.id
      AND f.created_at >= datetime('now', '-1 day')
    )
  `).all();

  console.log(`[CRON:DAILY_REPORTS] Found ${workspaces.results?.length || 0} workspaces with activity`);

  for (const workspace of workspaces.results || []) {
    try {
      await generateWorkspaceReport(env, workspace.id as number, 'daily');
    } catch (error) {
      console.error(`[CRON:DAILY_REPORTS] Failed for workspace ${workspace.slug}:`, error);
    }
  }
}

/**
 * Generate weekly reports for all workspaces
 */
async function runWeeklyReports(env: ScheduledEnv): Promise<void> {
  console.log('[CRON:WEEKLY_REPORTS] Starting weekly report generation');

  // Get all active workspaces
  const workspaces = await env.DB.prepare(`
    SELECT DISTINCT w.id, w.slug, w.name
    FROM workspaces w
    INNER JOIN boards b ON b.workspace_id = w.id
    WHERE EXISTS (
      SELECT 1 FROM feedback_items f
      WHERE f.board_id = b.id
      AND f.created_at >= datetime('now', '-7 days')
    )
  `).all();

  console.log(`[CRON:WEEKLY_REPORTS] Found ${workspaces.results?.length || 0} workspaces with activity`);

  for (const workspace of workspaces.results || []) {
    try {
      await generateWorkspaceReport(env, workspace.id as number, 'weekly');
    } catch (error) {
      console.error(`[CRON:WEEKLY_REPORTS] Failed for workspace ${workspace.slug}:`, error);
    }
  }
}

/**
 * Generate report for a specific workspace
 */
async function generateWorkspaceReport(
  env: ScheduledEnv,
  workspaceId: number,
  period: 'daily' | 'weekly'
): Promise<void> {
  const daysBack = period === 'daily' ? 1 : 7;
  const dateFilter = `datetime('now', '-${daysBack} days')`;

  // Get workspace info
  const workspace = await env.DB.prepare(
    'SELECT * FROM workspaces WHERE id = ?'
  ).bind(workspaceId).first();

  if (!workspace) return;

  // Get feedback summary
  const feedbackStats = await env.DB.prepare(`
    SELECT
      COUNT(*) as total_feedback,
      SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open_count,
      SUM(CASE WHEN status = 'planned' THEN 1 ELSE 0 END) as planned_count,
      SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_count,
      SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done_count
    FROM feedback_items f
    INNER JOIN boards b ON f.board_id = b.id
    WHERE b.workspace_id = ?
    AND f.created_at >= ${dateFilter}
  `).bind(workspaceId).first();

  // Get top voted items
  const topItems = await env.DB.prepare(`
    SELECT
      f.id, f.title, f.status,
      COALESCE(SUM(v.weight), 0) as vote_count
    FROM feedback_items f
    INNER JOIN boards b ON f.board_id = b.id
    LEFT JOIN feedback_votes v ON v.feedback_id = f.id
    WHERE b.workspace_id = ?
    AND f.created_at >= ${dateFilter}
    GROUP BY f.id
    ORDER BY vote_count DESC
    LIMIT 10
  `).bind(workspaceId).all();

  // Generate PDF report
  const reportData = {
    title: `${workspace.name} - ${period.charAt(0).toUpperCase() + period.slice(1)} Feedback Report`,
    generatedAt: new Date().toISOString(),
    period: {
      start: new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      end: new Date().toISOString().split('T')[0],
    },
    stats: feedbackStats || {},
    topItems: topItems.results || [],
  };

  // Generate PDF with workspace name and normalized stats
  const pdfBytes = await generateSummaryPDF(
    workspace.name as string,
    {
      total_feedback: Number(feedbackStats?.total_feedback) || 0,
      total_votes: 0, // Would need a separate query for this
      open: Number(feedbackStats?.open_count) || 0,
      done: Number(feedbackStats?.done_count) || 0,
    }
  );

  // Store report in database (or could upload to R2/S3)
  await env.DB.prepare(`
    INSERT INTO generated_reports (workspace_id, report_type, period_start, period_end, data, created_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
  `).bind(
    workspaceId,
    period,
    reportData.period.start,
    reportData.period.end,
    JSON.stringify({ bytes: Array.from(pdfBytes), ...reportData })
  ).run();

  console.log(`[CRON:REPORTS] Generated ${period} report for workspace ${workspace.slug}`);
}

/**
 * Run brand monitoring crawl
 */
async function runBrandMonitoring(env: ScheduledEnv): Promise<void> {
  console.log('[CRON:BRAND_MONITORING] Starting brand monitoring crawl');

  // Check if services are configured
  if (!env.FIRECRAWL_API_KEY || !env.LITELLM_API_KEY) {
    console.log('[CRON:BRAND_MONITORING] Skipping - Firecrawl or LiteLLM not configured');
    return;
  }

  // Get workspaces with brand monitoring enabled
  const workspaces = await env.DB.prepare(`
    SELECT w.*, s.keywords, s.platforms, s.last_crawl_at
    FROM workspaces w
    LEFT JOIN workspace_settings s ON s.workspace_id = w.id
    WHERE s.brand_monitoring_enabled = 1
  `).all();

  if (!workspaces.results?.length) {
    console.log('[CRON:BRAND_MONITORING] No workspaces with brand monitoring enabled');
    return;
  }

  // Initialize clients
  const firecrawl = new FirecrawlClient({
    apiKey: env.FIRECRAWL_API_KEY,
    baseUrl: env.FIRECRAWL_BASE_URL || 'https://firecrawl.jfcreations.com',
  });

  const llm = new LiteLLMClient({
    apiKey: env.LITELLM_API_KEY,
    baseUrl: env.LITELLM_BASE_URL || 'https://litellm.jfcreations.com',
  });

  for (const workspace of workspaces.results) {
    try {
      const keywords = JSON.parse((workspace.keywords as string) || '[]');
      if (!keywords.length) continue;

      const crawler = new BrandMonitoringCrawler(firecrawl, llm, {
        productName: workspace.name as string,
        brandKeywords: keywords,
      });

      const result = await crawler.crawl({
        keywords,
        limit: 20,
      });

      console.log(`[CRON:BRAND_MONITORING] Workspace ${workspace.slug}: Found ${result.mentionsFound} mentions, ${result.actionableMentions} actionable`);

      // Convert actionable mentions to feedback
      if (result.actionableMentions > 0) {
        const feedbackItems = await crawler.convertToFeedback(
          result.mentions.filter(m => m.analysis?.isActionable)
        );

        // Get default board for this workspace
        const board = await env.DB.prepare(
          'SELECT id FROM boards WHERE workspace_id = ? ORDER BY id LIMIT 1'
        ).bind(workspace.id).first();

        if (board) {
          for (const item of feedbackItems) {
            await env.DB.prepare(`
              INSERT INTO feedback_items (
                board_id, title, description, status, source, source_url,
                sentiment_score, relevance_score, metadata,
                moderation_state, is_hidden, created_at
              ) VALUES (?, ?, ?, 'open', ?, ?, ?, ?, ?, 'pending', 1, datetime('now'))
            `).bind(
              board.id,
              item.title,
              item.description,
              item.source,
              item.source_url,
              item.sentiment_score,
              item.relevance_score,
              JSON.stringify(item.metadata)
            ).run();
          }
          console.log(`[CRON:BRAND_MONITORING] Created ${feedbackItems.length} feedback items for ${workspace.slug}`);
        }
      }

      // Update last crawl timestamp
      await env.DB.prepare(`
        UPDATE workspace_settings SET last_crawl_at = datetime('now') WHERE workspace_id = ?
      `).bind(workspace.id).run();

    } catch (error) {
      console.error(`[CRON:BRAND_MONITORING] Failed for workspace ${workspace.slug}:`, error);
    }
  }
}

/**
 * Process pending feedback with AI
 */
async function runAIProcessing(env: ScheduledEnv): Promise<void> {
  console.log('[CRON:AI_PROCESSING] Starting AI processing of pending feedback');

  if (!env.LITELLM_API_KEY) {
    console.log('[CRON:AI_PROCESSING] Skipping - LiteLLM not configured');
    return;
  }

  // Get pending feedback items that haven't been AI processed
  const pending = await env.DB.prepare(`
    SELECT f.id, f.title, f.description, f.source, w.name as workspace_name
    FROM feedback_items f
    INNER JOIN boards b ON f.board_id = b.id
    INNER JOIN workspaces w ON b.workspace_id = w.id
    WHERE f.ai_processed = 0
    AND f.created_at >= datetime('now', '-7 days')
    ORDER BY f.created_at DESC
    LIMIT 50
  `).all();

  if (!pending.results?.length) {
    console.log('[CRON:AI_PROCESSING] No pending items to process');
    return;
  }

  console.log(`[CRON:AI_PROCESSING] Processing ${pending.results.length} items`);

  const llm = new LiteLLMClient({
    apiKey: env.LITELLM_API_KEY,
    baseUrl: env.LITELLM_BASE_URL || 'https://litellm.jfcreations.com',
  });

  const detector = new PainPointDetector(llm);

  for (const item of pending.results) {
    try {
      const analysis = await detector.analyze({
        content: (item.description as string) || '',
        title: item.title as string,
        source: item.source as string,
      });

      // Update feedback item with AI analysis
      await env.DB.prepare(`
        UPDATE feedback_items
        SET
          ai_processed = 1,
          ai_category = ?,
          ai_confidence = ?,
          sentiment_score = ?,
          ai_reasoning = ?,
          ai_suggested_tags = ?
        WHERE id = ?
      `).bind(
        analysis.category,
        analysis.confidence,
        analysis.sentiment.score,
        analysis.reasoning,
        JSON.stringify(analysis.extractedFeedback?.suggestedTags || []),
        item.id
      ).run();

    } catch (error) {
      console.error(`[CRON:AI_PROCESSING] Failed for item ${item.id}:`, error);
    }
  }
}

/**
 * Clean up stale data
 */
async function runCleanup(env: ScheduledEnv): Promise<void> {
  console.log('[CRON:CLEANUP] Starting stale data cleanup');

  // Clean up old rate limit entries (older than 24 hours)
  const rateLimitCleanup = await env.DB.prepare(`
    DELETE FROM rate_limits WHERE created_at < datetime('now', '-1 day')
  `).run();
  console.log(`[CRON:CLEANUP] Deleted ${rateLimitCleanup.meta.changes} old rate limit entries`);

  // Clean up old session tokens (older than 30 days)
  const sessionCleanup = await env.DB.prepare(`
    DELETE FROM user_sessions WHERE expires_at < datetime('now')
  `).run();
  console.log(`[CRON:CLEANUP] Deleted ${sessionCleanup.meta.changes} expired sessions`);

  // Clean up orphaned votes (feedback deleted)
  const orphanVotes = await env.DB.prepare(`
    DELETE FROM feedback_votes
    WHERE feedback_id NOT IN (SELECT id FROM feedback_items)
  `).run();
  console.log(`[CRON:CLEANUP] Deleted ${orphanVotes.meta.changes} orphaned votes`);

  // Clean up old generated reports (keep last 90 days)
  const reportCleanup = await env.DB.prepare(`
    DELETE FROM generated_reports WHERE created_at < datetime('now', '-90 days')
  `).run();
  console.log(`[CRON:CLEANUP] Deleted ${reportCleanup.meta.changes} old reports`);

  // Archive feedback older than 1 year
  const archiveCount = await env.DB.prepare(`
    UPDATE feedback_items
    SET is_archived = 1
    WHERE created_at < datetime('now', '-365 days')
    AND is_archived = 0
  `).run();
  console.log(`[CRON:CLEANUP] Archived ${archiveCount.meta.changes} old feedback items`);
}

/**
 * Export scheduled handler for Cloudflare Workers
 */
export default {
  scheduled: handleScheduled,
};
