import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export interface DropdownOption {
  value: string;
  label: string;
}

export interface DropdownGroup {
  label: string;
  options: DropdownOption[];
}

interface DropdownSelectProps {
  /** Lets a <label htmlFor> point at it. */
  id?: string;
  value: string;
  onChange: (value: string) => void;
  /** A flat list, or `groups` for a list with headings. */
  options?: DropdownOption[];
  groups?: DropdownGroup[];
  /** Shown while `value` is an empty string (nothing chosen yet). */
  placeholder?: string;
  /** For a dropdown with no visible label. */
  ariaLabel?: string;
  className?: string;
}

/**
 * The app's dropdown (the shared Select, in the dark style used on the Profile page) for a simple list of choices,
 * so forms don't fall back on the browser's own select menu. Values are strings; convert at the call site.
 */
export function DropdownSelect({ id, value, onChange, options, groups, placeholder, ariaLabel, className }: DropdownSelectProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        id={id}
        aria-label={ariaLabel}
        className={cn(
          'h-10 w-full rounded-[2px] border border-[#49474B] bg-[#1D1D1F] px-3 py-0 font-brockmann text-sm text-[#FCFFFF] focus:ring-2 focus:ring-[#907AFF] focus:ring-offset-0',
          className
        )}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="border-[#49474B] bg-[#1D1D1F] font-brockmann text-[#FCFFFF]">
        {options?.map((o) => (
          <SelectItem key={o.value} value={o.value} className="focus:bg-purple-800 focus:text-[#FCFFFF]">
            {o.label}
          </SelectItem>
        ))}
        {groups?.map((g) => (
          <SelectGroup key={g.label}>
            <SelectLabel className="text-xs font-normal text-[#BDC3C2]">{g.label}</SelectLabel>
            {g.options.map((o) => (
              <SelectItem key={o.value} value={o.value} className="focus:bg-purple-800 focus:text-[#FCFFFF]">
                {o.label}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
