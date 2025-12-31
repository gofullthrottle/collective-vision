import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  total: number;
  limit: number;
  offset: number;
  onLimitChange: (limit: number) => void;
  onOffsetChange: (offset: number) => void;
}

export function Pagination({ total, limit, offset, onLimitChange, onOffsetChange }: PaginationProps) {
  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit);

  const handlePrevious = () => {
    if (offset >= limit) {
      onOffsetChange(offset - limit);
    }
  };

  const handleNext = () => {
    if (offset + limit < total) {
      onOffsetChange(offset + limit);
    }
  };

  return (
    <div className="flex items-center justify-between px-2">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Rows per page:</span>
        <Select
          value={limit.toString()}
          onValueChange={(value) => {
            onLimitChange(Number(value));
            onOffsetChange(0); // Reset to first page
          }}
        >
          <SelectTrigger className="h-8 w-[70px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="10">10</SelectItem>
            <SelectItem value="20">20</SelectItem>
            <SelectItem value="50">50</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-6">
        <span className="text-sm text-muted-foreground">
          Page {currentPage} of {totalPages} ({total} total)
        </span>

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrevious}
            disabled={offset === 0}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleNext}
            disabled={offset + limit >= total}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
