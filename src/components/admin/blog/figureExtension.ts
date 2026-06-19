import { Node, mergeAttributes } from '@tiptap/core';

export interface SetFigureOptions {
  src: string;
  alt?: string | null;
  caption?: string | null;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    figure: {
      /** Insert an image as a <figure> with optional alt text and a visible caption. */
      setFigure: (options: SetFigureOptions) => ReturnType;
    };
  }
}

/**
 * A block-level image node that renders as a semantic
 * `<figure><img alt><figcaption></figure>`.
 *
 * `alt` (accessibility + image SEO) and `caption` (visible, indexable on-page
 * text) are stored as node attributes and edited via the toolbar — the node is
 * atomic, so the figure is selected as a single unit. The `<figcaption>` is only
 * rendered when a caption is present.
 */
export const Figure = Node.create({
  name: 'figure',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: null },
      caption: { default: null },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'figure',
        getAttrs: (node) => {
          const el = node as HTMLElement;
          const img = el.querySelector('img');
          if (!img) return false;
          const figcaption = el.querySelector('figcaption');
          return {
            src: img.getAttribute('src'),
            alt: img.getAttribute('alt'),
            caption: figcaption?.textContent?.trim() || null,
          };
        },
      },
    ];
  },

  renderHTML({ node }) {
    const { src, alt, caption } = node.attrs as {
      src: string;
      alt?: string | null;
      caption?: string | null;
    };
    const img = ['img', mergeAttributes({ src, alt: alt ?? '', class: 'rounded-md' })];
    if (caption) {
      return ['figure', {}, img, ['figcaption', {}, caption]];
    }
    return ['figure', {}, img];
  },

  addCommands() {
    return {
      setFigure:
        ({ src, alt, caption }) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { src, alt: alt || null, caption: caption || null },
          }),
    };
  },
});
