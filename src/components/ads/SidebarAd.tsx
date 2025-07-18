
import React from 'react';
import AdUnit from './AdUnit';

interface SidebarAdProps {
  className?: string;
}

const SidebarAd: React.FC<SidebarAdProps> = ({ className = '' }) => {
  return (
    <div className={`w-full ${className}`}>
      <AdUnit
        adSlot="1234567892" // Replace with your sidebar ad slot ID
        adFormat="rectangle"
        style={{ width: '300px', height: '250px' }}
      />
    </div>
  );
};

export default SidebarAd;
