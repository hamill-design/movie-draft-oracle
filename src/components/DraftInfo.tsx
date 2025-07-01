
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';

interface DraftInfoProps {
  theme: string;
  option: string;
  draftSize: number;
}

const DraftInfo = ({ theme, option, draftSize }: DraftInfoProps) => {
  return (
    <Card className="bg-gray-800 border-gray-600 mb-8">
      <CardContent className="pt-6">
        <div className="text-center">
          <p className="text-gray-300">
            Theme: <span className="text-yellow-400 font-bold capitalize">{theme}</span>
          </p>
          <p className="text-gray-300">
            Selection: <span className="text-yellow-400 font-bold">{option}</span>
          </p>
          <p className="text-gray-300">
            Draft Size: <span className="text-yellow-400 font-bold">{draftSize} people</span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default DraftInfo;
