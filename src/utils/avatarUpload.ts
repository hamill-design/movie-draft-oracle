import { supabase } from '@/integrations/supabase/client';

const PENDING_AVATAR_KEY = 'md_pending_avatar';

const resizeImageToSquare = (file: File, size: number): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Could not get canvas context')); return; }

        canvas.width = size;
        canvas.height = size;

        const sourceSize = Math.min(img.width, img.height);
        const sourceX = (img.width - sourceSize) / 2;
        const sourceY = (img.height - sourceSize) / 2;

        ctx.drawImage(img, sourceX, sourceY, sourceSize, sourceSize, 0, 0, size, size);

        canvas.toBlob(
          (blob) => { blob ? resolve(blob) : reject(new Error('Failed to create blob')); },
          'image/jpeg',
          0.85
        );
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
};

const dataUrlToBlob = (dataUrl: string): Blob => {
  const [header, data] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg';
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
};

export const validateAvatarFile = (file: File): string | null => {
  const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
  if (!validTypes.includes(file.type)) return 'Please upload a PNG, JPEG, or WebP image.';
  if (file.size > 5 * 1024 * 1024) return 'File size exceeds 5MB. Please upload a smaller image.';
  return null;
};

export const fileToPreviewDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
};

export const uploadAvatar = async (userId: string, file: File): Promise<string> => {
  const validationError = validateAvatarFile(file);
  if (validationError) throw new Error(validationError);

  const resized = await resizeImageToSquare(file, 400);
  const filePath = `${userId}/avatar.jpg`;

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(filePath, resized, { contentType: 'image/jpeg', upsert: true, cacheControl: '3600' });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
  // Bust cache by appending timestamp
  return `${data.publicUrl}?t=${Date.now()}`;
};

export const uploadAvatarAndUpdateProfile = async (userId: string, file: File): Promise<string> => {
  const avatarUrl = await uploadAvatar(userId, file);

  const { error } = await supabase
    .from('profiles')
    .update({ avatar_url: avatarUrl })
    .eq('id', userId);

  if (error) throw error;
  return avatarUrl;
};

export const savePendingAvatar = async (file: File): Promise<void> => {
  const dataUrl = await fileToPreviewDataUrl(file);
  localStorage.setItem(PENDING_AVATAR_KEY, dataUrl);
};

export const getPendingAvatar = (): string | null => {
  return localStorage.getItem(PENDING_AVATAR_KEY);
};

export const clearPendingAvatar = (): void => {
  localStorage.removeItem(PENDING_AVATAR_KEY);
};

export const uploadPendingAvatar = async (userId: string): Promise<string | null> => {
  const dataUrl = getPendingAvatar();
  if (!dataUrl) return null;

  try {
    const blob = dataUrlToBlob(dataUrl);
    const file = new File([blob], 'avatar.jpg', { type: blob.type });
    const avatarUrl = await uploadAvatarAndUpdateProfile(userId, file);
    clearPendingAvatar();
    return avatarUrl;
  } catch (error) {
    console.error('Failed to upload pending avatar:', error);
    clearPendingAvatar();
    return null;
  }
};

export const getInitials = (name: string | null | undefined, email: string | null | undefined): string => {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (email) return email[0].toUpperCase();
  return '?';
};
