import { useState, type ReactNode } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  InputAdornment,
  InputLabel,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import SearchIcon from '@mui/icons-material/Search';
import { InlineAudioRegenerator } from '../AudioRegenerator';
import { renderSelectOptions } from '../selectOptions';
import type { AudioType } from '../../lib/audioGeneration';
import { foldForSearch, matchesSearch } from '../../lib/utils/foldForSearch';
import capitalize from '../../lib/utils/capitalize';
import type { CustomItemBase } from '../../types/customItems';
import { useAuthContext } from '../../contexts/AuthContext';
import {
  ActionCell,
  AddButton,
  CountBadge,
  EmptyContainer,
  FilterSelect,
  FiltersRow,
  HeaderSection,
  LoadingContainer,
  PageContainer,
  SearchField,
  StyledTableContainer,
  TitleGroup,
} from './styles';
import { byCreatedAt, sortItems, useSortState } from './useSortState';
import { usePagination } from './usePagination';
import type { CustomItemPageController } from './useCustomItemPage';

type AudioItem = CustomItemBase & { audioUrl?: string };

export interface CustomItemColumn<T> {
  label: string;
  render: (item: T) => ReactNode;
  /** Makes the column sortable. */
  compare?: (a: T, b: T) => number;
}

export interface CustomItemFilter<T> {
  label: string;
  options: readonly string[];
  value: (item: T) => string | undefined;
  format?: (option: string) => string;
}

interface CustomItemPageProps<T extends AudioItem> {
  title: string;
  subtitle: string;
  emptyTitle: string;
  emptyDescription: string;
  page: CustomItemPageController<T>;
  /** Shown before the Added column, which every page ends with and is sorted by at first. */
  columns: CustomItemColumn<T>[];
  filters?: CustomItemFilter<T>[];
  searchFields: (item: T) => Array<string | undefined>;
  audio: { type: AudioType; text: (item: T) => string };
  canReprioritize: (id: string) => boolean;
  onReprioritize: (id: string) => void;
  /** The add and edit dialog. */
  children: ReactNode;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const ADDED_COLUMN: CustomItemColumn<CustomItemBase> = {
  label: 'Added',
  compare: byCreatedAt,
  render: (item) => (
    <Typography variant="body2" color="text.secondary">
      {formatDate(item.createdAt)}
    </Typography>
  ),
};

/** A "My …" page: the learner's own items in a searchable, filterable, sortable table. */
export function CustomItemPage<T extends AudioItem>({
  title,
  subtitle,
  emptyTitle,
  emptyDescription,
  page,
  columns,
  filters = [],
  searchFields,
  audio,
  canReprioritize,
  onReprioritize,
  children,
}: CustomItemPageProps<T>) {
  const { isAdmin } = useAuthContext();
  const { items, noun } = page;
  const Noun = capitalize(noun);

  if (page.loading) {
    return (
      <PageContainer>
        <LoadingContainer>
          <CircularProgress sx={{ color: 'text.disabled' }} />
        </LoadingContainer>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <HeaderSection>
        <TitleGroup>
          <Typography variant="h5" fontWeight={600}>
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        </TitleGroup>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <CountBadge>{items.length}</CountBadge>
          <AddButton variant="contained" startIcon={<AddIcon />} onClick={page.openAdd}>
            Add {Noun}
          </AddButton>
        </Box>
      </HeaderSection>

      {items.length === 0 ? (
        <EmptyContainer>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            {emptyTitle}
          </Typography>
          <Typography variant="body2" color="text.disabled" sx={{ mb: 3, maxWidth: 320 }}>
            {emptyDescription}
          </Typography>
          <Button variant="outlined" startIcon={<AddIcon />} onClick={page.openAdd}>
            Add Your First {Noun}
          </Button>
        </EmptyContainer>
      ) : (
        <CustomItemTable
          page={page}
          columns={[...columns, ADDED_COLUMN]}
          filters={filters}
          searchFields={searchFields}
          audio={isAdmin ? audio : undefined}
          canReprioritize={canReprioritize}
          onReprioritize={onReprioritize}
        />
      )}

      {children}
      {page.confirmDialog}
    </PageContainer>
  );
}

interface CustomItemTableProps<T extends AudioItem> extends Pick<
  CustomItemPageProps<T>,
  'page' | 'searchFields' | 'canReprioritize' | 'onReprioritize'
> {
  columns: CustomItemColumn<T>[];
  filters: CustomItemFilter<T>[];
  /** Only admins get the audio column. */
  audio: CustomItemPageProps<T>['audio'] | undefined;
}

function CustomItemTable<T extends AudioItem>({
  page,
  columns,
  filters,
  searchFields,
  audio,
  canReprioritize,
  onReprioritize,
}: CustomItemTableProps<T>) {
  const { items, noun } = page;
  const [search, setSearch] = useState('');
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const sort = useSortState(ADDED_COLUMN.label);

  const comparators: Record<string, (a: T, b: T) => number> = {};
  for (const { label, compare } of columns) if (compare) comparators[label] = compare;

  const query = foldForSearch(search);
  const shown = sortItems(
    items.filter(
      (item) =>
        matchesSearch(query, ...searchFields(item)) &&
        filters.every((filter) => {
          const selected = filterValues[filter.label];
          return !selected || filter.value(item) === selected;
        })
    ),
    comparators,
    sort
  );
  const filtered = Boolean(search) || Object.values(filterValues).some(Boolean);

  const { paginatedItems, ...pagination } = usePagination(
    shown,
    JSON.stringify([search, filterValues, sort.sortField, sort.sortDirection])
  );

  return (
    <>
      <FiltersRow>
        <SearchField
          size="small"
          placeholder={`Search ${noun}s...`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" color="action" />
                </InputAdornment>
              ),
            },
          }}
        />
        {filters.map((filter) => (
          <FilterSelect key={filter.label} size="small">
            <InputLabel>{filter.label}</InputLabel>
            <Select
              value={filterValues[filter.label] ?? ''}
              onChange={(e) =>
                setFilterValues((current) => ({ ...current, [filter.label]: e.target.value }))
              }
              label={filter.label}
            >
              {renderSelectOptions(filter.options, 'All', filter.format)}
            </Select>
          </FilterSelect>
        ))}
        {filtered && (
          <Typography variant="body2" color="text.secondary">
            {shown.length} of {items.length} {noun}s
          </Typography>
        )}
      </FiltersRow>

