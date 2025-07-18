
import React from 'react';
import AdUnit from './AdUnit';

interface BannerAdProps {
  className?: string;
}

const BannerAd: React.FC<BannerAdProps> = ({ className = '' }) => {
  return (
    <div className={`w-full flex justify-center my-4 ${className}`}>
      <AdUnit
        adSlot="1234567890" // Replace with your actual ad slot ID
        adFormat="banner"
        style={{ width: '728px', height: '90px' }}
        className="hidden md:block"
      />
      {/* Mobile banner */}
      <AdUnit
        adSlot="1234567891" // Replace with your mobile ad slot ID
        adFormat="banner"
        style={{ width: '320px', height: '50px' }}
        className="block md:hidden"
      />
    </div>
  );
};

export default BannerAd;
