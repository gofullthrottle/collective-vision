# Phase 3: Admin UI

**Total Effort**: 10 hours
**Agent**: Fullstack Specialist
**Wave**: 3-4 (Starts after Phase 2 API)
**Priority**: P0 - Required for moderation workflow

---

## Technology Stack

- **Framework**: React 18 + TypeScript
- **Build**: Vite
- **Styling**: Tailwind CSS + shadcn/ui
- **Routing**: React Router 6
- **State**: React Query (TanStack Query)
- **Deployment**: Cloudflare Pages

---

## Epic 3.1: Project Setup (1.5h)

### Task 3.1.1: Initialize Vite + React Project (30min)
**Description**: Create the admin UI project with proper configuration.

**Acceptance Criteria**:
- [ ] Create `/admin` directory with Vite + React + TypeScript
- [ ] Configure Tailwind CSS
- [ ] Install shadcn/ui CLI and configure
- [ ] Set up path aliases (@/components, @/lib, etc.)
- [ ] Create basic folder structure

**Commands**:
```bash
cd /path/to/project
mkdir admin && cd admin
npm create vite@latest . -- --template react-ts
npm install
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
npm install @tanstack/react-query react-router-dom
npx shadcn@latest init
```

**Folder Structure**:
```
admin/
├── src/
│   ├── components/
│   │   ├── ui/          # shadcn components
│   │   └── shared/      # Custom shared components
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── Feedback.tsx
│   │   ├── Tags.tsx
│   │   └── Settings.tsx
│   ├── lib/
│   │   ├── api.ts       # API client
│   │   └── utils.ts     # Utility functions
│   ├── hooks/           # Custom hooks
│   ├── types/           # TypeScript types
│   ├── App.tsx
│   └── main.tsx
├── tailwind.config.js
├── vite.config.ts
└── package.json
```

**Dependencies**: None (can start immediately)

---

### Task 3.1.2: Configure shadcn/ui Components (30min)
**Description**: Install required shadcn components.

**Acceptance Criteria**:
- [ ] Install: button, input, table, badge, dropdown-menu, dialog, toast
- [ ] Install: card, tabs, select, checkbox, form
- [ ] Configure dark mode support
- [ ] Set up cn() utility for class merging

**Commands**:
```bash
npx shadcn@latest add button input table badge dropdown-menu dialog toast
npx shadcn@latest add card tabs select checkbox form avatar
npx shadcn@latest add skeleton separator sheet command
```

**Dependencies**: Task 3.1.1

---

### Task 3.1.3: Auth Layer & API Client (30min)
**Description**: Implement authentication and API client.

**Acceptance Criteria**:
- [ ] API key stored in localStorage
- [ ] Login page if no API key
- [ ] API client with automatic auth header
- [ ] React Query setup with error handling
- [ ] Logout functionality

**Files**:
- `admin/src/lib/api.ts`
- `admin/src/lib/auth.ts`
- `admin/src/pages/Login.tsx`

**Code - api.ts**:
```typescript
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8787';

export function getApiKey(): string | null {
  return localStorage.getItem('cv_admin_api_key');
}

export function setApiKey(key: string): void {
  localStorage.setItem('cv_admin_api_key', key);
}

export function clearApiKey(): void {
  localStorage.removeItem('cv_admin_api_key');
}

export async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('Not authenticated');

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
      ...options.headers,
    },
  });

  if (res.status === 401) {
    clearApiKey();
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'API Error');
  }

  return res.json();
}
```

**Dependencies**: Task 3.1.2

---

## Epic 3.2: Dashboard Overview (2h)

### Task 3.2.1: Layout Shell (45min)
**Description**: Create the main app layout with navigation.

**Acceptance Criteria**:
- [ ] Sidebar with navigation links
- [ ] Header with workspace selector and logout
- [ ] Main content area
- [ ] Mobile-responsive (collapsible sidebar)
- [ ] Dark mode toggle

**Files**:
- `admin/src/components/Layout.tsx`
- `admin/src/components/Sidebar.tsx`
- `admin/src/components/Header.tsx`

**Layout Structure**:
```tsx
export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
```

**Dependencies**: Task 3.1.3

---

### Task 3.2.2: Dashboard Stats Cards (45min)
**Description**: Create the dashboard with key metrics.

**Acceptance Criteria**:
- [ ] Total feedback count
- [ ] Pending moderation count
- [ ] Approved today count
- [ ] Top voted this week
- [ ] Loading skeletons while fetching

