import { useState, useCallback } from 'react';
import { UseFormReturn } from 'react-hook-form';

export interface DraftSetupForm {
  participants: string[];
  categories: string[];
}

export type DraftTheme = 'people' | 'year' | '';
export type DraftMode = 'single' | 'multiplayer';

export interface DraftFormState {
  theme: DraftTheme;
  selectedOption: string;
  participants: string[];
  draftMode: DraftMode;
  searchQuery: string;
  newParticipant: string;
}

export type FormStep = 'theme' | 'option' | 'mode' | 'participants' | 'categories' | 'ready';

const initialState: DraftFormState = {
  theme: '',
  selectedOption: '',
  participants: [],
  draftMode: 'single',
  searchQuery: '',
  newParticipant: '',
};

export const useDraftForm = () => {
  const [state, setState] = useState<DraftFormState>(initialState);

  // Determine current step based on state
  const getCurrentStep = useCallback((): FormStep => {
    if (!state.theme) return 'theme';
    if (!state.selectedOption) return 'option';
    if (!state.draftMode) return 'mode';
    // Participants are now optional - go to categories after mode selection
    return 'categories';
  }, [state]);

  // Check if a step is complete
  const isStepComplete = useCallback((step: FormStep): boolean => {
    switch (step) {
      case 'theme':
        return Boolean(state.theme);
      case 'option':
        return Boolean(state.selectedOption);
      case 'mode':
        return Boolean(state.draftMode);
      case 'participants':
        return true; // Participants are now optional
      case 'categories':
        return true; // Categories are handled by the form component
      case 'ready':
        return true;
      default:
        return false;
    }
  }, [state]);

  // Check if a step should be visible
  const isStepVisible = useCallback((step: FormStep): boolean => {
    const steps: FormStep[] = ['theme', 'option', 'mode', 'participants', 'categories'];
    const currentStepIndex = steps.indexOf(getCurrentStep());
    const stepIndex = steps.indexOf(step);
    
    // Show current step and all previous steps
    return stepIndex <= currentStepIndex;
  }, [getCurrentStep]);

  // State setters
  const setTheme = useCallback((theme: DraftTheme) => {
    setState(prev => ({
      ...prev,
      theme,
      selectedOption: '', // Reset dependent fields
      searchQuery: '',
    }));
  }, []);

  const setSelectedOption = useCallback((option: string) => {
    setState(prev => ({
      ...prev,
      selectedOption: option,
      searchQuery: '',
    }));
  }, []);

  const setDraftMode = useCallback((mode: DraftMode) => {
    setState(prev => ({
      ...prev,
      draftMode: mode,
    }));
  }, []);

  const setSearchQuery = useCallback((query: string) => {
    setState(prev => ({
      ...prev,
      searchQuery: query,
    }));
  }, []);

  const setNewParticipant = useCallback((participant: string) => {
    setState(prev => ({
      ...prev,
      newParticipant: participant,
    }));
  }, []);

  const addParticipant = useCallback((participant: string) => {
    if (participant.trim() && !state.participants.includes(participant.trim())) {
      setState(prev => ({
        ...prev,
        participants: [...prev.participants, participant.trim()],
        newParticipant: '',
      }));
    }
  }, [state.participants]);

  const removeParticipant = useCallback((participant: string) => {
    setState(prev => ({
      ...prev,
      participants: prev.participants.filter(p => p !== participant),
    }));
  }, []);

  // Validation helpers
  const isEmailValid = useCallback((email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }, []);

  const validateStep = useCallback((step: FormStep): string[] => {
    const errors: string[] = [];
    
    switch (step) {
      case 'participants':
        if (state.draftMode === 'multiplayer') {
          const invalidEmails = state.participants.filter(p => !isEmailValid(p));
          if (invalidEmails.length > 0) {
            errors.push(`Invalid email addresses: ${invalidEmails.join(', ')}`);
          }
        }
        break;
    }
    
    return errors;
  }, [state, isEmailValid]);

  const canStartDraft = useCallback((formData: DraftSetupForm): boolean => {
    return Boolean(
      state.selectedOption && 
      formData.categories.length > 0
    );
  }, [state]);

  return {
    state,
    getCurrentStep,
    isStepComplete,
    isStepVisible,
    setTheme,
    setSelectedOption,
    setDraftMode,
    setSearchQuery,
    setNewParticipant,
    addParticipant,
    removeParticipant,
    isEmailValid,
    validateStep,
    canStartDraft,
  };
};