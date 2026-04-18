import {
  Box,
  Card,
  Divider,
  MenuItem,
  Select,
  type SelectChangeEvent,
  Slider,
  Stack,
  Typography,
} from '@mui/material';
import { styled } from '../lib/styled';
import type {
  ListeningPlaybackGroup,
  ListeningSettings,
  ListeningGapSeconds,
  ListeningRepetitions,
} from '../types/listening';
import { LISTENING_GAP_OPTIONS, LISTENING_REPETITION_OPTIONS } from '../types/listening';

const SettingsCard = styled(Card)(({ theme }) => ({
  padding: theme.spacing(2),
  marginBottom: theme.spacing(2),
  maxWidth: 520,
  margin: '0 auto',
  width: '100%',
  [theme.breakpoints.up('sm')]: {
    padding: theme.spacing(3),
    marginBottom: theme.spacing(3),
  },
}));

const GroupHeading = styled(Typography)(({ theme }) => ({
  fontWeight: 600,
  marginBottom: theme.spacing(1),
  color: theme.palette.text.primary,
}));

const Row = styled(Stack)(({ theme }) => ({
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: theme.spacing(1.5),
}));

const StyledSelect = styled(Select<number>)(() => ({
  minWidth: 100,
  '.MuiSelect-select': { paddingTop: 6, paddingBottom: 6 },
}));

function formatGap(value: number): string {
  return `${value}s`;
}

interface GroupEditorProps {
  label: string;
  group: ListeningPlaybackGroup;
  onChange: (group: ListeningPlaybackGroup) => void;
}

function GroupEditor({ label, group, onChange }: GroupEditorProps) {
  const handleGapBetweenCards = (e: SelectChangeEvent<number>) => {
    onChange({ ...group, gapBetweenCards: Number(e.target.value) as ListeningGapSeconds });
  };
  const handleRepetitions = (e: SelectChangeEvent<number>) => {
    onChange({ ...group, repetitions: Number(e.target.value) as ListeningRepetitions });
  };
  const handleGapBetweenReps = (e: SelectChangeEvent<number>) => {
    onChange({
      ...group,
      gapBetweenRepetitions: Number(e.target.value) as ListeningGapSeconds,
    });
  };

  return (
    <Box sx={{ mb: 2 }} data-qa={`listening-group-${label.toLowerCase().replace(/\s+/g, '-')}`}>
      <GroupHeading variant="subtitle2">{label}</GroupHeading>
      <Row>
        <Typography variant="body2" color="text.secondary">
          Gap between cards
        </Typography>
        <StyledSelect
          value={group.gapBetweenCards}
          size="small"
          onChange={handleGapBetweenCards}
          data-qa="gap-between-cards"
        >
          {LISTENING_GAP_OPTIONS.map((opt) => (
            <MenuItem key={opt} value={opt}>
              {formatGap(opt)}
            </MenuItem>
          ))}
        </StyledSelect>
      </Row>
      <Row>
        <Typography variant="body2" color="text.secondary">
          Repetitions per card
        </Typography>
        <StyledSelect
          value={group.repetitions}
          size="small"
          onChange={handleRepetitions}
          data-qa="repetitions"
        >
          {LISTENING_REPETITION_OPTIONS.map((opt) => (
            <MenuItem key={opt} value={opt}>
              {opt}
            </MenuItem>
          ))}
        </StyledSelect>
      </Row>
      <Row sx={{ mb: 0 }}>
        <Typography variant="body2" color="text.secondary">
          Gap between repetitions
        </Typography>
        <StyledSelect
          value={group.gapBetweenRepetitions}
          size="small"
          onChange={handleGapBetweenReps}
          data-qa="gap-between-reps"
        >
          {LISTENING_GAP_OPTIONS.map((opt) => (
            <MenuItem key={opt} value={opt}>
              {formatGap(opt)}
            </MenuItem>
          ))}
        </StyledSelect>
      </Row>
    </Box>
  );
}

interface ListeningSettingsPanelProps {
  settings: ListeningSettings;
  onChange: (updates: Partial<ListeningSettings>) => void;
}

export function ListeningSettingsPanel({ settings, onChange }: ListeningSettingsPanelProps) {
  return (
    <SettingsCard className="animate-fade-up" data-qa="listening-settings-panel">
      <Typography variant="h6" sx={{ mb: 2 }}>
        Listening settings
      </Typography>

      <Row>
        <Typography variant="body2" color="text.secondary">
          Playback rate
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 220, flexShrink: 0 }}>
          <Slider
            value={settings.playbackRate}
            min={0.5}
            max={2}
            step={0.1}
            size="small"
            onChange={(_, value) => onChange({ playbackRate: value as number })}
            valueLabelDisplay="auto"
            valueLabelFormat={(v) => `${v}x`}
            data-qa="playback-rate"
          />
          <Typography variant="body2" sx={{ width: 36, textAlign: 'right' }}>
            {settings.playbackRate.toFixed(1)}x
          </Typography>
        </Box>
      </Row>

      <Divider sx={{ my: 2 }} />

      <GroupEditor
        label="Learned cards"
        group={settings.learned}
        onChange={(group) => onChange({ learned: group })}
      />

      <Divider sx={{ my: 2 }} />

      <GroupEditor
        label="Unknown cards"
        group={settings.unknown}
        onChange={(group) => onChange({ unknown: group })}
      />
    </SettingsCard>
  );
}
