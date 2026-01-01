# Wave 4: Analytics & Integrations

**Duration**: 16-22 hours
**Dependencies**: Wave 1 (needs auth for user tracking)
**Priority**: Medium (enhances value prop but not core)

---

## Epic 4.1: User Analytics Breakdowns (6h)

### Tasks

#### 4.1.1 Voter Demographics (1.5h)
- [ ] Track user metadata when available
- [ ] Store plan/tier if identifiable
- [ ] Aggregate by:
  - User tenure (new vs returning)
  - Vote frequency (power users)
  - Feedback submission rate
- [ ] Privacy-respecting aggregation

**Database:**
```sql
CREATE TABLE user_analytics (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  date TEXT NOT NULL,
  new_voters INTEGER DEFAULT 0,
  returning_voters INTEGER DEFAULT 0,
  total_votes INTEGER DEFAULT 0,
  total_submissions INTEGER DEFAULT 0,
  UNIQUE(workspace_id, date)
);
```

**Acceptance Criteria:**
- Daily aggregates computed
- No PII exposed
- Historical data preserved

#### 4.1.2 Power User Identification (1.5h)
- [ ] Define power user criteria:
  - 10+ votes in last 30 days
  - 3+ feedback submissions
- [ ] List power users per workspace
- [ ] Track engagement over time
- [ ] Segment for targeting

**API:**
```json
GET /api/v1/workspaces/:id/analytics/power-users

{
  "power_users": [
    {
      "user_id": "...",
      "votes_30d": 25,
      "submissions_30d": 5,
      "first_seen": "2024-01-01"
    }
  ],
  "total_count": 45
}
```

**Acceptance Criteria:**
- Power users accurately identified
- List available to admins
- Can export for outreach

#### 4.1.3 Engagement Metrics per User (1.5h)
- [ ] Per-user stats in admin
- [ ] Vote history
- [ ] Submission history
- [ ] Activity timeline

**Acceptance Criteria:**
- User detail view in admin
- Activity chronologically ordered
- Search by user

#### 4.1.4 Cohort Analysis (1.5h)
- [ ] Group users by first activity date
- [ ] Track retention by cohort
- [ ] Visualize cohort table
- [ ] Export cohort data

**Acceptance Criteria:**
- Weekly cohorts computed
- Retention visible
- Actionable insights

---

## Epic 4.2: Feedback Trends Over Time (5h)

### Tasks

#### 4.2.1 Time-Series Data Collection (1.5h)
- [ ] Daily aggregates for:
  - New feedback count
  - Vote activity
  - Comment activity
  - Status changes
- [ ] Store historical data indefinitely
- [ ] Compute on schedule or on-demand

**Database:**
```sql
CREATE TABLE daily_metrics (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  board_id TEXT,
  date TEXT NOT NULL,
  new_feedback INTEGER DEFAULT 0,
  votes_cast INTEGER DEFAULT 0,
  comments_added INTEGER DEFAULT 0,
  status_open INTEGER DEFAULT 0,
  status_planned INTEGER DEFAULT 0,
  status_done INTEGER DEFAULT 0,
  UNIQUE(workspace_id, board_id, date)
);
```

**Acceptance Criteria:**
- Metrics computed daily
- Backfill historical data
- Query efficient

#### 4.2.2 Trend Detection Algorithm (1.5h)
- [ ] Compare current period to previous
- [ ] Identify rising/falling topics
- [ ] Statistical significance testing
- [ ] Anomaly detection (z-score > 2)

**Algorithm:**
```typescript
function detectTrend(
  current: number[],
  previous: number[]
): 'rising' | 'stable' | 'falling' {
  const currentAvg = avg(current);
  const previousAvg = avg(previous);
  const change = (currentAvg - previousAvg) / previousAvg;

  if (change > 0.2) return 'rising';
  if (change < -0.2) return 'falling';
  return 'stable';
}
```

**Acceptance Criteria:**
- Trends accurately detected
- False positives minimized
- Alerts for anomalies

#### 4.2.3 Comparison Views (1h)
- [ ] This week vs last week
- [ ] This month vs last month
- [ ] This quarter vs last quarter
- [ ] Custom date range comparison

**API:**
```json
GET /api/v1/workspaces/:id/analytics/compare?
  period=week&current=2024-W45&previous=2024-W44

{
  "current": {
    "feedback": 45,
    "votes": 230
  },
  "previous": {
    "feedback": 38,
    "votes": 180
  },
  "change": {
    "feedback": "+18%",
    "votes": "+28%"
  }
}
```

**Acceptance Criteria:**
- Comparisons accurate
- Percentage changes calculated
- Visual indicators

#### 4.2.4 Trend Visualization (1h)
- [ ] Line charts for metrics over time
- [ ] Sparklines for quick view
- [ ] Interactive date range selection
- [ ] Export charts as images

**Acceptance Criteria:**
- Charts render correctly
- Interactive and responsive
- Useful at a glance

---

## Epic 4.3: Third-Party Analytics Integration (5h)

### Tasks

#### 4.3.1 Google Analytics 4 Integration (2h)
- [ ] Measurement ID configuration in admin
- [ ] Widget sends events to GA4:
  - `feedback_view`
  - `feedback_submit`
  - `feedback_vote`
  - `board_view`
