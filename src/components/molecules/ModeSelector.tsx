import { Heading } from "@/components/atoms/Typography/Heading";
import { Button } from "@/components/ui/button";
import { User, Users } from "lucide-react";

interface ModeSelectorProps {
  selectedMode: "single" | "multiplayer" | null;
  onModeSelect: (mode: "single" | "multiplayer") => void;
}

export function ModeSelector({ selectedMode, onModeSelect }: ModeSelectorProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-2">
        <Heading 
          as="h2" 
          size="h3" 
          font="brockmann-bold" 
          className="text-text-primary text-center"
        >
          Select A Mode
        </Heading>
      </div>
      
      <div className="flex gap-4 flex-wrap">
        <Button
          variant={selectedMode === "single" ? "default" : "outline"}
          size="lg"
          onClick={() => onModeSelect("single")}
          className={`flex-1 min-w-[294px] h-20 gap-4 ${
            selectedMode === "single" 
              ? "bg-brand-primary text-ui-primary hover:bg-brand-primary/90" 
              : "bg-ui-primary text-text-primary border-greyscale-blue-200 hover:bg-accent"
          }`}
        >
          <User size={24} />
          <span className="text-lg font-medium font-brockmann-medium">Local Draft</span>
        </Button>
        
        <Button
          variant={selectedMode === "multiplayer" ? "default" : "outline"}
          size="lg"
          onClick={() => onModeSelect("multiplayer")}
          className={`flex-1 min-w-[294px] h-20 gap-4 ${
            selectedMode === "multiplayer" 
              ? "bg-brand-primary text-ui-primary hover:bg-brand-primary/90" 
              : "bg-ui-primary text-text-primary border-greyscale-blue-200 hover:bg-accent"
          }`}
        >
          <Users size={24} />
          <span className="text-lg font-medium font-brockmann-medium">Online Multiplayer</span>
        </Button>
      </div>
    </div>
  );
}