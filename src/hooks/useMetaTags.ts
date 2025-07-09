import { useEffect } from 'react';

interface MetaTag {
  property?: string;
  name?: string;
  content: string;
}

export const useMetaTags = (tags: MetaTag[], title?: string) => {
  useEffect(() => {
    // Store original tags to restore later
    const originalTags: { element: HTMLMetaElement; originalContent: string }[] = [];
    const originalTitle = document.title;

    // Update title
    if (title) {
      document.title = title;
    }

    // Update or create meta tags
    tags.forEach(tag => {
      const selector = tag.property 
        ? `meta[property="${tag.property}"]`
        : `meta[name="${tag.name}"]`;
      
      let element = document.querySelector(selector) as HTMLMetaElement;
      
      if (element) {
        // Store original content for restoration
        originalTags.push({ element, originalContent: element.content });
        element.content = tag.content;
      } else {
        // Create new meta tag
        element = document.createElement('meta');
        if (tag.property) element.setAttribute('property', tag.property);
        if (tag.name) element.setAttribute('name', tag.name);
        element.content = tag.content;
        document.head.appendChild(element);
        originalTags.push({ element, originalContent: '' });
      }
    });

    // Cleanup function to restore original tags
    return () => {
      document.title = originalTitle;
      originalTags.forEach(({ element, originalContent }) => {
        if (originalContent) {
          element.content = originalContent;
        } else {
          element.remove();
        }
      });
    };
  }, [tags, title]);
};

export const generateMetaTags = (
  draftTitle: string,
  winnerName: string,
  winnerScore: number,
  shareImageUrl?: string
): MetaTag[] => {
  const title = `${draftTitle} - CineDraft Championship Results`;
  const description = `🏆 ${winnerName} wins "${draftTitle}" with ${winnerScore.toFixed(1)} points! Check out the epic movie draft battle results.`;
  const currentUrl = window.location.href;
  const imageUrl = shareImageUrl || 'https://lovable.dev/opengraph-image-p98pqg.png';

  return [
    // Open Graph tags
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:type', content: 'website' },
    { property: 'og:url', content: currentUrl },
    { property: 'og:image', content: imageUrl },
    { property: 'og:image:width', content: '400' },
    { property: 'og:image:height', content: '600' },
    { property: 'og:site_name', content: 'CineDraft' },
    
    // Twitter Card tags
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: title },
    { name: 'twitter:description', content: description },
    { name: 'twitter:image', content: imageUrl },
    { name: 'twitter:site', content: '@CineDraft' },
    
    // General meta tags
    { name: 'description', content: description },
  ];
};