
import React from 'react';
import AdUnit from './AdUnit';
import { ADSENSE_CONFIG } from '@/config/ads';

interface BannerAdProps {
  className?: string;
}

const BannerAd: React.FC<BannerAdProps> = ({ className = '' }) => {
  return (
    <div className={`w-full flex justify-center my-4 ${className}`}>
      <AdUnit
        adSlot={ADSENSE_CONFIG.adSlots.banner}
        adFormat="banner"
        style={{ width: '728px', height: '90px' }}
        className="hidden md:block"
      />
      {/* Mobile banner */}
      <AdUnit
        adSlot={ADSENSE_CONFIG.adSlots.bannerMobile}
        adFormat="banner"
        style={{ width: '320px', height: '50px' }}
        className="block md:hidden"
      />
    </div>
  );
};

export default BannerAd;
