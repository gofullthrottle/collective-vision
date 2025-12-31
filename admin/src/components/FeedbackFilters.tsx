import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Filter, X, Search } from 'lucide-react';
import type { FeedbackStatus, ModerationState } from '@/types/feedback';

interface FeedbackFiltersProps {
  status: FeedbackStatus[];
  moderationState: ModerationState[];
  search: string;
  onStatusChange: (status: FeedbackStatus[]) => void;
  onModerationStateChange: (state: ModerationState[]) => void;
  onSearchChange: (search: string) => void;
  onClearAll: () => void;
}

const statusOptions: { value: FeedbackStatus; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'planned', label: 'Planned' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'done', label: 'Done' },
  { value: 'declined', label: 'Declined' },
];

const moderationOptions: { value: ModerationState; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

export function FeedbackFilters({
  status,
  moderationState,
  search,
  onStatusChange,
  onModerationStateChange,
  onSearchChange,
  onClearAll,
}: FeedbackFiltersProps) {
  const activeFilterCount = status.length + moderationState.length + (search ? 1 : 0);

  const toggleStatus = (value: FeedbackStatus) => {
    if (status.includes(value)) {
      onStatusChange(status.filter((s) => s !== value));
    } else {
      onStatusChange([...status, value]);
    }
  };

  const toggleModerationState = (value: ModerationState) => {
    if (moderationState.includes(value)) {
      onModerationStateChange(moderationState.filter((s) => s !== value));
    } else {
      onModerationStateChange([...moderationState, value]);
    }
  };

  return (
    <div className="flex items-center gap-3">
      {/* Search Input */}
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search feedback..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Status Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Filter className="h-4 w-4" />
            Status
            {status.length > 0 && (
              <Badge variant="secondary" className="ml-1 rounded-sm px-1 font-normal">
                {status.length}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          {statusOptions.map((option) => (
            <DropdownMenuCheckboxItem
              key={option.value}
              checked={status.includes(option.value)}
              onCheckedChange={() => toggleStatus(option.value)}
            >
              {option.label}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Moderation State Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Filter className="h-4 w-4" />
            Moderation
            {moderationState.length > 0 && (
              <Badge variant="secondary" className="ml-1 rounded-sm px-1 font-normal">
                {moderationState.length}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          {moderationOptions.map((option) => (
            <DropdownMenuCheckboxItem
              key={option.value}
              checked={moderationState.includes(option.value)}
              onCheckedChange={() => toggleModerationState(option.value)}
            >
              {option.label}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Clear Filters */}
      {activeFilterCount > 0 && (
        <Button variant="ghost" size="sm" onClick={onClearAll} className="gap-2">
          <X className="h-4 w-4" />
          Clear ({activeFilterCount})
        </Button>
      )}
    </div>
  );
}
