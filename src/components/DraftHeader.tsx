import { Crown } from 'lucide-react';
import { getCleanActorName } from '@/lib/utils';

interface DraftHeaderProps {
  draftOption: string;
  theme?: string;
  currentPlayer?: {
    name: string;
    pick: number;
  };
  isComplete: boolean;
}

const DraftHeader = ({
  draftOption,
  theme,
  currentPlayer,
  isComplete
}: DraftHeaderProps) => {
  return <>
      {/* Header */}
      

      {/* Draft Info */}
      <div className="mb-6">
        <div className="p-6">
          <div className="flex flex-col justify-center items-center gap-4 text-center px-4">
            <span className="text-text-primary text-[20px] sm:text-[24px] md:text-[32px] font-brockmann font-medium leading-tight tracking-[1.28px]">
              NOW DRAFTING
            </span>
            <div 
              className="font-chaney font-normal text-center break-words"
              style={{
                fontSize: 'clamp(28px, 8vw, 64px)',
                lineHeight: '1.1',
                maxWidth: '100%'
              }}
            >
              <span className="text-purple-500">
                {theme === 'people' ? getCleanActorName(draftOption).toUpperCase() + ' ' : draftOption.toString() + ' '}
              </span>
              <span className="text-text-primary">
                {theme === 'people' ? 'MOVIES' : 'MOVIES'}
              </span>
            </div>
            {!isComplete && currentPlayer && (
              <div className="flex items-center justify-center gap-2 mt-4">
                <Crown className="text-yellow-400" size={20} />
                <p className="text-text-primary font-brockmann font-semibold">
                  Current Pick: {currentPlayer.name} (#{currentPlayer.pick})
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>;
};

export default DraftHeader;
