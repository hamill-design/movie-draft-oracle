
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Film } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const DraftComplete = () => {
  const navigate = useNavigate();

  return (
    <Card className="bg-gray-800 border-gray-600">
      <CardContent className="pt-6">
        <div className="text-center space-y-4">
          <Film className="mx-auto text-yellow-400" size={64} />
          <h2 className="text-2xl font-bold text-white">Draft Complete!</h2>
          <p className="text-gray-300">All players have made their selections.</p>
          <Button
            onClick={() => navigate('/')}
            className="bg-yellow-400 hover:bg-yellow-500 text-black font-semibold"
          >
            Start New Draft
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default DraftComplete;
