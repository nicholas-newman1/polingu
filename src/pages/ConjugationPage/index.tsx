import { useState, useMemo } from 'react';
import { CircularProgress } from '@mui/material';
import { ConjugationFlashcard } from './components/ConjugationFlashcard';
import { ConjugationFilterControls } from './components/ConjugationFilterControls';
import { EmptyState } from '../../components/EmptyState';
import { ReviewStage } from '../../components/ReviewStage';
import { SettingsPanel } from '../../components/SettingsPanel';
import { ReviewMainContent } from '../../components/ReviewLayout';
import { EditConjugationModal } from '../../components/EditConjugationModal';
import type {
  Verb,
  ConjugationFilters,
  DrillableForm,
  ConjugationForm,
  Aspect,
  VerbClass,
} from '../../types/conjugation';
import type { TranslationDirection } from '../../types/common';
import { itemsMatching } from '../../lib/reviewSession/scheduler';
import { conjugationDeck } from '../../lib/reviewSession/reviewDecks';
import { useAuthContext } from '../../contexts/AuthContext';
import { useConjugation, useReviewDataLoading } from '../../hooks/useReviewData';
import {
  getDrillableFormsForVerb,
  getAmbiguousEnglishPromptKeys,
} from '../../lib/conjugationUtils';
import { useUserFilters } from '../../contexts/UserFiltersContext';
import { updateVerb, deleteVerb } from '../../lib/storage/systemVerbs';
import { writeBuiltIn } from '../../lib/storage/writeBuiltIn';
import { useSaveError } from '../../hooks/useSaveError';
import { useConfirm } from '../../hooks/useConfirm';
import { useDeckReview } from '../../hooks/useDeckReview';

interface ConjugationPageProps {
  mode: TranslationDirection;
}

