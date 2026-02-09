import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { DraftCard } from "@/components/molecules/DraftCard";
import { ThemeSelector } from "@/components/molecules/ThemeSelector";
import { ModeSelector } from "@/components/molecules/ModeSelector";
import { Heading } from "@/components/atoms/Typography/Heading";
import { Text } from "@/components/atoms/Typography/Text";
import { Film, User, Users, CheckSquare, Plus, X, Mail } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function NewHomePage() {
  const [selectedTheme, setSelectedTheme] = useState<"people" | "year" | null>("people");
  const [selectedMode, setSelectedMode] = useState<"single" | "multiplayer" | null>("multiplayer");
  const [selectedPerson, setSelectedPerson] = useState("Clint Eastwood");
  const [participants, setParticipants] = useState(["Walton", "Thompson", "Harrison"]);
  const [newParticipant, setNewParticipant] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [displayName, setDisplayName] = useState("");

  const handleAddParticipant = () => {
    if (newParticipant.trim()) {
      setParticipants([...participants, newParticipant.trim()]);
      setNewParticipant("");
    }
  };

  const handleRemoveParticipant = (index: number) => {
    setParticipants(participants.filter((_, i) => i !== index));
  };

  return (
    <div className="w-full h-full bg-gradient-to-br from-greyscale-blue-100 via-purple-200/20 to-greyscale-blue-100 flex flex-col">
      {/* Header */}
      <div className="w-full p-5 bg-greyscale-blue-900 flex justify-between items-center">
        <div className="flex-1 h-10 bg-brand-primary rounded-sm" />
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="text-purple-200 hover:text-ui-primary">
            <span className="font-brockmann-medium">Learn More</span>
          </Button>
          <Button size="sm" className="bg-brand-primary hover:bg-brand-primary/90 text-ui-primary">
            <span className="font-brockmann-medium">My Profile</span>
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 px-6 py-8 flex justify-center">
        <div className="w-full max-w-4xl flex flex-col gap-8">
          
          {/* Join Draft Section */}
          <DraftCard>
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Film size={24} className="text-brand-primary" />
                  <Heading as="h3" size="h5" font="brockmann-medium" className="text-text-primary">
                    Join A Draft
                  </Heading>
                </div>
                <Text size="sm" className="text-greyscale-blue-500 font-brockmann-regular">
                  Have an invite code? Join a multiplayer draft session
                </Text>
              </div>
              
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-5">
                  <Input
                    placeholder="Enter 8-digit Invite Code"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    className="text-center font-mono text-lg tracking-wider"
                  />
                  <div className="flex flex-col gap-3">
                    <Text size="sm" weight="medium" className="text-text-primary font-brockmann-medium">
                      Your Display Name
                    </Text>
                    <Input
                      placeholder="Enter Display Name"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                    />
                  </div>
                </div>
                <Button className="bg-brand-primary hover:bg-brand-primary/90 text-ui-primary font-brockmann-semibold">
                  Join Draft
                </Button>
              </div>
            </div>
          </DraftCard>

          {/* Theme Selection */}
          <DraftCard>
            <ThemeSelector 
              selectedTheme={selectedTheme} 
              onThemeSelect={setSelectedTheme} 
            />
          </DraftCard>

          {/* Person Search (when people theme selected) */}
          {selectedTheme === "people" && (
            <DraftCard className="opacity-80">
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-2">
                    <User size={24} className="text-brand-primary" />
                    <Heading as="h3" size="h5" font="brockmann-medium" className="text-text-primary">
                      Search for a Person
                    </Heading>
                  </div>
                  <Input
                    placeholder="Search for an actor or director you'd like to draft"
                    className="font-brockmann-medium"
                  />
                </div>
                
                <div className="flex flex-col items-center gap-1.5">
                  <Text size="sm" weight="medium" className="text-greyscale-blue-700 font-brockmann-medium">
                    You've Selected
                  </Text>
                  <Text size="lg" weight="semibold" className="text-brand-primary font-brockmann-semibold">
                    {selectedPerson}
                  </Text>
                </div>
              </div>
            </DraftCard>
          )}

          {/* Mode Selection */}
          <DraftCard>
            <ModeSelector 
              selectedMode={selectedMode} 
              onModeSelect={setSelectedMode} 
            />
          </DraftCard>

          {/* Participants (when multiplayer selected) */}
          {selectedMode === "multiplayer" && (
            <DraftCard>
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-2">
                    <Users size={24} className="text-brand-primary" />
                    <Heading as="h3" size="h5" font="brockmann-medium" className="text-text-primary">
                      Add Participants
                    </Heading>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter email address..."
                      value={newParticipant}
                      onChange={(e) => setNewParticipant(e.target.value)}
                      className="flex-1 font-brockmann-medium"
                    />
                    <Button 
                      size="sm" 
                      onClick={handleAddParticipant}
                      className="bg-brand-primary hover:bg-brand-primary/90 text-ui-primary"
                    >
                      Add
                    </Button>
                  </div>
                </div>

                {/* Multiplayer Notice */}
                <div className="p-4 bg-teal-100 border border-teal-700 rounded flex items-center gap-2">
                  <Mail size={24} className="text-teal-700" />
                  <div className="flex-1">
                    <Text size="sm" className="text-teal-700">
                      <span className="font-bold font-brockmann-bold">Multiplayer Mode:</span>
                      <span className="font-medium font-brockmann-medium"> Enter email addresses of friends you want to invite. They'll receive an email invitation to join.</span>
                    </Text>
                  </div>
                </div>

                {/* Participants List */}
                <div className="flex flex-col gap-3">
                  <Text size="base" className="text-greyscale-blue-600 font-brockmann-regular">
                    Participants ({participants.length}):
                  </Text>
                  <div className="flex flex-wrap gap-2">
                    {participants.map((participant, index) => (
                      <Badge 
                        key={index} 
                        variant="secondary" 
                        className="bg-purple-150 text-text-primary px-3.5 py-2 gap-2 font-brockmann-medium"
                      >
                        <span>{participant}</span>
                        <button 
                          onClick={() => handleRemoveParticipant(index)}
                          className="p-1 rounded hover:bg-black/10"
                        >
                          <X size={16} />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </DraftCard>
          )}

          {/* Categories */}
          <DraftCard>
            <div className="flex flex-col gap-6">
              <div className="flex items-center gap-2">
                <CheckSquare size={24} className="text-brand-primary" />
                <Heading as="h3" size="h5" font="brockmann-medium" className="text-text-primary">
                  Choose Categories
                </Heading>
              </div>
              
              <div className="h-32 flex flex-col justify-start">
                {["Action/Adventure", "Comedy", "Drama", "Horror", "Sci-Fi", "Romance", "Thriller", "Documentary"].map((category, index) => (
                  <div key={index} className="flex items-center gap-2 py-1">
                    <div className="w-4 h-4 border border-purple-300 rounded" />
                    <Text size="sm" weight="medium" className="text-text-primary font-brockmann-medium">
                      {category}
                    </Text>
                  </div>
                ))}
              </div>
            </div>
          </DraftCard>

          {/* Create Draft Button */}
          <div className="flex justify-center">
            <Button 
              size="lg"
              className="bg-yellow-500 hover:bg-yellow-500/90 text-greyscale-blue-800 font-brockmann-semibold px-6"
            >
              Create Multiplayer Draft
            </Button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="w-full p-6 bg-greyscale-blue-900 border-t border-brand-primary flex justify-between items-center flex-wrap">
        <div className="flex-1 min-w-80 flex justify-center">
          <Text size="sm" className="text-greyscale-blue-200 font-brockmann-regular text-center">
            © 2024 Movie Draft Oracle. All rights reserved.
          </Text>
        </div>
        <div className="flex-1 min-w-80 flex justify-center">
          <div className="flex items-center gap-4">
            <Text size="sm" weight="medium" className="text-greyscale-blue-200 font-brockmann-medium">
              Privacy Policy
            </Text>
            <div className="w-px h-4 bg-greyscale-blue-200" />
            <Text size="sm" weight="medium" className="text-greyscale-blue-200 font-brockmann-medium">
              Terms of Service
            </Text>
            <div className="w-px h-4 bg-greyscale-blue-200" />
            <Text size="sm" weight="medium" className="text-greyscale-blue-200 font-brockmann-medium">
              Support
            </Text>
          </div>
        </div>
      </div>
    </div>
  );
}