**Files**:
- `admin/src/pages/Dashboard.tsx`
- `admin/src/components/StatCard.tsx`

**API Endpoint Needed** (add to Phase 2 if missing):
```
GET /api/v1/admin/workspaces/:workspace/stats
Returns: { total, pending, approved_today, top_voted }
```

**Component**:
```tsx
function StatCard({ title, value, icon, trend }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {trend && (
          <p className="text-xs text-muted-foreground mt-1">{trend}</p>
        )}
      </CardContent>
    </Card>
  );
}
```

**Dependencies**: Task 3.2.1

---

### Task 3.2.3: Recent Activity Feed (30min)
**Description**: Show recent feedback activity on dashboard.

**Acceptance Criteria**:
- [ ] Last 10 feedback items with status
- [ ] Click to navigate to detail
- [ ] Relative timestamps (2 hours ago)
- [ ] Status badges

**Files**:
- `admin/src/components/ActivityFeed.tsx`

**Dependencies**: Task 3.2.2

---

## Epic 3.3: Feedback List View (3h)

### Task 3.3.1: Data Table Component (1h)
**Description**: Create the feedback list with shadcn table.

**Acceptance Criteria**:
- [ ] Sortable columns (title, votes, status, created)
- [ ] Row selection with checkboxes
- [ ] Status and moderation badges
- [ ] Vote count display
- [ ] Loading state with skeletons

**Files**:
- `admin/src/pages/Feedback.tsx`
- `admin/src/components/FeedbackTable.tsx`

**Table Columns**:
```tsx
const columns: ColumnDef<FeedbackItem>[] = [
  {
    id: "select",
    header: ({ table }) => <Checkbox ... />,
    cell: ({ row }) => <Checkbox ... />,
  },
  {
    accessorKey: "title",
    header: "Title",
    cell: ({ row }) => (
      <div>
        <p className="font-medium">{row.original.title}</p>
        <p className="text-sm text-muted-foreground truncate max-w-md">
          {row.original.description}
        </p>
      </div>
    ),
  },
  {
    accessorKey: "vote_count",
    header: ({ column }) => <SortableHeader column={column} title="Votes" />,
    cell: ({ row }) => (
      <Badge variant="secondary">{row.original.vote_count}</Badge>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    accessorKey: "moderation_state",
    header: "Moderation",
    cell: ({ row }) => <ModerationBadge state={row.original.moderation_state} />,
  },
  {
    accessorKey: "created_at",
    header: "Created",
    cell: ({ row }) => formatRelativeTime(row.original.created_at),
  },
  {
    id: "actions",
    cell: ({ row }) => <RowActions item={row.original} />,
  },
];
```

**Dependencies**: Task 3.2.1

---

### Task 3.3.2: Filter Controls (1h)
**Description**: Add filtering UI for the feedback list.

**Acceptance Criteria**:
- [ ] Status dropdown (multi-select)
- [ ] Moderation state filter
- [ ] Board selector
- [ ] Search input
- [ ] Clear all filters button
- [ ] URL sync (filters in query params)

**Files**:
- `admin/src/components/FeedbackFilters.tsx`

**Component**:
```tsx
function FeedbackFilters({ filters, onChange }: FiltersProps) {
  return (
    <div className="flex flex-wrap gap-4 mb-4">
      <Select
        value={filters.status}
        onValueChange={(v) => onChange({ ...filters, status: v })}
      >
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          <SelectItem value="open">Open</SelectItem>
          <SelectItem value="planned">Planned</SelectItem>
          <SelectItem value="in_progress">In Progress</SelectItem>
          <SelectItem value="done">Done</SelectItem>
          <SelectItem value="declined">Declined</SelectItem>
        </SelectContent>
      </Select>

      <Select value={filters.moderation} ...>
        ...
      </Select>

      <Input
        placeholder="Search..."
        value={filters.search}
        onChange={(e) => onChange({ ...filters, search: e.target.value })}
        className="w-64"
      />

      <Button variant="ghost" onClick={() => onChange({})}>
        Clear filters
      </Button>
    </div>
  );
}
```

**Dependencies**: Task 3.3.1

---

### Task 3.3.3: Pagination (1h)
**Description**: Add pagination to the feedback list.

