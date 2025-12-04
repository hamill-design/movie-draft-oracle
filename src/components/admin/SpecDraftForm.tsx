import React, { useState, useRef, useEffect } from 'react';
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
  // Debug: Log when component loads to verify latest code is running
  React.useEffect(() => {
    console.log('✅ SpecDraftForm loaded with photo upload feature - version 2024-12-04');
  }, []);
  
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
      // This ensures we show the existing photo when editing
      if (!photoFile) {
        const photoUrl = specDraft.photo_url || null;
        setPhotoPreview(photoUrl);
      }
    } else {
      // Reset form for new draft
      setName('');
      setDescription('');
      setPhotoPreview(null);
      setPhotoFile(null);
    }
  }, [specDraft, photoFile]);

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
          console.log('✅ Photo uploaded successfully, URL:', photoUrl);
        } catch (error) {
          console.error('❌ Photo upload failed:', error);
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
        console.log('📸 Keeping existing photo:', photoUrl);
      } else if (!photoPreview && specDraft.photo_url) {
        // Photo was removed
        try {
          await deleteSpecDraftPhoto(specDraft.photo_url);
        } catch (error) {
          console.error('Error deleting photo:', error);
          // Continue anyway
        }
        photoUrl = undefined;
        console.log('🗑️ Photo removed');
      }
    }
    // For new drafts, photoFile will be stored and uploaded after draft creation

    console.log('📤 Submitting form with photoUrl:', photoUrl);
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
      <div className="bg-greyscale-blue-100 rounded-[8px] shadow-[0px_0px_3px_0px_rgba(0,0,0,0.25)] p-6">
        <h2 className="text-xl font-brockmann-semibold text-text-primary leading-6 tracking-[0.32px] mb-6">
          {specDraft ? 'Edit Spec Draft' : 'Create New Spec Draft'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-brockmann-medium text-text-primary leading-5">
              Spec Draft Name *
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Action Blockbusters 2020s"
              required
              className="h-12 border-greyscale-blue-400 text-sm font-brockmann-medium leading-5"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-brockmann-medium text-text-primary leading-5">
              Description (Optional)
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., A curated collection of action blockbusters from the 2020s"
              rows={3}
              className="border-greyscale-blue-400 text-sm font-brockmann-regular leading-5"
            />
          </div>

          {/* Photo Upload */}
          <div className="space-y-2">
            <Label className="text-sm font-brockmann-medium text-text-primary leading-5">
              Photo (900x900 square)
            </Label>
            <div className="space-y-3">
              {/* Show current photo if it exists (from database) - use photoPreview which is synced with specDraft.photo_url */}
              {photoPreview && !photoFile && specDraft && (
                <div className="space-y-2">
                  <p className="text-sm font-brockmann-medium text-text-primary leading-5">Current Photo:</p>
                    <div className="relative inline-block">
                      <img
                        src={photoPreview}
                        alt="Current spec draft photo"
                        className="w-48 h-48 object-cover rounded-md border border-gray-300"
                        onError={(e) => {
                          console.error('Failed to load photo:', photoPreview);
                          // Hide the image on error
                          (e.target as HTMLImageElement).style.display = 'none';
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
                  <p className="text-xs font-brockmann-regular text-greyscale-blue-600 leading-4">Click the X button to remove this photo</p>
                </div>
              )}
              
              {/* Show preview if a new photo was selected */}
              {photoFile && photoPreview && (
                <div className="space-y-2">
                  <p className="text-sm font-brockmann-medium text-text-primary leading-5">New Photo Preview:</p>
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
                  <p className="text-xs font-brockmann-regular text-greyscale-blue-600 leading-4">This will replace the current photo when you save</p>
                </div>
              )}
              
              {/* Show upload area if no photo exists and no new file selected */}
              {!photoPreview && !photoFile && (
                <div className="border-2 border-dashed border-greyscale-blue-300 rounded-md p-6 text-center">
                  <Upload className="w-8 h-8 mx-auto text-greyscale-blue-400 mb-2" />
                  <p className="text-sm font-brockmann-regular text-greyscale-blue-600 leading-5 mb-2">No photo uploaded</p>
                </div>
              )}
              
              <div>
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  onChange={handlePhotoChange}
                  className="cursor-pointer border-greyscale-blue-400"
                />
                <p className="text-xs font-brockmann-regular text-greyscale-blue-600 leading-4 mt-1">
                    {specDraft?.photo_url 
                      ? 'Upload a new photo to replace the current one (will be resized to 900x900). Max 5MB.'
                      : 'Upload a square image (will be resized to 900x900). Max 5MB.'}
                  {!specDraft && ' Photo will be uploaded after draft creation.'}
                </p>
              </div>
            </div>
          </div>


          {/* Actions */}
          <div className="flex gap-3 justify-end pt-4">
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={loading}
                className="h-12 px-6 border-greyscale-blue-200 text-text-primary hover:bg-greyscale-blue-150 font-brockmann-semibold text-base leading-6 tracking-[0.32px]"
              >
                Cancel
              </Button>
            )}
            <Button
              type="submit"
              disabled={loading || uploadingPhoto}
              className="bg-brand-primary text-ui-primary hover:bg-brand-primary/90 h-12 px-6 py-3 rounded-[2px] font-brockmann-semibold text-base leading-6 tracking-[0.32px]"
            >
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
      </div>
    </div>
  );
};

