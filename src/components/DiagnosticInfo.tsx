import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useProfileFixer } from '@/hooks/useProfileFixer';

interface DiagnosticInfoProps {
  draft: any;
  participants: any[];
  picks: any[];
  user: any;
  isMyTurn: boolean;
}

export const DiagnosticInfo: React.FC<DiagnosticInfoProps> = ({
  draft,
  participants,
  picks,
  user,
  isMyTurn
}) => {
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [dbState, setDbState] = useState<any>(null);
  const { fixMyParticipantNames } = useProfileFixer();

  const fetchCurrentDbState = async () => {
    console.log('🔍 DIAGNOSTIC v1.0 - Fetching current DB state...');
    
    try {
      const { data: currentDraft, error } = await supabase
        .from('drafts')
        .select('*')
        .eq('id', draft?.id)
        .single();

      if (error) {
        console.error('🚫 DIAGNOSTIC v1.0 - Error fetching current draft:', error);
        return;
      }

      console.log('🔍 DIAGNOSTIC v1.0 - Current DB draft state:', currentDraft);
      setDbState(currentDraft);
    } catch (error) {
      console.error('🚫 DIAGNOSTIC v1.0 - Exception fetching DB state:', error);
    }
  };

  if (!showDiagnostics) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button 
          onClick={() => setShowDiagnostics(true)}
          variant="outline"
          size="sm"
          className="bg-error-red-500 text-error-red-100 hover:bg-error-red-600"
        >
          🔍 Show Diagnostics
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-96 max-h-96 overflow-y-auto">
      <Card className="border-error-red-500 border-2">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm text-error-red-600">🔍 DIAGNOSTIC v1.0</CardTitle>
            <Button
              onClick={() => setShowDiagnostics(false)}
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
            >
              ×
            </Button>
          </div>
        </CardHeader>
        <CardContent className="text-xs space-y-2">
          <div>
            <Badge variant="outline" className="mb-1">Draft State</Badge>
            <div className="pl-2 space-y-1">
              <div>ID: {draft?.id || 'N/A'}</div>
              <div>Turn User ID: {draft?.current_turn_user_id || 'N/A'}</div>
              <div>Pick Number: {draft?.current_pick_number || 'N/A'}</div>
              <div>Turn Order Type: {typeof draft?.turn_order}</div>
              <div>Turn Order Length: {draft?.turn_order?.length || 'N/A'}</div>
              <div>Is Complete: {draft?.is_complete ? 'Yes' : 'No'}</div>
            </div>
          </div>

          <div>
            <Badge variant="outline" className="mb-1">User State</Badge>
            <div className="pl-2 space-y-1">
              <div>User ID: {user?.id || 'N/A'}</div>
              <div>Is My Turn: {isMyTurn ? 'Yes' : 'No'}</div>
              <div>Participants Count: {participants.length}</div>
              <div>Picks Count: {picks.length}</div>
            </div>
          </div>

          <div>
            <Badge variant="outline" className="mb-1">Turn Order</Badge>
            <div className="pl-2 max-h-20 overflow-y-auto">
              {draft?.turn_order ? (
                <pre className="text-xs">
                  {JSON.stringify(draft.turn_order, null, 1)}
                </pre>
              ) : (
                'No turn order found'
              )}
            </div>
          </div>

          <div className="space-y-1">
            <Button
              onClick={fetchCurrentDbState}
              variant="outline"
              size="sm"
              className="w-full text-xs"
            >
              🔄 Fetch DB State
            </Button>
            
            <Button
              onClick={fixMyParticipantNames}
              variant="outline"
              size="sm"
              className="w-full text-xs bg-blue-100 hover:bg-blue-200"
            >
              🔧 Fix My Name in Past Drafts
            </Button>
            
            {dbState && (
              <div>
                <Badge variant="outline" className="mb-1">Fresh DB State</Badge>
                <div className="pl-2 space-y-1">
                  <div>Turn User ID: {dbState.current_turn_user_id || 'N/A'}</div>
                  <div>Pick Number: {dbState.current_pick_number || 'N/A'}</div>
                  <div>Turn Order Type: {typeof dbState.turn_order}</div>
                  <div>Turn Order Length: {dbState.turn_order?.length || 'N/A'}</div>
                  <div>Updated: {dbState.updated_at}</div>
                </div>
              </div>
            )}
          </div>

          <div className="pt-2 border-t">
            <div className="text-xs text-muted-foreground">
              Check console for detailed logs. Timestamp: {new Date().toLocaleTimeString()}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};