      <StyledTableContainer elevation={0}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Actions</TableCell>
              {audio && <TableCell>Audio</TableCell>}
              {columns.map(({ label, compare }) => (
                <TableCell key={label}>
                  {compare ? (
                    <TableSortLabel
                      active={sort.sortField === label}
                      direction={sort.sortField === label ? sort.sortDirection : 'asc'}
                      onClick={() => sort.handleSort(label)}
                    >
                      {label}
                    </TableSortLabel>
                  ) : (
                    label
                  )}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedItems.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <ActionCell>
                    <IconButton
                      size="small"
                      onClick={() => page.openEdit(item)}
                      aria-label={`edit ${noun}`}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    {canReprioritize(item.id) && (
                      <Tooltip title="Review again">
                        <IconButton
                          size="small"
                          onClick={() => onReprioritize(item.id)}
                          aria-label={`review ${noun} again`}
                          sx={{ color: 'primary.main' }}
                        >
                          <RestartAltIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    <IconButton
                      size="small"
                      onClick={() => page.confirmDelete(item.id)}
                      aria-label={`delete ${noun}`}
                      sx={{ color: 'error.main' }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </ActionCell>
                </TableCell>
                {audio && (
                  <TableCell>
                    <InlineAudioRegenerator
                      text={audio.text(item)}
                      type={audio.type}
                      id={item.id}
                      currentAudioUrl={item.audioUrl}
                      onAudioSaved={(audioUrl) => page.setAudioUrl(item.id, audioUrl)}
                    />
                  </TableCell>
                )}
                {columns.map((column) => (
                  <TableCell key={column.label}>{column.render(item)}</TableCell>
                ))}
              </TableRow>
            ))}
            {shown.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length + (audio ? 2 : 1)} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">No {noun}s match your filters</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </StyledTableContainer>
      <TablePagination
        component="div"
        count={pagination.count}
        page={pagination.page}
        rowsPerPage={pagination.rowsPerPage}
        rowsPerPageOptions={[10, 25, 50]}
        onPageChange={(_, nextPage) => pagination.onPageChange(nextPage)}
        onRowsPerPageChange={(event) => pagination.onRowsPerPageChange(Number(event.target.value))}
        sx={{ '& .MuiTablePagination-toolbar': { flexWrap: 'wrap', justifyContent: 'flex-end' } }}
      />
    </>
  );
}
