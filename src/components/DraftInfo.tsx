import { Card, CardContent } from '@/components/ui/card';

interface DraftInfoProps {
  theme: string;
  option: string;
  draftSize: number;
}

const DraftInfo = ({ theme, option, draftSize }: DraftInfoProps) => {
  return (
    <Card className="bg-card border-border mb-8">
      <CardContent className="pt-6">
        <div className="text-center font-brockmann">
          <p className="text-card-foreground">
            Theme: <span className="text-yellow-500 font-semibold capitalize">{theme}</span>
          </p>
          <p className="text-card-foreground">
            Selection: <span className="text-yellow-500 font-semibold">{option}</span>
          </p>
          <p className="text-card-foreground">
            Draft Size: <span className="text-yellow-500 font-semibold">{draftSize} people</span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default DraftInfo;
