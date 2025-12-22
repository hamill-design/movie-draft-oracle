
import React from 'react';
import AdUnit from './AdUnit';
import { ADSENSE_CONFIG } from '@/config/ads';

interface InlineAdProps {
  className?: string;
}

const InlineAd: React.FC<InlineAdProps> = ({ className = '' }) => {
  return (
    <div className={`w-full flex justify-center my-6 ${className}`}>
      <AdUnit
        adSlot={ADSENSE_CONFIG.adSlots.inline}
        adFormat="fluid"
        style={{ width: '100%', maxWidth: '468px', height: '60px' }}
      />
    </div>
  );
};

export default InlineAd;
