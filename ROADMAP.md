# Collective Vision Roadmap

## Current Status

### Completed
- [x] Embeddable feedback widget with voting and comments
- [x] Multi-tenant workspace/board architecture
- [x] Admin dashboard with stats and feedback management
- [x] Tags system for organizing feedback
- [x] Anonymous user tracking with localStorage
- [x] Moderation workflow (pending/approved/rejected)
- [x] "Powered by Collective Vision" badge for free tier licensing
- [x] Landing page with marketing content
- [x] About and Contact pages

### In Progress
- [ ] Mobile responsive design improvements
- [ ] User authentication and sign-up flow

---

## Phase 1: Core Platform Enhancements

### Authentication & User Management
- [ ] User sign-up and login functionality
- [ ] OAuth integration (Google, GitHub)
- [ ] Team member roles and permissions
- [ ] User profile management

### Analytics & Insights
- [ ] User analytics breakdowns for feedback voters
- [ ] Feedback trends over time
- [ ] Voting patterns and engagement metrics
- [ ] Export reports (CSV, PDF)

### Integrations
- [ ] Google Analytics integration
- [ ] Microsoft Clarity integration
- [ ] Tracking pixel settings in admin
- [ ] Event tracking for comprehensive analytics

---

## Phase 2: AI Capabilities

### Semantic Deduplication (P0)
- [ ] Detect similar feedback across channels
- [ ] Suggest merges for duplicate requests
- [ ] Batch processing for existing feedback

### Auto-Tagging & Intent Classification (P0)
- [ ] Categorize into product areas automatically
- [ ] Distinguish bug reports vs feature requests
- [ ] Urgency and sentiment scoring

### Theme Clustering (P0)
- [ ] Group feedback into themes for reporting
- [ ] MCP-queryable theme summaries
- [ ] Trend detection across themes

---

## Phase 3: Agent & Framework Integrations

### MCP Server
- [ ] Expose feedback system as MCP server
- [ ] Query tools for AI agents
- [ ] Write tools for automated feedback creation
- [ ] Integration documentation

### Agent Framework Integrations
- [ ] Microsoft Agent Framework integration
- [ ] AG-UI Protocol support
- [ ] CopilotKit integration
- [ ] LangChain/LangGraph tools

---

## Phase 4: Data Ingestion & Migration

### Import Scripts
- [ ] UserVoice import tool
- [ ] Canny import tool
- [ ] Productboard import tool
- [ ] Generic CSV import

### Brand Mention Monitoring
- [ ] Firecrawl integration for web monitoring
- [ ] Pain point detection in discussions
- [ ] Automatic feedback creation from mentions
- [ ] Source attribution and linking

### Multi-Channel Ingestion
- [ ] Reddit monitoring
- [ ] Discord/Slack integration
- [ ] Twitter/X mentions
- [ ] Support ticket integration (Zendesk, Intercom)

---

## Phase 5: Monetization & Scaling

### Payments
- [ ] Stripe integration
- [ ] Subscription tier management
- [ ] Usage-based billing
- [ ] Invoice generation

### Multi-Language Support
- [ ] i18n framework implementation
- [ ] Widget translation
- [ ] Admin UI localization
- [ ] Auto-translation of feedback

### Performance & Scalability
- [ ] Edge caching optimization
- [ ] Rate limiting improvements
- [ ] Database query optimization
- [ ] CDN for static assets

---

## Phase 6: Advanced Features

### Public Roadmaps
- [ ] Public-facing roadmap pages
- [ ] Status updates and changelogs
- [ ] Subscriber notifications
- [ ] RSS/webhook updates

### Project Management Integrations
- [ ] Jira integration
- [ ] Linear integration
- [ ] Asana integration
- [ ] GitHub Issues sync

### AI Roadmap Features
- [ ] AI-powered roadmap drafting
- [ ] Status update generation
- [ ] Priority recommendations
- [ ] Resource estimation

---

## Technical Debt & Infrastructure

### Code Quality
- [ ] Unit test coverage > 80%
- [ ] E2E tests with Playwright
- [ ] API documentation (OpenAPI)
- [ ] Component documentation (Storybook)

### DevOps
- [ ] CI/CD pipeline optimization
- [ ] Staging environment
- [ ] Blue-green deployments
- [ ] Monitoring and alerting

### Security
- [ ] Security audit
- [ ] OWASP compliance
- [ ] SOC 2 preparation
- [ ] GDPR compliance features

---

## Notes

- Items marked (P0) are highest priority
- Phase ordering is approximate; items may be reordered based on user feedback
- Some features may be bundled or split based on implementation complexity
