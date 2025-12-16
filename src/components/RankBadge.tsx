import React from 'react';

interface RankBadgeProps {
  rank: number;
  size?: number;
  className?: string;
}

const RankBadge: React.FC<RankBadgeProps> = ({ rank, size = 32, className = '' }) => {
  // Determine badge styling based on rank
  const getBadgeStyles = () => {
    if (rank === 1) {
      // First place - Yellow with linear gradient border for metallic shine effect
      return {
        borderGradient: 'linear-gradient(to bottom right, #FFF2B2 33%, #F0AA11 67%)',
        innerBackground: '#FFD60A',
        textColor: '#1D1D1F',
        borderWidth: 2,
      };
    } else if (rank === 2) {
      // Second place - Grey with linear gradient border for metallic shine effect
      return {
        borderGradient: 'linear-gradient(to bottom right, #E5E5E5 37%, #666666 63%)',
        innerBackground: '#CCCCCC',
        textColor: '#1D1D1F',
        borderWidth: 2,
      };
    } else if (rank === 3) {
      // Third place - Bronze with linear gradient border for metallic shine effect
      return {
        borderGradient: 'linear-gradient(to bottom right, #FFAE78 33%, #95430C 67%)',
        innerBackground: '#DE7E3E',
        textColor: '#1D1D1F',
        borderWidth: 2,
      };
    } else {
      // 4th place and beyond - Purple solid
      return {
        borderGradient: '#907AFF',
        innerBackground: '#907AFF',
        textColor: '#0E0F0F',
        borderWidth: 0,
      };
    }
  };

  const styles = getBadgeStyles();
  const innerSize = size - (styles.borderWidth * 2);

  return (
    <div
      className={`relative flex justify-center items-center ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
      }}
    >
      {/* Outer circle with gradient border */}
      <div
        className="absolute rounded-full"
        style={{
          width: `${size}px`,
          height: `${size}px`,
          background: styles.borderGradient,
          zIndex: 1,
        }}
      />
      {/* Inner circle with solid color */}
      <div
        className="absolute rounded-full flex justify-center items-center"
        style={{
          width: `${innerSize}px`,
          height: `${innerSize}px`,
          background: styles.innerBackground,
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 2,
        }}
      >
        <div
          className="text-center flex flex-col text-base font-brockmann font-bold leading-6"
          style={{
            color: styles.textColor,
            zIndex: 3,
          }}
        >
          {rank}
        </div>
      </div>
    </div>
  );
};

export default RankBadge;
