import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Alert,
  AlertDescription,
} from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Save, User, Calendar } from 'lucide-react';

interface SaveDraftPromptProps {
  isOpen: boolean;
  onClose: () => void;
  onSignUp: () => void;
  draftTitle?: string;
}

export const SaveDraftPrompt: React.FC<SaveDraftPromptProps> = ({
  isOpen,
  onClose,
  onSignUp,
  draftTitle = "your draft"
}) => {
  const { isGuest } = useAuth();
  const navigate = useNavigate();

  if (!isGuest) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Save className="h-5 w-5" />
            Save Your Draft
          </DialogTitle>
          <DialogDescription>
            Create an account to save {draftTitle} permanently and access it from any device.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <Calendar className="h-4 w-4" />
            <AlertDescription>
              Guest drafts are temporary and will be lost after 7 days of inactivity.
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 gap-3">
            <div className="flex items-center gap-3 p-3 border rounded-lg">
              <User className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Create Account</p>
                <p className="text-xs text-muted-foreground">
                  Save drafts permanently, access from anywhere
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose}>
            Continue as Guest
          </Button>
          <Button onClick={onSignUp} className="w-full sm:w-auto">
            <User className="h-4 w-4 mr-2" />
            Create Account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};