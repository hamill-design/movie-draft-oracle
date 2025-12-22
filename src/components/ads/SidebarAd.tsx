
import React from 'react';
import AdUnit from './AdUnit';
import { ADSENSE_CONFIG } from '@/config/ads';

interface SidebarAdProps {
  className?: string;
}

const SidebarAd: React.FC<SidebarAdProps> = ({ className = '' }) => {
  return (
    <div className={`w-full ${className}`}>
      <AdUnit
        adSlot={ADSENSE_CONFIG.adSlots.sidebar}
        adFormat="rectangle"
        style={{ width: '300px', height: '250px' }}
      />
    </div>
  );
};

export default SidebarAd;
