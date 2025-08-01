import { Heading } from "@/components/atoms/Typography/Heading";
import { Button } from "@/components/ui/button";
import { User, Calendar } from "lucide-react";

interface ThemeSelectorProps {
  selectedTheme: "people" | "year" | null;
  onThemeSelect: (theme: "people" | "year") => void;
}

export function ThemeSelector({ selectedTheme, onThemeSelect }: ThemeSelectorProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-2">
        <Heading 
          as="h2" 
          size="h3" 
          font="brockmann-bold" 
          className="text-text-primary text-center"
        >
          Choose Your Draft Theme
        </Heading>
      </div>
      
      <div className="flex gap-4 flex-wrap">
        <Button
          variant={selectedTheme === "people" ? "default" : "outline"}
          size="lg"
          onClick={() => onThemeSelect("people")}
          className={`flex-1 min-w-[294px] h-20 gap-4 ${
            selectedTheme === "people" 
              ? "bg-brand-primary text-ui-primary hover:bg-brand-primary/90" 
              : "bg-ui-primary text-text-primary border-greyscale-blue-200 hover:bg-accent"
          }`}
        >
          <User size={24} />
          <span className="text-lg font-medium font-brockmann-medium">Draft by Person</span>
        </Button>
        
        <Button
          variant={selectedTheme === "year" ? "default" : "outline"}
          size="lg"
          onClick={() => onThemeSelect("year")}
          className={`flex-1 min-w-[294px] h-20 gap-4 ${
            selectedTheme === "year" 
              ? "bg-brand-primary text-ui-primary hover:bg-brand-primary/90" 
              : "bg-ui-primary text-text-primary border-greyscale-blue-200 hover:bg-accent"
          }`}
        >
          <Calendar size={24} />
          <span className="text-lg font-medium font-brockmann-medium">Draft by Year</span>
        </Button>
      </div>
    </div>
  );
}