
import React from 'react';
import AdUnit from './AdUnit';
import { ADSENSE_CONFIG } from '@/config/ads';

interface InlineAdProps {
  className?: string;
}

const InlineAd: React.FC<InlineAdProps> = ({ className = '' }) => {
  return (
    <div className={`w-full flex justify-center ${className}`}>
      <AdUnit
        adSlot={ADSENSE_CONFIG.adSlots.inline}
        adFormat="auto"
        responsive={true}
        style={{ width: '100%', maxWidth: '100%' }}
      />
    </div>
  );
};

export default InlineAd;
