
import React, { useEffect } from 'react';
import { ADSENSE_CONFIG, ADS_ENABLED } from '@/config/ads';

interface AdUnitProps {
  adSlot: string;
  adFormat?: string;
  style?: React.CSSProperties;
  className?: string;
  responsive?: boolean;
}

const AdUnit: React.FC<AdUnitProps> = ({
  adSlot,
  adFormat = 'auto',
  style,
  className = '',
  responsive = true
}) => {
  useEffect(() => {
    if (!ADS_ENABLED) return;
    try {
      // Push ad to Google AdSense
      if (typeof window !== 'undefined' && (window as any).adsbygoogle) {
        ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
      }
    } catch (error) {
      console.error('AdSense error:', error);
    }
  }, []);

  if (!ADS_ENABLED) return null;

  return (
    <div className={`ad-container ${className}`} style={style}>
      <ins
        className="adsbygoogle"
        style={{ display: 'block', ...style }}
        data-ad-client={ADSENSE_CONFIG.publisherId}
        data-ad-slot={adSlot}
        data-ad-format={adFormat}
        data-full-width-responsive={responsive.toString()}
      />
    </div>
  );
};

export default AdUnit;
