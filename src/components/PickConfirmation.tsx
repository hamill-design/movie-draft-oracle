
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
    <Card className="bg-card border-border">
      <CardContent className="pt-6">
        <div className="text-center space-y-4">
          <div className="text-card-foreground font-brockmann">
            <p className="text-lg">
              <strong>{currentPlayerName}</strong> is drafting:
            </p>
            <p className="text-yellow-500 font-bold text-xl">
              {selectedMovie.title}
            </p>
            <p className="text-muted-foreground">
              for category: <span className="text-yellow-500">{selectedCategory}</span>
            </p>
          </div>
          <Button
            onClick={onConfirm}
            className="bg-yellow-500 hover:bg-yellow-600 text-greyscale-blue-800 font-brockmann font-semibold px-8 py-3"
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
