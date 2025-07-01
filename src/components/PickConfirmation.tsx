
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
    <Card className="bg-gray-800 border-gray-600">
      <CardContent className="pt-6">
        <div className="text-center space-y-4">
          <div className="text-white">
            <p className="text-lg">
              <strong>{currentPlayerName}</strong> is drafting:
            </p>
            <p className="text-yellow-400 font-bold text-xl">
              {selectedMovie.title}
            </p>
            <p className="text-gray-300">
              for category: <span className="text-yellow-400">{selectedCategory}</span>
            </p>
          </div>
          <Button
            onClick={onConfirm}
            className="bg-green-600 hover:bg-green-700 text-white font-semibold px-8 py-3"
            size="lg"
          >
            Confirm Pick
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default PickConfirmation;
