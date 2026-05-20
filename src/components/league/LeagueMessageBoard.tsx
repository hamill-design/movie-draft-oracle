import React, { useState, useRef, useEffect } from 'react';
import { Send, Trash2, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useLeagueMessages, type LeagueMessage } from '@/hooks/useLeagues';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

const getInitials = (name: string | null | undefined) =>
  !name ? '?' : name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

// ── Single reply ──────────────────────────────────────────────────────────────
const Reply: React.FC<{
  msg: LeagueMessage;
  currentUserId?: string;
  isAdmin: boolean;
  onDelete: (id: string) => void;
  layout?: 'default' | 'dashboard';
}> = ({ msg, currentUserId, isAdmin, onDelete, layout = 'default' }) => {
  const dash = layout === 'dashboard';
  return (
    <div className="flex gap-3 py-2">
      <Avatar className="w-6 h-6 shrink-0 mt-0.5">
        <AvatarImage src={msg.author?.avatar_url ?? undefined} />
        <AvatarFallback className="text-[10px]">{getInitials(msg.author?.name)}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span
            className={cn(
              'text-xs font-semibold font-brockmann',
              dash ? 'text-[#FAFEFF]' : 'text-greyscale-blue-100',
            )}
          >
            {msg.author?.name ?? 'Unknown'}
          </span>
          <span
            className={cn(
              'text-[10px] font-brockmann',
              dash ? 'text-[#9EA3A1]' : 'text-greyscale-blue-400',
            )}
          >
            {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
          </span>
        </div>
        <p
          className={cn(
            'text-xs font-brockmann mt-0.5 whitespace-pre-wrap break-words',
            dash ? 'text-[#D6DBDB]' : 'text-greyscale-blue-200',
          )}
        >
          {msg.content}
        </p>
      </div>
      {(msg.user_id === currentUserId || isAdmin) && (
        <button
          type="button"
          onClick={() => onDelete(msg.id)}
          className={cn(
            'shrink-0 transition-colors mt-0.5',
            dash ? 'text-[#9EA3A1] hover:text-error-red-400' : 'text-greyscale-blue-400 hover:text-error-red-400',
          )}
          aria-label="Delete reply"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      )}
    </div>
  );
};

// ── Single post ───────────────────────────────────────────────────────────────
const Post: React.FC<{
  msg: LeagueMessage;
  replies: LeagueMessage[];
  currentUserId?: string;
  isAdmin: boolean;
  onDelete: (id: string) => void;
  onReply: (parentId: string, content: string) => Promise<boolean>;
  layout?: 'default' | 'dashboard';
}> = ({ msg, replies, currentUserId, isAdmin, onDelete, onReply, layout = 'default' }) => {
  const dash = layout === 'dashboard';
  const [showReplies, setShowReplies] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);

  const handleReply = async () => {
    if (!replyText.trim()) return;
    setSending(true);
    const ok = await onReply(msg.id, replyText);
    if (ok) setReplyText('');
    setSending(false);
  };

  const postShell = dash
    ? 'rounded border border-white/10 bg-white/[0.05] p-4 space-y-3 outline outline-1 -outline-offset-1 outline-white/10 shadow-[0px_0px_4px_rgba(113,66,255,0.15)]'
    : 'rounded-lg border border-white/10 bg-white/5 p-4 space-y-3';
  const postShellStyle = dash ? undefined : { boxShadow: '0px 0px 4px rgba(113, 66, 255, 0.15)' };

  const replyInputClass = dash
    ? 'min-h-0 h-8 resize-none text-xs py-1.5 rounded-[2px] bg-white/[0.05] border-white/15 text-[#FAFEFF] placeholder:text-[#9EA3A1] font-brockmann'
    : 'min-h-0 h-8 resize-none text-xs py-1.5 bg-white/5 border-white/15 text-greyscale-blue-100 placeholder:text-greyscale-blue-400 font-brockmann';

  return (
    <div className={postShell} style={postShellStyle}>
      <div className="flex gap-3">
        <Avatar className="w-8 h-8 shrink-0 mt-0.5">
          <AvatarImage src={msg.author?.avatar_url ?? undefined} />
          <AvatarFallback className="text-xs font-brockmann">{getInitials(msg.author?.name)}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span
              className={cn(
                'text-sm font-semibold font-brockmann',
                dash ? 'text-[#FAFEFF]' : 'text-greyscale-blue-100',
              )}
            >
              {msg.author?.name ?? 'Unknown'}
            </span>
            <span
              className={cn(
                'text-xs font-brockmann',
                dash ? 'text-[#9EA3A1]' : 'text-greyscale-blue-400',
              )}
            >
              {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
            </span>
          </div>
          <p
            className={cn(
              'text-sm font-brockmann mt-1 whitespace-pre-wrap break-words',
              dash ? 'text-[#D6DBDB]' : 'text-greyscale-blue-200',
            )}
          >
            {msg.content}
          </p>
        </div>
        {(msg.user_id === currentUserId || isAdmin) && (
          <button
            type="button"
            onClick={() => onDelete(msg.id)}
            className={cn(
              'shrink-0 self-start transition-colors',
              dash ? 'text-[#9EA3A1] hover:text-error-red-400' : 'text-greyscale-blue-400 hover:text-error-red-400',
            )}
            aria-label="Delete post"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="pl-11">
        <button
          type="button"
          onClick={() => setShowReplies(v => !v)}
          className={cn(
            'flex items-center gap-1.5 text-xs font-brockmann transition-colors',
            dash ? 'text-[#9EA3A1] hover:text-[#D6DBDB]' : 'text-greyscale-blue-400 hover:text-greyscale-blue-200',
          )}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          {replies.length > 0
            ? `${replies.length} ${replies.length === 1 ? 'reply' : 'replies'}`
            : 'Reply'}
          {replies.length > 0 && (
            showReplies
              ? <ChevronUp className="w-3 h-3" />
              : <ChevronDown className="w-3 h-3" />
          )}
        </button>

        {(showReplies || replyText) && (
          <div className="mt-3 space-y-1 border-l border-white/10 pl-3">
            {showReplies && replies.map(r => (
              <Reply
                key={r.id}
                msg={r}
                currentUserId={currentUserId}
                isAdmin={isAdmin}
                onDelete={onDelete}
                layout={layout}
              />
            ))}

            <div className="flex gap-2 pt-2">
              <Textarea
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                placeholder="Write a reply…"
                className={replyInputClass}
                rows={1}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReply(); }
                }}
              />
              <Button
                type="button"
                size="sm"
                className={cn(
                  'h-8 px-3 shrink-0 rounded-[2px]',
                  dash && 'bg-[#640AFF] hover:bg-[#640AFF]/90 text-white disabled:opacity-50',
                )}
                disabled={!replyText.trim() || sending}
                onClick={handleReply}
              >
                <Send className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}

        {!showReplies && !replyText && (
          <div className="flex gap-2 mt-2">
            <Textarea
              value={replyText}
              onChange={e => { setReplyText(e.target.value); if (e.target.value) setShowReplies(true); }}
              placeholder="Write a reply…"
              className={replyInputClass}
              rows={1}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReply(); }
              }}
            />
            <Button
              type="button"
              size="sm"
              className={cn(
                'h-8 px-3 shrink-0 rounded-[2px]',
                dash && 'bg-[#640AFF] hover:bg-[#640AFF]/90 text-white disabled:opacity-50',
              )}
              disabled={!replyText.trim() || sending}
              onClick={handleReply}
            >
              <Send className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Board ─────────────────────────────────────────────────────────────────────
interface Props {
  leagueId: string;
  isAdmin: boolean;
  /** Wider league-dashboard styling (composer + thread cards) */
  layout?: 'default' | 'dashboard';
}

const LeagueMessageBoard: React.FC<Props> = ({ leagueId, isAdmin, layout = 'default' }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { posts, repliesMap, loading, sendMessage, deleteMessage } = useLeagueMessages(leagueId);
  const [newPost, setNewPost] = useState('');
  const [posting, setPosting] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const dash = layout === 'dashboard';

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [posts.length]);

  const handlePost = async () => {
    if (!newPost.trim()) return;
    setPosting(true);
    const ok = await sendMessage(newPost);
    setPosting(false);
    if (ok) {
      setNewPost('');
    } else {
      toast({ title: 'Could not post message.', variant: 'destructive' });
    }
  };

  if (loading) {
    return <p className="text-sm text-greyscale-blue-300 font-brockmann py-8 text-center">Loading…</p>;
  }

  const composerShell = dash
    ? 'rounded border border-white/10 bg-white/[0.05] p-4 space-y-3 outline outline-1 -outline-offset-1 outline-white/10 shadow-[0px_0px_4px_rgba(113,66,255,0.15)]'
    : 'rounded-lg border border-white/10 bg-white/5 p-4 space-y-3';
  const composerStyle = dash ? undefined : { boxShadow: '0px 0px 4px rgba(113, 66, 255, 0.15)' };

  return (
    <div className={cn('space-y-4', dash && 'w-full max-w-[768px] mx-auto')}>
      <div className={composerShell} style={composerStyle}>
        <Textarea
          value={newPost}
          onChange={e => setNewPost(e.target.value)}
          placeholder="Post something to the league…"
          className={cn(
            'resize-none font-brockmann text-sm min-h-[72px]',
            dash
              ? 'rounded-[2px] border border-white/15 bg-white/[0.05] text-[#FAFEFF] placeholder:text-[#9EA3A1]'
              : 'bg-white/5 border-white/15 text-greyscale-blue-100 placeholder:text-greyscale-blue-400',
          )}
          onKeyDown={e => {
            if (e.key === 'Enter' && e.metaKey) { e.preventDefault(); handlePost(); }
          }}
        />
        <div className="flex items-center justify-between gap-3">
          <span
            className={cn(
              'text-xs font-brockmann',
              dash ? 'text-[#9EA3A1]' : 'text-greyscale-blue-400',
            )}
          >
            ⌘ + Enter to post
          </span>
          <Button
            type="button"
            size="sm"
            className={cn(
              'flex items-center gap-2 rounded-[2px] font-brockmann font-medium',
              dash && 'bg-[#640AFF] hover:bg-[#640AFF]/90 text-white disabled:opacity-50',
            )}
            disabled={!newPost.trim() || posting}
            onClick={handlePost}
          >
            <Send className="w-3.5 h-3.5" />
            {posting ? 'Posting…' : 'Post'}
          </Button>
        </div>
      </div>

      {posts.length === 0 ? (
        <div className="text-center py-12 space-y-2">
          <MessageSquare className={cn('w-8 h-8 mx-auto', dash ? 'text-[#9EA3A1]' : 'text-greyscale-blue-400')} />
          <p className="text-sm text-greyscale-blue-300 font-brockmann">No posts yet.</p>
          <p className="text-xs text-greyscale-blue-400 font-brockmann">Be the first to say something.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map(post => (
            <Post
              key={post.id}
              msg={post}
              replies={repliesMap[post.id] ?? []}
              currentUserId={user?.id}
              isAdmin={isAdmin}
              onDelete={deleteMessage}
              onReply={(parentId, content) => sendMessage(content, parentId)}
              layout={layout}
            />
          ))}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
};

export default LeagueMessageBoard;
