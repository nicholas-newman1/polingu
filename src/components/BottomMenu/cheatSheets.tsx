import type { ReactNode } from 'react';
import type { SvgIconComponent } from '@mui/icons-material';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import AbcIcon from '@mui/icons-material/Abc';
import SpellcheckIcon from '@mui/icons-material/Spellcheck';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import LibraryBooksOutlinedIcon from '@mui/icons-material/LibraryBooksOutlined';
import { allTables } from '../../data/declensionPatterns';
import { adjectiveDeclensionTables } from '../../data/adjectiveDeclensionPatterns';
import { DeclensionCheatSheet } from './DeclensionCheatSheet';
import { ConsonantsCheatSheet } from './ConsonantsCheatSheet';
import { YiRuleCheatSheet } from './YiRuleCheatSheet';
import { ConjugationCheatSheet } from './ConjugationCheatSheet';

interface CheatSheet {
  key: string;
  /** Its entry in the bottom bar's cheat sheet menu. */
  label: string;
  icon: SvgIconComponent;
  /** The open drawer's heading. */
  title: string;
  render: () => ReactNode;
}

/** The cheat sheets, in menu order. */
export const CHEAT_SHEETS = [
  {
    key: 'declension',
    label: 'Noun Declensions',
    icon: MenuBookIcon,
    title: 'Noun Declension Cheat Sheet',
    render: () => <DeclensionCheatSheet tables={allTables} />,
  },
  {
    key: 'adjective-declension',
    label: 'Adjective Declensions',
    icon: LibraryBooksOutlinedIcon,
    title: 'Adjective Declension Cheat Sheet',
    render: () => <DeclensionCheatSheet tables={adjectiveDeclensionTables} pluralGridColumns={2} />,
  },
  {
    key: 'consonants',
    label: 'Consonants',
    icon: AbcIcon,
    title: 'Consonants Cheat Sheet',
    render: () => <ConsonantsCheatSheet />,
  },
  {
    key: 'yi-rule',
    label: '-y/-i Rule',
    icon: SpellcheckIcon,
    title: '-y/-i Rule',
    render: () => <YiRuleCheatSheet />,
  },
  {
    key: 'conjugation',
    label: 'Conjugations',
    icon: AutoStoriesIcon,
    title: 'Conjugation Cheat Sheet',
    render: () => <ConjugationCheatSheet />,
  },
] as const satisfies readonly CheatSheet[];

export type CheatSheetKey = (typeof CHEAT_SHEETS)[number]['key'];
