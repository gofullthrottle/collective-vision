# Documentation

This directory contains the comprehensive documentation for Collective Vision.

## Quick Links

- [Project Overview](../README.md) - High-level vision and goals
- [CLAUDE.md](../CLAUDE.md) - Developer guide for Claude Code
- [Game Plan](../GAMEPLAN.md) - Detailed implementation roadmap
- [Growth Strategy](../MINTLIFY-GROWTH-STRATEGY-FOR-FEEDBACK-PLATFORM.md) - GTM and distribution strategy

## Architecture

- **Runtime**: Cloudflare Workers (TypeScript)
- **Database**: Cloudflare D1 (SQLite)
- **Deployment**: Wrangler CLI

See [CLAUDE.md](../CLAUDE.md) for complete architecture details and development commands.

## Getting Started

### Prerequisites

- Node.js 18+ or Bun
- Wrangler CLI: `npm install -g wrangler`
- Cloudflare account

### Setup

```bash
# 1. Create D1 database
wrangler d1 create collective-vision-feedback

# 2. Update wrangler.toml with database_id

# 3. Apply schema
wrangler d1 execute collective-vision-feedback --file=schema.sql

# 4. Start dev server
wrangler dev
```

### Testing the Widget

Embed in any HTML page:

```html
<script
  src="http://localhost:8787/widget.js"
  data-workspace="your-workspace"
  data-board="main"
></script>
```

## API Documentation

See [src/worker.ts](../src/worker.ts) for complete API implementation.

### Endpoints

- `GET /health` - Health check
- `GET /widget.js` - Embeddable widget script
- `GET /api/v1/:workspace/:board/feedback` - List feedback
- `POST /api/v1/:workspace/:board/feedback` - Create feedback
- `POST /api/v1/:workspace/:board/feedback/:id/votes` - Vote on feedback

## Database Schema

See [schema.sql](../schema.sql) for the complete database schema.

### Key Tables

- `workspaces` - Multi-tenant boundary
- `boards` - Feedback boards per workspace
- `end_users` - Users scoped to workspace
- `feedback_items` - Feedback with voting and moderation
- `feedback_votes` - Vote tracking
- `feedback_comments` - Comment threads
- `feedback_tags` - Tag system

## Future Enhancements

See [README.md](../README.md) for planned AI capabilities and future features.
