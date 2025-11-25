import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { SpecDraft } from '@/hooks/useSpecDraftsAdmin';
import { uploadSpecDraftPhoto, deleteSpecDraftPhoto } from '@/utils/specDraftPhotoUpload';
import { Upload, X, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SpecDraftFormProps {
  specDraft?: SpecDraft | null;
  onSubmit: (data: {
    name: string;
    description?: string;
    photoUrl?: string;
    photoFile?: File | null;
  }) => Promise<void>;
  onCancel?: () => void;
  loading?: boolean;
}

export const SpecDraftForm: React.FC<SpecDraftFormProps> = ({
  specDraft,
  onSubmit,
  onCancel,
  loading = false,
}) => {
  const [name, setName] = useState(specDraft?.name || '');
  const [description, setDescription] = useState(specDraft?.description || '');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(specDraft?.photo_url || null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Update form state when specDraft changes
  useEffect(() => {
    if (specDraft) {
      setName(specDraft.name || '');
      setDescription(specDraft.description || '');
      // Only update photoPreview if no new file is selected
      if (!photoFile) {
        setPhotoPreview(specDraft.photo_url || null);
      }
    } else {
      // Reset form for new draft
      setName('');
      setDescription('');
      setPhotoPreview(null);
      setPhotoFile(null);
    }
  }, [specDraft]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload a PNG, JPEG, or WebP image.',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (5MB limit)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast({
        title: 'File too large',
        description: 'File size exceeds 5MB limit. Please upload a smaller image.',
        variant: 'destructive',
      });
      return;
    }

    setPhotoFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPhotoPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Spec draft name is required',
        variant: 'destructive',
      });
      return;
    }

    let photoUrl: string | undefined = undefined;

    // For existing drafts, handle photo upload/removal
    if (specDraft?.id) {
      if (photoFile) {
        // New photo selected - upload it
        setUploadingPhoto(true);
        try {
          // Delete old photo if it exists
          if (specDraft.photo_url) {
            try {
              await deleteSpecDraftPhoto(specDraft.photo_url);
            } catch (error) {
              console.error('Error deleting old photo:', error);
              // Continue anyway
            }
          }

          photoUrl = await uploadSpecDraftPhoto(specDraft.id, photoFile);
        } catch (error) {
          toast({
            title: 'Upload Error',
            description: error instanceof Error ? error.message : 'Failed to upload photo',
            variant: 'destructive',
          });
          setUploadingPhoto(false);
          return;
        } finally {
          setUploadingPhoto(false);
        }
      } else if (photoPreview && photoPreview === specDraft.photo_url) {
        // Keep existing photo
        photoUrl = specDraft.photo_url;
      } else if (!photoPreview && specDraft.photo_url) {
        // Photo was removed
        try {
          await deleteSpecDraftPhoto(specDraft.photo_url);
        } catch (error) {
          console.error('Error deleting photo:', error);
          // Continue anyway
        }
        photoUrl = undefined;
      }
    }
    // For new drafts, photoFile will be stored and uploaded after draft creation

    // Submit the form
    // For new drafts, pass the photoFile so parent can upload after creation
    await onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
      photoUrl,
      photoFile: !specDraft ? photoFile : null, // Only pass photoFile for new drafts
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>
            {specDraft ? 'Edit Spec Draft' : 'Create New Spec Draft'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Spec Draft Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Action Blockbusters 2020s"
                required
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., A curated collection of action blockbusters from the 2020s"
                rows={3}
              />
            </div>

            {/* Photo Upload */}
            <div className="space-y-2">
              <Label>Photo (900x900 square)</Label>
              <div className="space-y-3">
                {/* Show current photo if it exists (from database) */}
                {photoPreview && !photoFile && specDraft?.photo_url && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-700">Current Photo:</p>
                    <div className="relative inline-block">
                      <img
                        src={photoPreview}
                        alt="Current spec draft photo"
                        className="w-48 h-48 object-cover rounded-md border border-gray-300"
                        onError={(e) => {
                          console.error('Failed to load photo:', photoPreview);
                          // Hide the image if it fails to load
                          setPhotoPreview(null);
                        }}
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={handleRemovePhoto}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
                
                {/* Show preview if a new photo was selected */}
                {photoFile && photoPreview && photoPreview !== specDraft?.photo_url && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-700">New Photo Preview:</p>
                    <div className="relative inline-block">
                      <img
                        src={photoPreview}
                        alt="New photo preview"
                        className="w-48 h-48 object-cover rounded-md border border-gray-300"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={handleRemovePhoto}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
                
                {/* Show upload area if no photo exists */}
                {!specDraft?.photo_url && !photoFile && (
                  <div className="border-2 border-dashed border-gray-300 rounded-md p-6 text-center">
                    <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                    <p className="text-sm text-gray-600 mb-2">No photo uploaded</p>
                  </div>
                )}
                
                <div>
                  <Input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    onChange={handlePhotoChange}
                    className="cursor-pointer"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {specDraft?.photo_url 
                      ? 'Upload a new photo to replace the current one (will be resized to 900x900). Max 5MB.'
                      : 'Upload a square image (will be resized to 900x900). Max 5MB.'}
                    {!specDraft && ' Photo will be uploaded after draft creation.'}
                  </p>
                </div>
              </div>
            </div>


            {/* Actions */}
            <div className="flex gap-3 justify-end">
              {onCancel && (
                <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
                  Cancel
                </Button>
              )}
              <Button type="submit" disabled={loading || uploadingPhoto}>
                {uploadingPhoto ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : loading ? (
                  'Saving...'
                ) : specDraft ? (
                  'Update Spec Draft'
                ) : (
                  'Create Spec Draft'
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

