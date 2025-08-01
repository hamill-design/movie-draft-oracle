import { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { cva, type VariantProps } from "class-variance-authority"

const iconVariants = cva(
  "shrink-0",
  {
    variants: {
      size: {
        xs: "h-3 w-3",
        sm: "h-4 w-4",
        default: "h-5 w-5",
        lg: "h-6 w-6",
        xl: "h-8 w-8",
        "2xl": "h-10 w-10",
      },
      variant: {
        default: "text-foreground",
        muted: "text-muted-foreground",
        accent: "text-accent-foreground",
        destructive: "text-destructive-foreground",
      },
    },
    defaultVariants: {
      size: "default",
      variant: "default",
    },
  }
)

export interface IconProps
  extends React.HTMLAttributes<SVGElement>,
    VariantProps<typeof iconVariants> {
  icon: LucideIcon
}

export function Icon({ 
  className, 
  size, 
  variant, 
  icon: IconComponent, 
  ...props 
}: IconProps) {
  return (
    <IconComponent
      className={cn(iconVariants({ size, variant, className }))}
      {...props}
    />
  )
}