**Acceptance Criteria**:
- [ ] Page size selector (10, 20, 50)
- [ ] Previous/Next buttons
- [ ] Page number display
- [ ] Total count display
- [ ] Keyboard navigation

**Files**:
- `admin/src/components/Pagination.tsx`

**Dependencies**: Task 3.3.2

---

## Epic 3.4: Inline Editing & Actions (2h)

### Task 3.4.1: Status Dropdown Editor (45min)
**Description**: Enable inline status editing in the table.

**Acceptance Criteria**:
- [ ] Click status badge to open dropdown
- [ ] Select new status, save immediately
- [ ] Optimistic update with rollback on error
- [ ] Toast notification on save

**Files**:
- `admin/src/components/StatusEditor.tsx`

**Component**:
```tsx
function StatusEditor({ item, onUpdate }: StatusEditorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const mutation = useMutation({
    mutationFn: (status: string) =>
      api(`/api/v1/admin/workspaces/${workspace}/feedback/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      toast.success('Status updated');
      queryClient.invalidateQueries(['feedback']);
    },
  });

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-auto p-1">
          <StatusBadge status={item.status} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {STATUSES.map((status) => (
          <DropdownMenuItem
            key={status}
            onClick={() => mutation.mutate(status)}
          >
            <StatusBadge status={status} />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

**Dependencies**: Task 3.3.1

---

### Task 3.4.2: Moderation Actions (45min)
**Description**: Add approve/reject buttons with animations.

**Acceptance Criteria**:
- [ ] Approve button (green checkmark)
- [ ] Reject button (red X)
- [ ] Confirmation for reject
- [ ] Success animation on action
- [ ] Bulk actions for selected rows

**Files**:
- `admin/src/components/ModerationActions.tsx`

**Dependencies**: Task 3.4.1

---

### Task 3.4.3: Bulk Action Toolbar (30min)
**Description**: Show action toolbar when rows are selected.

**Acceptance Criteria**:
- [ ] Shows when 1+ rows selected
- [ ] Displays count of selected
- [ ] Actions: Approve All, Reject All, Set Status, Add Tag
- [ ] Confirmation dialog for destructive actions

**Files**:
- `admin/src/components/BulkActionBar.tsx`

**Component**:
```tsx
function BulkActionBar({ selectedIds, onAction }: BulkActionBarProps) {
  if (selectedIds.length === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground rounded-lg shadow-lg p-4 flex items-center gap-4">
      <span>{selectedIds.length} selected</span>
      <Button size="sm" variant="secondary" onClick={() => onAction('approve')}>
        <Check className="w-4 h-4 mr-2" /> Approve
      </Button>
      <Button size="sm" variant="secondary" onClick={() => onAction('reject')}>
        <X className="w-4 h-4 mr-2" /> Reject
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="secondary">
            Set Status <ChevronDown className="w-4 h-4 ml-2" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {STATUSES.map((status) => (
            <DropdownMenuItem
              key={status}
              onClick={() => onAction('set_status', status)}
            >
              {status}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
```

**Dependencies**: Task 3.4.2

---

## Epic 3.5: Settings & Config (1.5h)

### Task 3.5.1: Settings Page Layout (45min)
**Description**: Create settings page with sections.

**Acceptance Criteria**:
- [ ] Workspace info section
- [ ] API key management section
- [ ] Board management section
- [ ] Tab or accordion navigation

**Files**:
- `admin/src/pages/Settings.tsx`

**Dependencies**: Task 3.2.1

---

### Task 3.5.2: Tag Management UI (45min)
**Description**: Create UI for managing tags.

**Acceptance Criteria**:
- [ ] List all tags with color preview
- [ ] Create new tag with name and color picker
- [ ] Edit existing tags inline
- [ ] Delete with confirmation
- [ ] Show usage count per tag

**Files**:
- `admin/src/pages/Tags.tsx`
- `admin/src/components/TagEditor.tsx`

**Dependencies**: Task 3.5.1

---

## Phase 3 Completion Checklist

- [ ] Login flow works with API key
- [ ] Dashboard shows key metrics
- [ ] Feedback list loads with filters and pagination
- [ ] Inline status editing works
- [ ] Moderation actions (approve/reject) work
- [ ] Bulk actions work for selected items
- [ ] Tag management is functional
- [ ] Mobile responsive layout
- [ ] Deploys to Cloudflare Pages

---

**Next Phase**: Phase 4 (Landing Page) and Phase 5 (Comments) can start