- [ ] gtag.js integration
- [ ] Privacy compliance (consent)

**Admin Config:**
```json
{
  "analytics": {
    "google_analytics": {
      "measurement_id": "G-XXXXXXXXXX",
      "enabled": true
    }
  }
}
```

**Acceptance Criteria:**
- Events appear in GA4
- Consent respected
- No performance impact

#### 4.3.2 Microsoft Clarity Integration (1.5h)
- [ ] Clarity project ID configuration
- [ ] Script injection in widget
- [ ] Session recordings enabled
- [ ] Heatmaps functional

**Acceptance Criteria:**
- Clarity recording sessions
- Heatmaps visible
- No PII captured

#### 4.3.3 Custom Tracking Pixel Support (1h)
- [ ] Allow custom JavaScript in widget
- [ ] Pixel configuration UI
- [ ] Common pixel templates:
  - Facebook Pixel
  - LinkedIn Insight
  - Custom

**Acceptance Criteria:**
- Pixels fire correctly
- Templates easy to use
- Custom code sandboxed

#### 4.3.4 Event Tracking API (0.5h)
- [ ] Internal event tracking endpoint
- [ ] Track custom events from admin actions
- [ ] Forward to configured analytics

**Acceptance Criteria:**
- Events captured server-side
- Forwarded to external providers
- Queryable internally

---

## Epic 4.4: Export Reports (4h)

### Tasks

#### 4.4.1 CSV Export (1h)
- [ ] Export all feedback to CSV
- [ ] Include all fields
- [ ] Filter before export
- [ ] Large export handling (streaming)

**API:**
```
GET /api/v1/workspaces/:id/export/csv?
  status=open,planned&created_after=2024-01-01

Response: CSV file download
```

**Acceptance Criteria:**
- All data exportable
- Filters respected
- Large exports don't timeout

#### 4.4.2 PDF Report Generation (1.5h)
- [ ] Summary report template
- [ ] Include charts and tables
- [ ] Customizable date range
- [ ] Branding (logo, colors)

**Report Sections:**
1. Executive Summary
2. Key Metrics
3. Top Feedback
4. Theme Analysis
5. Trend Overview

**Acceptance Criteria:**
- Professional PDF output
- Charts rendered correctly
- Printable format

#### 4.4.3 Scheduled Reports (1h)
- [ ] Configure recurring reports
- [ ] Daily, weekly, monthly options
- [ ] Email delivery
- [ ] Report history

**Admin Config:**
```json
{
  "scheduled_reports": [
    {
      "id": "...",
      "frequency": "weekly",
      "day": "monday",
      "recipients": ["pm@company.com"],
      "format": "pdf"
    }
  ]
}
```

**Acceptance Criteria:**
- Reports generated on schedule
- Emails delivered
- Can be paused/cancelled

#### 4.4.4 Report API Endpoint (0.5h)
- [ ] Programmatic report generation
- [ ] Return URL to download
- [ ] Webhook on completion

**API:**
```json
POST /api/v1/workspaces/:id/reports
{
  "type": "summary",
  "date_range": ["2024-01-01", "2024-12-31"],
  "format": "pdf"
}

Response:
{
  "report_id": "...",
  "status": "generating",
  "download_url": null
}
```

**Acceptance Criteria:**
- Reports generatable via API
- Status queryable
- URL provided when ready

---

## Epic 4.5: Dashboard Enhancements (2h)

### Tasks

#### 4.5.1 Real-Time Updates (1h)
- [ ] Polling for new data (5-second intervals)
- [ ] Visual indicator for new items
- [ ] Auto-refresh toggle
- [ ] Notifications for important events

**Acceptance Criteria:**
- Dashboard updates without refresh
- New items highlighted
- Can disable auto-refresh

#### 4.5.2 Customizable Widgets (0.5h)
- [ ] Widget-based dashboard layout
- [ ] Add/remove widgets
- [ ] Widget types:
  - Metrics summary
  - Recent feedback
  - Theme distribution
  - Trend chart

**Acceptance Criteria:**
- Widgets configurable
- Layout persisted
- Responsive on mobile

#### 4.5.3 Saved Filters and Views (0.5h)
- [ ] Save current filter configuration
- [ ] Name and recall views
- [ ] Share views with team

**Acceptance Criteria:**
- Filters saveable
- Views listed in sidebar
- Shareable via link

---

## Definition of Done for Wave 4

- [ ] User analytics available in admin
- [ ] Feedback trends charted
- [ ] GA4 and Clarity integrations working
- [ ] CSV and PDF exports functional
- [ ] Dashboard real-time updates working
- [ ] Saved views feature complete

---

## Estimated Breakdown

| Epic | Hours | Complexity |
|------|-------|------------|
| 4.1 User Analytics | 6h | Medium |
| 4.2 Feedback Trends | 5h | Medium |
| 4.3 Third-Party Analytics | 5h | Medium |
| 4.4 Export Reports | 4h | Medium |
| 4.5 Dashboard Enhancements | 2h | Low |

**Total: 22h (optimistic: 16h)**
