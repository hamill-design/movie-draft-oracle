import { Card } from "@/components/ui/card";
import { ReactNode } from "react";

interface DraftCardProps {
  children: ReactNode;
  className?: string;
}

export function DraftCard({ children, className = "" }: DraftCardProps) {
  return (
    <Card className={`p-6 bg-ui-primary shadow-sm border-0 ${className}`}>
      {children}
    </Card>
  );
}