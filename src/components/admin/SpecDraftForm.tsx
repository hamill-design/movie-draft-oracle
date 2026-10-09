import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { SpecDraft } from '@/hooks/useSpecDraftsAdmin';
import { uploadSpecDraftPhoto, uploadSpecDraftHeroImage, deleteSpecDraftPhoto } from '@/utils/specDraftPhotoUpload';
import { Upload, X, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SpecDraftFormProps {
  specDraft?: SpecDraft | null;
  onSubmit: (data: {
    name: string;
    description?: string;
    photoUrl?: string;
    photoFile?: File | null;
    /** undefined = leave as is, null = cleared, string = new/kept URL */
    heroImageUrl?: string | null;
    heroFile?: File | null;
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
  const [heroFile, setHeroFile] = useState<File | null>(null);
  const [heroPreview, setHeroPreview] = useState<string | null>(specDraft?.hero_image_url || null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const heroInputRef = useRef<HTMLInputElement>(null);
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
      if (!heroFile) {
        setHeroPreview(specDraft.hero_image_url || null);
      }
    } else {
      // Reset form for new draft
      setName('');
      setDescription('');
      setPhotoPreview(null);
      setPhotoFile(null);
      setHeroPreview(null);
      setHeroFile(null);
    }
  }, [specDraft, photoFile, heroFile]);

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

  const handleHeroChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload a PNG, JPEG, or WebP image.',
        variant: 'destructive',
      });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'File size exceeds 5MB limit. Please upload a smaller image.',
        variant: 'destructive',
      });
      return;
    }

    setHeroFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setHeroPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleRemoveHero = () => {
    setHeroFile(null);
    setHeroPreview(null);
    if (heroInputRef.current) {
      heroInputRef.current.value = '';
    }
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

    // Hero image: same rules as the photo, but stored/uploaded un-cropped
    let heroImageUrl: string | null | undefined = undefined;
    if (specDraft?.id) {
      if (heroFile) {
        setUploadingPhoto(true);
        try {
          if (specDraft.hero_image_url) {
            try {
              await deleteSpecDraftPhoto(specDraft.hero_image_url);
            } catch (error) {
              console.error('Error deleting old hero image:', error);
            }
          }
          heroImageUrl = await uploadSpecDraftHeroImage(specDraft.id, heroFile);
        } catch (error) {
          toast({
            title: 'Upload Error',
            description: error instanceof Error ? error.message : 'Failed to upload hero image',
            variant: 'destructive',
          });
          setUploadingPhoto(false);
          return;
        } finally {
          setUploadingPhoto(false);
        }
      } else if (heroPreview && heroPreview === specDraft.hero_image_url) {
        heroImageUrl = specDraft.hero_image_url;
      } else if (!heroPreview && specDraft.hero_image_url) {
        try {
          await deleteSpecDraftPhoto(specDraft.hero_image_url);
        } catch (error) {
          console.error('Error deleting hero image:', error);
        }
        heroImageUrl = null;
      }
    }

    console.log('📤 Submitting form with photoUrl:', photoUrl);
    // Submit the form
    // For new drafts, pass the photoFile so parent can upload after creation
    await onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
      photoUrl,
      photoFile: !specDraft ? photoFile : null, // Only pass photoFile for new drafts
      heroImageUrl,
      heroFile: !specDraft ? heroFile : null,
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
                {/* Show current photo if it exists (from database) - use photoPreview which is synced with specDraft.photo_url */}
                {photoPreview && !photoFile && specDraft && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-700">Current Photo:</p>
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
                    <p className="text-xs text-gray-500">Click the X button to remove this photo</p>
                  </div>
                )}
                
                {/* Show preview if a new photo was selected */}
                {photoFile && photoPreview && (
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
                    <p className="text-xs text-gray-500">This will replace the current photo when you save</p>
                  </div>
                )}
                
                {/* Show upload area if no photo exists and no new file selected */}
                {!photoPreview && !photoFile && (
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

            {/* Hero image (wide banner on the public page) */}
            <div className="space-y-2">
              <Label>Hero image (wide banner)</Label>
              <div className="space-y-3">
                {heroPreview ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-700">
                      {heroFile ? 'New hero preview:' : 'Current hero image:'}
                    </p>
                    <div className="relative">
                      <img
                        src={heroPreview}
                        alt="Hero image preview"
                        className="h-40 w-full max-w-2xl rounded-md border border-gray-300 object-cover"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={handleRemoveHero}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-gray-300 rounded-md p-6 text-center">
                    <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                    <p className="text-sm text-gray-600">No hero image — the page falls back to the square photo</p>
                  </div>
                )}
                <div>
                  <Input
                    ref={heroInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    onChange={handleHeroChange}
                    className="cursor-pointer"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Shown behind the breadcrumbs at the top of the special draft page (400px tall on desktop, 240px
                    on mobile, centered and cropped to fill). Use a wide image, around 2400x800. It is not resized or
                    cropped on upload. Max 5MB.
                    {!specDraft && ' Hero image will be uploaded after draft creation.'}
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

