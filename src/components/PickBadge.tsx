import React from 'react';

interface PickBadgeProps {
  pickNumber: number;
  category: string;
}

const PickBadge: React.FC<PickBadgeProps> = ({ pickNumber, category }) => {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="bg-yellow-400 text-black rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">
        {pickNumber}
      </div>
      <span className="bg-gray-700 text-yellow-400 px-2 py-1 rounded text-xs font-medium">
        {category}
      </span>
    </div>
  );
};

export default PickBadge;