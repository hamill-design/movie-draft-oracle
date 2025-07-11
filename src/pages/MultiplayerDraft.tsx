import React from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { MultiplayerDraftInterface } from '@/components/MultiplayerDraftInterface';

const MultiplayerDraft = () => {
  const { draftId } = useParams<{ draftId: string }>();
  const location = useLocation();
  const initialData = location.state;

  return (
    <MultiplayerDraftInterface 
      draftId={draftId} 
      initialData={initialData}
    />
  );
};

export default MultiplayerDraft;