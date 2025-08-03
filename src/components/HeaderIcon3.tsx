import { FilmReelIcon } from '@/components/icons';

interface HeaderIcon3Props {
  title: string;
  className?: string;
}

export const HeaderIcon3 = ({ title, className = "" }: HeaderIcon3Props) => {
  return (
    <div className={`self-stretch h-7 flex items-center gap-2 ${className}`}>
      <div className="w-6 h-6 flex flex-col justify-center items-center">
        <FilmReelIcon className="w-6 h-6 text-primary" />
      </div>
      <div className="flex-1 flex flex-col justify-center text-foreground text-xl font-medium leading-7 font-brockmann">
        {title}
      </div>
    </div>
  );
};