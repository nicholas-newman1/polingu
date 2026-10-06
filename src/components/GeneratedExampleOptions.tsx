import { Box, Checkbox, Stack, Typography } from '@mui/material';
import { styled } from '../lib/styled';
import { alpha } from '../lib/theme';
import type { GeneratedExample } from '../lib/generateExample';

const OptionRow = styled(Box)<{ $selected: boolean }>(({ theme, $selected }) => ({
  display: 'flex',
  alignItems: 'flex-start',
  gap: theme.spacing(1),
  padding: theme.spacing(1.5),
  borderRadius: theme.shape.borderRadius,
  backgroundColor: alpha(theme.palette.success.main, 0.08),
  border: `1px solid ${alpha(theme.palette.success.main, 0.3)}`,
  cursor: 'pointer',
  opacity: $selected ? 1 : 0.5,
}));

interface GeneratedExampleOptionsProps {
  examples: GeneratedExample[];
  selected: Set<number>;
  onToggle: (index: number) => void;
  dataQa?: string;
}

export function GeneratedExampleOptions({
  examples,
  selected,
  onToggle,
  dataQa,
}: GeneratedExampleOptionsProps) {
  return (
    <Stack spacing={1}>
      {examples.map((example, index) => (
        <OptionRow
          key={index}
          $selected={selected.has(index)}
          onClick={() => onToggle(index)}
          data-qa={dataQa}
        >
          <Checkbox
            checked={selected.has(index)}
            size="small"
            sx={{ p: 0, mt: 0.25 }}
            tabIndex={-1}
          />
          <Box sx={{ flex: 1 }}>
            <Typography variant="body2" fontWeight={500}>
              {example.polish}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {example.english}
            </Typography>
            {example.meaning && (
              <Typography variant="caption" sx={{ color: 'primary.main', fontStyle: 'italic' }}>
                ({example.meaning})
              </Typography>
            )}
          </Box>
        </OptionRow>
      ))}
    </Stack>
  );
}
