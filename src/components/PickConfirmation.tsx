
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface PickConfirmationProps {
  currentPlayerName: string;
  selectedMovie: any;
  selectedCategory: string;
  onConfirm: () => void;
}

const PickConfirmation = ({
  currentPlayerName,
  selectedMovie,
  selectedCategory,
  onConfirm
}: PickConfirmationProps) => {
  if (!selectedMovie || !selectedCategory) return null;

  return (
    <div className="w-full p-6 bg-[#FCFFFF] shadow-[0px_0px_3px_rgba(0,0,0,0.25)] rounded flex flex-col gap-6">
      <div className="flex flex-col gap-4 items-center">
        <div className="flex flex-col gap-1 w-full">
          <div className="flex flex-col items-center w-full">
            <div className="w-full text-center">
              <span className="text-[#2B2D2D] text-base font-brockmann font-semibold leading-6 tracking-[0.32px]">{currentPlayerName} </span>
              <span className="text-[#2B2D2D] text-base font-brockmann font-normal leading-6 tracking-[0.32px]">is drafting:</span>
            </div>
          </div>
          <div className="flex flex-col items-center w-full">
            <div className="w-full text-center text-[#680AFF] text-xl font-brockmann font-bold leading-7">
              {selectedMovie.title}
            </div>
          </div>
          <div className="flex flex-col items-center w-full">
            <div className="w-full text-center">
              <span className="text-[#646968] text-base font-brockmann font-normal leading-6">for category: </span>
              <span className="text-[#680AFF] text-base font-brockmann font-normal leading-6">{selectedCategory}</span>
            </div>
          </div>
        </div>
        <button
          onClick={onConfirm}
          className="px-6 py-3 bg-[#FFD60A] rounded-sm text-[#2B2D2D] text-base font-brockmann font-semibold leading-6 tracking-[0.32px] text-center"
        >
          Confirm Pick
        </button>
      </div>
    </div>
  );
};

export default PickConfirmation;
