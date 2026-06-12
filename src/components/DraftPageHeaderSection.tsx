interface DraftPageHeaderSectionProps {
  label: string;
  children: React.ReactNode;
}

export function DraftPageHeaderSection({ label, children }: DraftPageHeaderSectionProps) {
  return (
    <div className="mb-6">
      <div className="p-6 rounded-[8px]">
        <div className="flex flex-col justify-center items-center gap-4 text-center">
          <p className="text-purple-300 text-[32px] font-brockmann font-bold leading-9 tracking-[1.28px] m-0">
            {label}
          </p>
          {children}
        </div>
      </div>
    </div>
  );
}
