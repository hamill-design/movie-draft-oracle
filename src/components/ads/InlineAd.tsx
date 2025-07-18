
import React from 'react';
import AdUnit from './AdUnit';

interface InlineAdProps {
  className?: string;
}

const InlineAd: React.FC<InlineAdProps> = ({ className = '' }) => {
  return (
    <div className={`w-full flex justify-center my-6 ${className}`}>
      <AdUnit
        adSlot="1234567893" // Replace with your inline ad slot ID
        adFormat="fluid"
        style={{ width: '100%', maxWidth: '468px', height: '60px' }}
      />
    </div>
  );
};

export default InlineAd;
