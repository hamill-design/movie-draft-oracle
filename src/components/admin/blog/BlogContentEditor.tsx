import { useCallback, useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Figure } from './figureExtension';
import {
  Bold,
  Italic,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Link2,
  Unlink,
  ImagePlus,
  Undo2,
  Redo2,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { uploadBlogImage } from '@/utils/blogImageUpload';

interface BlogContentEditorProps {
  value: string;
  onChange: (html: string) => void;
  postId: string;
}

interface ToolbarButtonProps {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}

const ToolbarButton = ({ onClick, active, disabled, title, children }: ToolbarButtonProps) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={cn(
      'flex items-center justify-center w-8 h-8 rounded-[4px] transition-colors',
      active
        ? 'bg-purple-400/15 text-purple-400'
        : 'text-greyscale-blue-600 hover:text-foreground hover:bg-greyscale-blue-200/60',
      disabled && 'opacity-40 pointer-events-none'
    )}
  >
    {children}
  </button>
);

const ToolbarDivider = () => <div className="w-px h-5 bg-greyscale-blue-300/60 mx-1" />;

export const BlogContentEditor = ({ value, onChange, postId }: BlogContentEditorProps) => {
  const { toast } = useToast();
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: {
          openOnClick: false,
          autolink: true,
          defaultProtocol: 'https',
          HTMLAttributes: {
            rel: 'noopener noreferrer nofollow',
            target: '_blank',
          },
        },
      }),
      Figure,
      Placeholder.configure({
        placeholder: 'Start writing your post…',
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: cn(
          'tiptap-editor prose max-w-none min-h-[280px] focus:outline-none',
          'prose-headings:font-chaney prose-headings:font-normal prose-headings:text-foreground',
          'prose-p:font-brockmann prose-li:font-brockmann prose-p:text-foreground prose-li:text-foreground',
          'prose-strong:text-foreground prose-a:text-purple-400',
          'prose-blockquote:text-greyscale-blue-600 prose-blockquote:border-l-purple-400',
          'prose-figcaption:text-greyscale-blue-600 prose-figcaption:text-center prose-figcaption:font-brockmann'
        ),
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (value !== editor.getHTML()) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [value, editor]);

  const handleSetLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes('link').href as string | undefined;

    if (previousUrl) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    const url = window.prompt('Enter URL');
    if (!url) return;

    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  const handleImageButtonClick = () => {
    if (!editor) return;
    // When a figure is selected, edit its alt text + caption instead of inserting a new image.
    if (editor.isActive('figure')) {
      const current = editor.getAttributes('figure');
      const alt = window.prompt(
        'Alt text (describe the image for SEO & screen readers):',
        current.alt ?? ''
      );
      if (alt === null) return; // cancelled
      const caption = window.prompt(
        'Caption (optional — shown beneath the image):',
        current.caption ?? ''
      );
      if (caption === null) return; // cancelled
      editor
        .chain()
        .focus()
        .updateAttributes('figure', {
          alt: alt.trim() || null,
          caption: caption.trim() || null,
        })
        .run();
      return;
    }
    fileInputRef.current?.click();
  };

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !editor) return;

    setUploadingImage(true);
    try {
      const url = await uploadBlogImage(postId, file, 'content');
      const alt = window.prompt('Alt text (describe the image for SEO & screen readers):', '') ?? '';
      const caption = window.prompt('Caption (optional — shown beneath the image):', '') ?? '';
      editor
        .chain()
        .focus()
        .setFigure({ src: url, alt: alt.trim() || null, caption: caption.trim() || null })
        .run();
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to upload image',
        variant: 'destructive',
      });
    } finally {
      setUploadingImage(false);
    }
  };

  if (!editor) return null;

  return (
    <div className="bg-ui-primary border border-greyscale-blue-200 rounded-[8px] overflow-hidden">
      <div className="flex flex-wrap items-center gap-1 p-2 border-b border-greyscale-blue-200">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          title="Bold"
        >
          <Bold className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          title="Italic"
        >
          <Italic className="w-4 h-4" />
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive('heading', { level: 2 })}
          title="Heading 2"
        >
          <Heading2 className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive('heading', { level: 3 })}
          title="Heading 3"
        >
          <Heading3 className="w-4 h-4" />
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
          title="Bullet list"
        >
          <List className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
          title="Numbered list"
        >
          <ListOrdered className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive('blockquote')}
          title="Quote"
        >
          <Quote className="w-4 h-4" />
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarButton
          onClick={handleSetLink}
          active={editor.isActive('link')}
          title={editor.isActive('link') ? 'Remove link' : 'Add link'}
        >
          {editor.isActive('link') ? <Unlink className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
        </ToolbarButton>
        <ToolbarButton
          onClick={handleImageButtonClick}
          active={editor.isActive('figure')}
          disabled={uploadingImage}
          title={editor.isActive('figure') ? 'Edit image alt & caption' : 'Insert image'}
        >
          {uploadingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
        </ToolbarButton>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
          className="hidden"
          onChange={handleImageFileChange}
        />

        <ToolbarDivider />

        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="Undo"
        >
          <Undo2 className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="Redo"
        >
          <Redo2 className="w-4 h-4" />
        </ToolbarButton>
      </div>

      <div className="px-4 py-3">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
};
