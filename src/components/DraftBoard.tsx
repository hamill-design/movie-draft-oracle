
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { User } from 'lucide-react';

interface Pick {
  playerId: number;
  playerName: string;
  movie: any;
  category: string;
}

interface Player {
  id: number;
  name: string;
}

interface DraftBoardProps {
  players: Player[];
  categories: string[];
  picks: Pick[];
  theme: string;
}

const DraftBoard = ({ players, categories, picks, theme }: DraftBoardProps) => {
  return (
    <Card className="bg-gray-800 border-gray-600 mb-6">
      <CardHeader>
        <CardTitle className="text-white">Draft Board</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-gray-300">Player</TableHead>
                {categories.map((category) => (
                  <TableHead key={category} className="text-gray-300 text-center min-w-[150px]">
                    {category}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {players.map((player) => (
                <TableRow key={player.id}>
                  <TableCell className="text-white font-medium">
                    <div className="flex items-center gap-2">
                      <User size={16} />
                      {player.name}
                    </div>
                  </TableCell>
                  {categories.map((category) => {
                    const pick = picks.find(p => p.playerId === player.id && p.category === category);
                    return (
                      <TableCell key={category} className="text-center">
                        {pick ? (
                          <div className="text-xs">
                            <div className="text-white font-medium truncate">{pick.movie.title}</div>
                            <div className="text-gray-400">
                              {theme === 'year' ? pick.movie.year : pick.movie.genre}
                            </div>
                          </div>
                        ) : (
                          <div className="text-gray-600">-</div>
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default DraftBoard;
