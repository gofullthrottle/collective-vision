import { useMemo } from 'react';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type OnChangeFn,
} from '@tanstack/react-table';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowUpDown } from 'lucide-react';
import { StatusEditor } from './StatusEditor';
import { ModerationActions } from './ModerationActions';
import type { FeedbackItem } from '@/types/feedback';

interface FeedbackTableProps {
  data: FeedbackItem[];
  workspace: string;
  sorting: SortingState;
  onSortingChange: OnChangeFn<SortingState>;
  selectedIds: number[];
  onSelectedIdsChange: (ids: number[]) => void;
}

export function FeedbackTable({
  data,
  workspace,
  sorting,
  onSortingChange,
  selectedIds,
  onSelectedIdsChange,
}: FeedbackTableProps) {
  const columns = useMemo<ColumnDef<FeedbackItem>[]>(
    () => [
      {
        id: 'select',
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            onCheckedChange={(value) => {
              table.toggleAllPageRowsSelected(!!value);
              if (value) {
                onSelectedIdsChange(data.map((row) => row.id));
              } else {
                onSelectedIdsChange([]);
              }
            }}
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={selectedIds.includes(row.original.id)}
            onCheckedChange={(value) => {
              if (value) {
                onSelectedIdsChange([...selectedIds, row.original.id]);
              } else {
                onSelectedIdsChange(selectedIds.filter((id) => id !== row.original.id));
              }
            }}
            aria-label="Select row"
          />
        ),
        enableSorting: false,
      },
      {
        accessorKey: 'title',
        header: ({ column }) => (
          <button
            className="flex items-center gap-2 hover:text-foreground"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Title
            <ArrowUpDown className="h-4 w-4" />
          </button>
        ),
        cell: ({ row }) => (
          <div className="max-w-md">
            <div className="font-medium truncate">{row.original.title}</div>
            {row.original.description && (
              <div className="text-sm text-muted-foreground truncate mt-1">
                {row.original.description}
              </div>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'vote_count',
        header: ({ column }) => (
          <button
            className="flex items-center gap-2 hover:text-foreground"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Votes
            <ArrowUpDown className="h-4 w-4" />
          </button>
        ),
        cell: ({ row }) => (
          <div className="font-medium">{row.original.vote_count}</div>
        ),
      },
      {
        accessorKey: 'status',
        header: ({ column }) => (
          <button
            className="flex items-center gap-2 hover:text-foreground"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Status
            <ArrowUpDown className="h-4 w-4" />
          </button>
        ),
        cell: ({ row }) => <StatusEditor item={row.original} workspace={workspace} />,
      },
      {
        accessorKey: 'moderation_state',
        header: ({ column }) => (
          <button
            className="flex items-center gap-2 hover:text-foreground"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Moderation
            <ArrowUpDown className="h-4 w-4" />
          </button>
        ),
        cell: ({ row }) => <ModerationActions item={row.original} workspace={workspace} />,
      },
      {
        accessorKey: 'created_at',
        header: ({ column }) => (
          <button
            className="flex items-center gap-2 hover:text-foreground"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Created
            <ArrowUpDown className="h-4 w-4" />
          </button>
        ),
        cell: ({ row }) => (
          <div className="text-sm text-muted-foreground">
            {new Date(row.original.created_at).toLocaleDateString()}
          </div>
        ),
      },
    ],
    [data, workspace, selectedIds, onSelectedIdsChange]
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    state: {
      sorting,
    },
    onSortingChange,
  });

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table className="min-w-[700px]">
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id} data-state={selectedIds.includes(row.original.id) && 'selected'}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                No feedback found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
