# Dashboard Component Tree

```
App.tsx
└── QueryClientProvider
    └── BrowserRouter
        └── ProtectedRoute
            └── Layout
                ├── Sidebar
                │   ├── Desktop Sidebar (hidden on mobile)
                │   │   └── SidebarContent
                │   │       ├── Navigation Links
                │   │       │   ├── Dashboard (/)
                │   │       │   ├── Feedback (/feedback)
                │   │       │   ├── Tags (/tags)
                │   │       │   └── Settings (/settings)
                │   │       └── Logout Button
                │   └── Mobile Sheet (visible on mobile)
                │       └── SheetTrigger (Hamburger Button)
                │           └── SheetContent
                │               └── SidebarContent (same as desktop)
                ├── Header
                │   ├── Title ("Admin Dashboard")
                │   └── Dark Mode Toggle (Moon/Sun Button)
                └── Main Content Area
                    └── Dashboard (page)
                        ├── Page Header
                        │   ├── Title ("Dashboard")
                        │   └── Description
                        ├── Error Alert (conditional)
                        ├── Stats Grid (4 columns on desktop)
                        │   ├── StatCard - Total Feedback
                        │   │   ├── Icon (MessageSquare)
                        │   │   ├── Value (loading: Skeleton)
                        │   │   └── Description
                        │   ├── StatCard - Pending Moderation
                        │   │   ├── Icon (Clock)
                        │   │   ├── Value (loading: Skeleton)
                        │   │   └── Description
                        │   ├── StatCard - Approved Today
                        │   │   ├── Icon (CheckCircle)
                        │   │   ├── Value (loading: Skeleton)
                        │   │   └── Description
                        │   └── StatCard - Top Voted
                        │       ├── Icon (TrendingUp)
                        │       ├── Value (loading: Skeleton)
                        │       └── Description (title preview)
                        └── ActivityFeed
                            ├── Card Header
                            │   ├── Title ("Recent Activity")
                            │   └── Description
                            └── Card Content
                                ├── Loading State: 5x Skeleton Items
                                ├── Empty State: "No feedback items yet"
                                └── Feedback Items List (up to 10)
                                    └── FeedbackItem (clickable)
                                        ├── Status Indicator (colored dot)
                                        ├── Title (truncated)
                                        ├── Badges
                                        │   ├── Status Badge
                                        │   ├── Moderation Badge
                                        │   └── Vote Count Badge (if > 0)
                                        └── Timestamp + Author
```

## Data Flow

```
Component              React Query Hook              API Endpoint
─────────────────────  ────────────────────────────  ────────────────────────────────────
Dashboard              useQuery('dashboard-stats')   GET /api/v1/admin/workspaces/:workspace/stats
  ├── StatCard (x4)    └─> DashboardStats           └─> { totalFeedback, pendingModeration, ... }
  │
  └── ActivityFeed     useQuery('recent-feedback')   GET /api/v1/admin/workspaces/:workspace/feedback/recent?limit=10
      └── Items        └─> FeedbackItem[]            └─> [{ id, title, status, ... }]
```

## Component Dependencies

```
Dashboard.tsx
├── @tanstack/react-query (useQuery)
├── @/lib/api (api helper)
├── @/types/api (DashboardStats, FeedbackItem)
├── StatCard.tsx
│   ├── lucide-react (LucideIcon type)
│   ├── @/components/ui/card
│   └── @/components/ui/skeleton
├── ActivityFeed.tsx
│   ├── date-fns (formatDistanceToNow)
│   ├── react-router-dom (useNavigate)
│   ├── @/types/api (FeedbackItem)
│   ├── @/components/ui/card
│   ├── @/components/ui/badge
│   └── @/components/ui/skeleton
└── @/components/ui/alert

Layout.tsx
├── Sidebar.tsx
│   ├── react-router-dom (Link, useLocation)
│   ├── lucide-react (icons)
│   ├── @/lib/api (clearApiKey)
│   ├── @/components/ui/button
│   └── @/components/ui/sheet
├── lucide-react (Moon, Sun)
└── @/components/ui/button
```

## State Management

| State | Location | Persistence | Purpose |
|-------|----------|-------------|---------|
| `isDark` | Layout.tsx | localStorage ('theme') | Dark mode preference |
| `open` | Sidebar.tsx | React state (ephemeral) | Mobile menu open/closed |
| Dashboard stats | React Query cache | 30s stale time | Stats data |
| Recent feedback | React Query cache | 30s stale time | Activity feed data |
| API key | localStorage | Persistent | Authentication token |

## Responsive Breakpoints

| Screen Size | Sidebar | Stats Grid | Behavior |
|-------------|---------|------------|----------|
| < 768px (mobile) | Sheet drawer | 1 column | Hamburger menu, collapsible |
| 768px - 1023px (tablet) | Fixed | 2 columns | Sidebar always visible |
| ≥ 1024px (desktop) | Fixed | 4 columns | Full layout |

## API Call Pattern

```typescript
// React Query fetches data
useQuery<DashboardStats>({
  queryKey: ['dashboard-stats', 'default'],
  queryFn: () => api<DashboardStats>('/api/v1/admin/workspaces/default/stats'),
  refetchInterval: 30000  // Auto-refresh every 30s
});

// api() helper adds auth
const api = async <T>(path: string) => {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('Not authenticated');

  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'X-Admin-Token': apiKey,
      'Content-Type': 'application/json'
    }
  });

  if (res.status === 401) {
    clearApiKey();
    window.location.href = '/login';
  }

  return res.json();
};
```
