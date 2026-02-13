import { useState, useCallback } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { Participant, normalizeParticipants } from '@/types/participant';

export interface DraftSetupForm {
  participants: Participant[];
  categories: string[];
}

export type DraftTheme = 'people' | 'year' | '';
export type DraftMode = 'single' | 'multiplayer';

export interface DraftFormState {
  theme: DraftTheme;
  selectedOption: string;
  participants: Participant[];
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
    // Show participants step for both single and multiplayer modes
    return 'participants';
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
        return state.draftMode === 'single' || state.participants.length > 0;
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
    
    // Show participants step for both single and multiplayer modes
    if (step === 'participants' && currentStepIndex >= 3) {
      return true;
    }
    
    // Show categories step once participants step is reached
    if (step === 'categories' && currentStepIndex >= 3) {
      return true;
    }
    
    // Show current step and all previous steps
    return stepIndex <= currentStepIndex;
  }, [getCurrentStep, state.draftMode]);

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

  const addParticipant = useCallback((participant: string | Participant) => {
    let participantToAdd: Participant;
    
    if (typeof participant === 'string') {
      // Backward compatibility: string input creates human participant
      participantToAdd = { name: participant.trim(), isAI: false };
    } else {
      participantToAdd = participant;
    }
    
    if (participantToAdd.name && !state.participants.some(p => p.name === participantToAdd.name)) {
      setState(prev => ({
        ...prev,
        participants: [...prev.participants, participantToAdd],
        newParticipant: '',
      }));
    }
  }, [state.participants]);

  const addAIParticipant = useCallback((aiName: string) => {
    const aiParticipant: Participant = { name: aiName, isAI: true };
    if (!state.participants.some(p => p.name === aiName)) {
      setState(prev => ({
        ...prev,
        participants: [...prev.participants, aiParticipant],
      }));
    }
  }, [state.participants]);

  const removeParticipant = useCallback((participant: string | Participant) => {
    setState(prev => {
      if (typeof participant === 'string') {
        // Backward compatibility: remove by name
        return {
          ...prev,
          participants: prev.participants.filter(p => p.name !== participant),
        };
      } else {
        // Remove by object reference
        return {
          ...prev,
          participants: prev.participants.filter(p => p.name !== participant.name || p.isAI !== participant.isAI),
        };
      }
    });
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
          // Only validate human participants (emails), not AI participants
          const humanParticipants = state.participants.filter(p => !p.isAI);
          const invalidEmails = humanParticipants.filter(p => !isEmailValid(p.name));
          if (invalidEmails.length > 0) {
            errors.push(`Invalid email addresses: ${invalidEmails.map(p => p.name).join(', ')}`);
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
    addAIParticipant,
    removeParticipant,
    isEmailValid,
    validateStep,
    canStartDraft,
  };
};