export function ConjugationPage({ mode }: ConjugationPageProps) {
  const { user, isAdmin } = useAuthContext();
  const showSaveError = useSaveError();
  const { confirm, confirmDialog } = useConfirm();
  const loading = useReviewDataLoading();
  const { progress, verbs, setVerbs } = useConjugation();
  const forms = useMemo(() => verbs.flatMap(getDrillableFormsForVerb), [verbs]);

  const { filters: userFilters, filtersLoading, updateConjugationFilters } = useUserFilters();
  const filters = userFilters.conjugation;

  const [editingForm, setEditingForm] = useState<DrillableForm | null>(null);

  const review = useDeckReview(progress, mode, {
    deck: conjugationDeck,
    items: forms,
    filters,
    ready: !loading && !filtersLoading && verbs.length > 0,
    getAudioUrls: (form) => [form.form.audioUrl],
    confirm,
    resetMessage:
      'Are you sure? This will erase all your conjugation progress for this direction and cannot be undone.',
  });
  const { session } = review;
  const { practice } = session;

  const verbsById = useMemo(() => new Map(verbs.map((verb) => [verb.id, verb])), [verbs]);
  const ambiguousPromptKeys = useMemo(() => getAmbiguousEnglishPromptKeys(verbs), [verbs]);

  const handleFilterChange = (next: ConjugationFilters) => {
    updateConjugationFilters(next);
    if (practice.active) {
      practice.reshuffle(itemsMatching(conjugationDeck, forms, next));
    } else {
      session.restart(next);
    }
  };

  const replaceVerbInForms = (updatedVerb: Verb) => {
    const updatedForms = getDrillableFormsForVerb(updatedVerb);
    session.updateCards(
      (form) => form.verb.id === updatedVerb.id,
      (form) => updatedForms.find((f) => f.fullFormKey === form.fullFormKey) ?? form
    );
  };

  const withUpdatedForm = (
    form: DrillableForm,
    update: (current: ConjugationForm) => ConjugationForm
  ) => {
    const { verb, tense, formKey } = form;
    const tenseForms = verb.conjugations[tense] as Record<string, ConjugationForm> | undefined;
    if (!tenseForms) return verb.conjugations;
    return {
      ...verb.conjugations,
      [tense]: { ...tenseForms, [formKey]: update(tenseForms[formKey]) },
    };
  };

  const handleSaveForm = (
    verbUpdates: {
      infinitive: string;
      infinitiveEn: string;
      aspect: Aspect;
      verbClass: VerbClass;
      isReflexive: boolean;
    },
    formUpdates: ConjugationForm
  ) => {
    if (!editingForm) return;

    const verb = editingForm.verb;
    // The modal edits everything but the audio, so a field it leaves out (such as an
    // emptied plAlternatives) was removed rather than left unchanged.
    const conjugations = withUpdatedForm(editingForm, ({ audioUrl }) =>
      audioUrl ? { ...formUpdates, audioUrl } : formUpdates
    );
    const updatedVerb: Verb = { ...verb, ...verbUpdates, conjugations };

    replaceVerbInForms(updatedVerb);
    return writeBuiltIn(
      verbs,
      setVerbs,
      verbs.map((v) => (v.id === verb.id ? updatedVerb : v)),
      () => updateVerb(verb.id, { ...verbUpdates, conjugations })
    );
  };

  const removeVerb = (verbId: string) => {
    session.removeCards((form) => form.verb.id === verbId);
    void writeBuiltIn(
      verbs,
      setVerbs,
      verbs.filter((v) => v.id !== verbId),
      () => deleteVerb(verbId)
    ).catch(showSaveError);
  };

  const deleteVerbById = async (verbId: string): Promise<boolean> => {
    const confirmed = await confirm({
      title: 'Delete Verb',
      message:
        'Are you sure you want to delete this verb? This will remove all conjugation forms for this verb and affect all users.',
      confirmLabel: 'Delete',
    });
    if (!confirmed) return false;
    removeVerb(verbId);
    return true;
  };

  const closeEditModal = () => setEditingForm(null);

  // No session is built without verbs; the stage's fallback says so instead of a spinner.
  const isLoading = loading || filtersLoading || (verbs.length > 0 && !session.isBuilt);

  return (
    <>
      <ConjugationFilterControls
        filters={filters}
        practiceMode={practice.active}
        showSettings={review.showSettings}
        onChange={handleFilterChange}
        onTogglePractice={session.togglePractice}
        onToggleSettings={review.toggleSettings}
      />

      {review.showSettings && !practice.active && (
        <SettingsPanel {...review.settingsPanel} user={user} />
      )}

      <ReviewMainContent>
        {isLoading ? (
          <CircularProgress sx={{ color: 'text.disabled' }} />
        ) : (
          <ReviewStage
            session={session}
            feature="conjugation"
            direction={mode}
            unitLabel="forms"
            practiceEmptyMessage="No forms match your filters"
            renderCard={(form, controls) => (
              <ConjugationFlashcard
                {...controls}
                form={form}
                direction={mode}
                aspectPairVerb={
                  form.verb.aspectPair ? verbsById.get(form.verb.aspectPair) : undefined
                }
                showGlossHint={ambiguousPromptKeys.has(form.fullFormKey)}
                canEdit={isAdmin}
                onEdit={() => setEditingForm(form)}
                onDelete={async () => {
                  if (await deleteVerbById(form.verb.id)) controls.onContinue?.();
                }}
              />
            )}
            fallback={
              verbs.length === 0 && (
                <EmptyState message="No verbs available. Import verbs to get started." />
              )
            }
          />
        )}
      </ReviewMainContent>

      <EditConjugationModal
        open={editingForm !== null}
        onClose={closeEditModal}
        onSave={handleSaveForm}
        onDelete={
          isAdmin
            ? () => {
                if (!editingForm) return;
                removeVerb(editingForm.verb.id);
                closeEditModal();
              }
            : undefined
        }
        form={editingForm}
        onAudioUpdated={(audioUrl) => {
          if (!editingForm) return;
          const conjugations = withUpdatedForm(editingForm, (current) => ({
            ...current,
            audioUrl,
          }));
          replaceVerbInForms({ ...editingForm.verb, conjugations });
        }}
      />
      {confirmDialog}
    </>
  );
}
