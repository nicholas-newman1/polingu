import type { ReactNode } from 'react';
import { Box, Chip, Typography } from '@mui/material';
import capitalize from '../../lib/utils/capitalize';
import type { SentenceTagsData } from '../../lib/storage/sentenceTags';
import type { TagCategory } from '../../types/sentences';
import { ChipGroup, Section } from './shared';

const TAG_CATEGORIES: TagCategory[] = ['topics', 'grammar', 'style'];

interface TagCategoryPickerProps {
  sentenceTags: SentenceTagsData;
  selected: string[];
  onToggle: (tag: string) => void;
  getLabel?: (tag: string) => string;
  renderCategoryActions?: (category: TagCategory) => ReactNode;
}

export function TagCategoryPicker({
  sentenceTags,
  selected,
  onToggle,
  getLabel = (tag) => tag,
  renderCategoryActions,
}: TagCategoryPickerProps) {
  return (
    <Section>
      <Typography variant="subtitle2" color="text.secondary">
        Tags (optional)
      </Typography>
      {TAG_CATEGORIES.map((category) => (
        <Box key={category}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Typography variant="caption" color="text.disabled">
              {capitalize(category)}
            </Typography>
            {renderCategoryActions?.(category)}
          </Box>
          <ChipGroup>
            {sentenceTags[category].map((tag) => (
              <Chip
                key={tag}
                label={getLabel(tag)}
                size="small"
                variant={selected.includes(tag) ? 'filled' : 'outlined'}
                color={selected.includes(tag) ? 'secondary' : 'default'}
                onClick={() => onToggle(tag)}
              />
            ))}
          </ChipGroup>
        </Box>
      ))}
    </Section>
  );
}
