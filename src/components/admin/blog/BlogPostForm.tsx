import React, { useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BlogPost, BlogPostInput, BlogPostStatus } from '@/hooks/useBlogPostsAdmin';
import { BlogContentEditor } from './BlogContentEditor';
import { slugifyBlogTitle, uniqueBlogSlug } from '@/utils/blogSlug';
import { uploadBlogImage, deleteBlogImage } from '@/utils/blogImageUpload';
import { supabase } from '@/integrations/supabase/client';
import { Upload, X, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export interface BlogPostFormValues extends BlogPostInput {
  id: string;
}

interface BlogPostFormProps {
  post?: BlogPost | null;
  onSubmit: (data: BlogPostFormValues) => Promise<void>;
  onCancel?: () => void;
  loading?: boolean;
}

export const BlogPostForm: React.FC<BlogPostFormProps> = ({
  post,
  onSubmit,
  onCancel,
  loading = false,
}) => {
  const { toast } = useToast();
  const [postId] = useState(() => post?.id ?? crypto.randomUUID());
  const originalCoverImageUrl = useRef(post?.cover_image_url ?? null);

  const [title, setTitle] = useState(post?.title || '');
  const [slug, setSlug] = useState(post?.slug || '');
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(!!post?.slug);
  const [excerpt, setExcerpt] = useState(post?.excerpt || '');
  const [content, setContent] = useState(post?.content || '');
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(post?.cover_image_url ?? null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [seoTitle, setSeoTitle] = useState(post?.seo_title || '');
  const [seoDescription, setSeoDescription] = useState(post?.seo_description || '');
  const [status, setStatus] = useState<BlogPostStatus>(post?.status || 'draft');
  const [savingSlug, setSavingSlug] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const displaySlug = slugManuallyEdited ? slug : slugifyBlogTitle(title);

  const handleSlugChange = (value: string) => {
    setSlugManuallyEdited(true);
    setSlug(value);
  };

  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setUploadingCover(true);
    try {
      const url = await uploadBlogImage(postId, file, 'cover');
      setCoverImageUrl(url);
    } catch (err) {
      toast({
        title: 'Upload Error',
        description: err instanceof Error ? err.message : 'Failed to upload image',
        variant: 'destructive',
      });
    } finally {
      setUploadingCover(false);
    }
  };

  const handleRemoveCover = () => {
    setCoverImageUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Post title is required',
        variant: 'destructive',
      });
      return;
    }

    setSavingSlug(true);
    let finalSlug: string;
    try {
      finalSlug = await uniqueBlogSlug(supabase, displaySlug || title, post?.id);
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to generate a unique URL slug',
        variant: 'destructive',
      });
      setSavingSlug(false);
      return;
    }
    setSavingSlug(false);

    await onSubmit({
      id: postId,
      title: title.trim(),
      slug: finalSlug,
      excerpt: excerpt.trim() || null,
      content,
      cover_image_url: coverImageUrl,
      seo_title: seoTitle.trim() || null,
      seo_description: seoDescription.trim() || null,
      status,
    });

    // Clean up a replaced/removed cover image only after the save succeeds,
    // so a cancelled edit never leaves the saved post pointing at a deleted file.
    const original = originalCoverImageUrl.current;
    if (original && original !== coverImageUrl) {
      try {
        await deleteBlogImage(original);
      } catch (err) {
        console.error('Error deleting old cover image:', err);
      }
    }
  };

  const isSaving = loading || savingSlug;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{post ? 'Edit Post' : 'New Post'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., The Best Heist Movies of All Time"
                required
              />
            </div>

            {/* Slug */}
            <div className="space-y-2">
              <Label htmlFor="slug">URL Slug</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-greyscale-blue-300 font-brockmann whitespace-nowrap">/blog/</span>
                <Input
                  id="slug"
                  value={displaySlug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  placeholder="post-url-slug"
                />
              </div>
              <p className="text-xs text-greyscale-blue-300">
                Auto-generated from the title. Edit to customize the URL.
              </p>
            </div>

            {/* Excerpt */}
            <div className="space-y-2">
              <Label htmlFor="excerpt">Excerpt (Optional)</Label>
              <Textarea
                id="excerpt"
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                placeholder="A short summary shown on the blog index and used as the meta description"
                rows={3}
              />
            </div>

            {/* Cover Image */}
            <div className="space-y-2">
              <Label>Cover Image</Label>
              <div className="space-y-3">
                {coverImageUrl && (
                  <div className="relative inline-block">
                    <img
                      src={coverImageUrl}
                      alt="Cover preview"
                      className="w-full max-w-md h-48 object-cover rounded-md border border-greyscale-blue-200"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={handleRemoveCover}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                )}

                {!coverImageUrl && !uploadingCover && (
                  <div className="border-2 border-dashed border-greyscale-blue-200 rounded-md p-6 text-center">
                    <Upload className="w-8 h-8 mx-auto text-greyscale-blue-400 mb-2" />
                    <p className="text-sm text-greyscale-blue-300">No cover image uploaded</p>
                  </div>
                )}

                <div>
                  <Input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                    onChange={handleCoverChange}
                    disabled={uploadingCover}
                    className="cursor-pointer"
                  />
                  <p className="text-xs text-greyscale-blue-300 mt-1 flex items-center gap-1">
                    {uploadingCover && <Loader2 className="w-3 h-3 animate-spin" />}
                    {uploadingCover
                      ? 'Uploading...'
                      : 'Recommended: a wide image (resized to a max of 1600px). Max 5MB.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="space-y-2">
              <Label>Content</Label>
              <BlogContentEditor value={content} onChange={setContent} postId={postId} />
            </div>

            {/* SEO */}
            <div className="space-y-4 pt-4 border-t border-greyscale-blue-200">
              <h3 className="text-sm font-brockmann font-semibold text-greyscale-blue-100 uppercase tracking-wide">
                SEO (Optional)
              </h3>
              <div className="space-y-2">
                <Label htmlFor="seo-title">SEO Title</Label>
                <Input
                  id="seo-title"
                  value={seoTitle}
                  onChange={(e) => setSeoTitle(e.target.value)}
                  placeholder={title || 'Defaults to the post title'}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="seo-description">SEO Description</Label>
                <Textarea
                  id="seo-description"
                  value={seoDescription}
                  onChange={(e) => setSeoDescription(e.target.value)}
                  placeholder="Defaults to the excerpt, or a snippet of the post content"
                  rows={2}
                />
              </div>
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={(value) => setStatus(value as BlogPostStatus)}>
                <SelectTrigger id="status" className="w-full sm:w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-end">
              {onCancel && (
                <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
                  Cancel
                </Button>
              )}
              <Button type="submit" disabled={isSaving || uploadingCover}>
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : post ? (
                  'Update Post'
                ) : (
                  'Create Post'
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
