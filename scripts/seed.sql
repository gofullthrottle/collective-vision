-- Seed data for local development
-- Run with: wrangler d1 execute collective-vision-feedback-dev --file=scripts/seed.sql --local

-- Create demo workspace
INSERT OR IGNORE INTO workspaces (id, slug, name)
VALUES (1, 'demo', 'Demo Workspace');

-- Create boards
INSERT OR IGNORE INTO boards (id, workspace_id, slug, name, is_public)
VALUES
  (1, 1, 'product-feedback', 'Product Feedback', 1),
  (2, 1, 'feature-requests', 'Feature Requests', 1),
  (3, 1, 'internal', 'Internal Roadmap', 0);

-- Create demo users
INSERT OR IGNORE INTO end_users (id, workspace_id, external_user_id, email, name)
VALUES
  (1, 1, 'user-1', 'alice@example.com', 'Alice Johnson'),
  (2, 1, 'user-2', 'bob@example.com', 'Bob Smith'),
  (3, 1, 'user-3', 'charlie@example.com', 'Charlie Brown'),
  (4, 1, 'anon_demo123', NULL, 'Anonymous User');

-- Create tags
INSERT OR IGNORE INTO feedback_tags (id, workspace_id, name, color)
VALUES
  (1, 1, 'bug', '#ef4444'),
  (2, 1, 'feature', '#3b82f6'),
  (3, 1, 'enhancement', '#10b981'),
  (4, 1, 'documentation', '#8b5cf6'),
  (5, 1, 'performance', '#f59e0b');

-- Create feedback items
INSERT OR IGNORE INTO feedback_items (id, board_id, author_id, title, description, status, source, moderation_state, is_hidden)
VALUES
  (1, 1, 1, 'Dark mode support', 'Would love to have a dark mode option for the widget. It would match our site better and reduce eye strain.', 'open', 'widget', 'approved', 0),
  (2, 1, 2, 'Export feedback to CSV', 'Need ability to export all feedback items to CSV for reporting and analysis.', 'under_review', 'widget', 'approved', 0),
  (3, 1, 3, 'Mobile app version', 'Would be great to have a native mobile app for managing feedback on the go.', 'open', 'widget', 'approved', 0),
  (4, 1, 1, 'Slack integration', 'Integrate with Slack to send notifications when new feedback is submitted.', 'planned', 'api', 'approved', 0),
  (5, 1, 4, 'Faster load times', 'The widget sometimes takes a while to load on slow connections.', 'open', 'widget', 'approved', 0),
  (6, 2, 2, 'AI-powered deduplication', 'Use AI to automatically detect and merge duplicate feedback items.', 'open', 'widget', 'approved', 0),
  (7, 2, 1, 'Custom branding options', 'Allow customizing widget colors and fonts to match our brand.', 'under_review', 'widget', 'approved', 0),
  (8, 3, 3, 'Internal: Improve admin dashboard', 'Redesign the admin dashboard for better usability.', 'in_progress', 'api', 'approved', 0);

-- Add votes
INSERT OR IGNORE INTO feedback_votes (feedback_id, user_id, weight)
VALUES
  (1, 1, 1), (1, 2, 1), (1, 3, 1), (1, 4, 1),  -- Dark mode: 4 votes
  (2, 1, 1), (2, 3, 1),                          -- Export CSV: 2 votes
  (3, 2, 1), (3, 3, 1), (3, 4, 1),               -- Mobile app: 3 votes
  (4, 1, 1), (4, 2, 1), (4, 3, 1), (4, 4, 1),   -- Slack: 4 votes
  (5, 3, 1),                                      -- Faster load: 1 vote
  (6, 1, 1), (6, 2, 1), (6, 3, 1),               -- AI dedup: 3 votes
  (7, 4, 1);                                      -- Custom branding: 1 vote

-- Add comments
INSERT OR IGNORE INTO feedback_comments (id, feedback_id, author_id, body, is_internal)
VALUES
  (1, 1, 2, 'This would be really helpful for us too! We have a lot of users who prefer dark mode.', 0),
  (2, 1, 1, 'Agreed, dark mode is becoming a standard feature these days.', 0),
  (3, 4, 3, 'We use Slack heavily, this integration would save us a lot of time checking for new feedback.', 0),
  (4, 8, 1, 'Internal note: We should prioritize the mobile-responsive improvements first.', 1);

-- Tag feedback items
INSERT OR IGNORE INTO feedback_item_tags (feedback_id, tag_id)
VALUES
  (1, 2),  -- Dark mode -> feature
  (2, 2),  -- Export CSV -> feature
  (3, 2),  -- Mobile app -> feature
  (4, 2),  -- Slack -> feature
  (5, 5),  -- Faster load -> performance
  (6, 2),  -- AI dedup -> feature
  (7, 3),  -- Custom branding -> enhancement
  (8, 3);  -- Admin dashboard -> enhancement

-- Success message (SQLite will show this)
SELECT 'Seed data created successfully!' AS message;
SELECT 'Created: 1 workspace, 3 boards, 4 users, 5 tags, 8 feedback items, 15 votes, 4 comments' AS summary;
