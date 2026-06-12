import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BlogPost } from '@/hooks/useBlogPostsAdmin';
import { Edit, Trash2, Loader2, FileText, Search } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface BlogPostListProps {
  posts: BlogPost[];
  onEdit: (post: BlogPost) => void;
  onDelete: (id: string) => void;
  onCreateNew?: () => void;
  loading?: boolean;
}

export const BlogPostList: React.FC<BlogPostListProps> = ({
  posts,
  onEdit,
  onDelete,
  onCreateNew,
  loading = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredPosts = posts.filter((post) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return post.title.toLowerCase().includes(query) || post.slug.toLowerCase().includes(query);
  });

  if (loading) {
    return (
      <div className="bg-greyscale-blue-100 rounded-[8px] shadow-[0px_0px_3px_0px_rgba(0,0,0,0.25)] p-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-greyscale-blue-100 rounded-[8px] shadow-[0px_0px_3px_0px_rgba(0,0,0,0.25)] p-6 space-y-6">
      {/* Search and Create Button Section */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex-1 min-w-0 sm:min-w-[294px]">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-6 h-6 text-greyscale-blue-400 pointer-events-none z-10" />
            <Input
              placeholder="Search posts"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-14 h-12 pr-4 py-3 border-greyscale-blue-400 rounded-[2px] text-sm"
              style={{ fontFamily: 'Brockmann', fontWeight: 500 }}
            />
          </div>
        </div>
        {onCreateNew && (
          <Button
            onClick={onCreateNew}
            className="bg-brand-primary text-ui-primary hover:bg-brand-primary/90 h-12 px-6 py-3 rounded-[2px] whitespace-nowrap"
            style={{ fontFamily: 'Brockmann', fontWeight: 600, fontSize: '16px', lineHeight: '24px', letterSpacing: '0.32px' }}
          >
            New Post
          </Button>
        )}
      </div>

      {/* Posts List */}
      {filteredPosts.length === 0 ? (
        <div className="bg-ui-primary border border-greyscale-blue-200 rounded-[8px] p-6 text-center">
          <p
            className="text-greyscale-blue-600"
            style={{ fontFamily: 'Brockmann', fontWeight: 400, fontSize: '14px', lineHeight: '20px' }}
          >
            {searchQuery ? 'No posts match your search' : 'No blog posts yet. Create one to get started.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredPosts.map((post) => (
            <div
              key={post.id}
              className="bg-ui-primary border border-greyscale-blue-200 rounded-[8px] p-[18px] flex flex-col sm:flex-row gap-4 items-center justify-between"
            >
              {/* Left side: Thumbnail, Title, meta */}
              <div className="flex gap-4 items-center flex-1 min-w-0">
                {post.cover_image_url ? (
                  <img
                    src={post.cover_image_url}
                    alt={post.title}
                    className="w-12 h-12 sm:w-[72px] sm:h-[72px] min-w-[48px] min-h-[48px] object-cover rounded-[3px]"
                  />
                ) : (
                  <div className="w-12 h-12 sm:w-[72px] sm:h-[72px] min-w-[48px] min-h-[48px] bg-greyscale-blue-200 rounded-[3px] flex items-center justify-center">
                    <FileText className="w-6 h-6 text-greyscale-blue-400" />
                  </div>
                )}

                {/* Title and meta */}
                <div className="flex flex-col gap-[2px] min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3
                      className="text-lg text-[#2b2f31] truncate"
                      style={{ fontFamily: 'Brockmann', fontWeight: 500, fontSize: '18px', lineHeight: '26px' }}
                    >
                      {post.title}
                    </h3>
                    <span
                      className={cn(
                        'text-xs px-2 py-0.5 rounded shrink-0',
                        post.status === 'published'
                          ? 'bg-purple-300/20 text-purple-300'
                          : 'bg-greyscale-blue-200 text-greyscale-blue-500'
                      )}
                      style={{ fontFamily: 'Brockmann', fontWeight: 400 }}
                    >
                      {post.status === 'published' ? 'Published' : 'Draft'}
                    </span>
                  </div>
                  <p
                    className="text-sm text-gray-500 truncate"
                    style={{ fontFamily: 'Brockmann', fontWeight: 400, fontSize: '14px', lineHeight: '20px' }}
                  >
                    /blog/{post.slug} · Updated {format(new Date(post.updated_at), 'MMM d, yyyy')}
                  </p>
                </div>
              </div>

              {/* Right side: Action Icons */}
              <div className="flex gap-2 items-center shrink-0">
                <button
                  onClick={() => onEdit(post)}
                  className="p-3 rounded-[2px] hover:bg-greyscale-blue-200 transition-colors"
                  title="Edit"
                >
                  <Edit className="w-6 h-6 text-text-primary" />
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Are you sure you want to delete "${post.title}"?`)) {
                      onDelete(post.id);
                    }
                  }}
                  className="p-3 rounded-[2px] hover:bg-greyscale-blue-200 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-6 h-6 text-text-primary" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
