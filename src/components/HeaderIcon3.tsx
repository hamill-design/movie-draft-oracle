import React from 'react';

interface HeaderIcon3Props {
  title: string;
  className?: string;
  icon: React.ReactNode;
}

export const HeaderIcon3 = ({ title, className = "", icon }: HeaderIcon3Props) => {
  return (
    <div className={`self-stretch h-7 flex items-center gap-2 ${className}`}>
      <div className="w-6 h-6 flex flex-col justify-center items-center">
        {icon}
      </div>
      <div className="flex-1 flex flex-col justify-center text-foreground text-xl font-medium leading-7 font-brockmann">
        {title}
      </div>
    </div>
  );
};