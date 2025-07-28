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
  isPublicView?: boolean;
}

export const SaveDraftPrompt: React.FC<SaveDraftPromptProps> = ({
  isOpen,
  onClose,
  onSignUp,
  draftTitle = "your draft",
  isPublicView = false
}) => {
  const { isGuest, user } = useAuth();
  const navigate = useNavigate();

  // Show for guests or anonymous users viewing public drafts
  if (!isGuest && !isPublicView) return null;
  if (user && !isPublicView) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Save className="h-5 w-5" />
            Save Your Draft
          </DialogTitle>
          <DialogDescription>
            {isPublicView 
              ? `Create an account to save a copy of "${draftTitle}" to your profile and create your own drafts.`
              : `Create an account to save ${draftTitle} permanently and access it from any device.`
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <Calendar className="h-4 w-4" />
            <AlertDescription>
              {isPublicView 
                ? "Creating an account will allow you to save and manage your own drafts permanently."
                : "Guest drafts are temporary and will be lost after 7 days of inactivity."
              }
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 gap-3">
            <div className="flex items-center gap-3 p-3 border rounded-lg">
              <User className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Create Account</p>
                <p className="text-xs text-muted-foreground">
                  {isPublicView 
                    ? "Start creating and saving your own movie drafts"
                    : "Save drafts permanently, access from anywhere"
                  }
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose}>
            {isPublicView ? "Close" : "Continue as Guest"}
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