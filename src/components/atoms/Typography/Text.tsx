import { cn } from "@/lib/utils"
import { cva, type VariantProps } from "class-variance-authority"

const textVariants = cva(
  "leading-relaxed",
  {
    variants: {
      variant: {
        primary: "text-foreground",
        secondary: "text-muted-foreground",
        accent: "text-accent-foreground",
        destructive: "text-destructive-foreground",
      },
      size: {
        xs: "text-xs",
        sm: "text-sm",
        base: "text-base",
        lg: "text-lg",
        xl: "text-xl",
      },
      font: {
        brockmann: "font-brockmann-regular",
        "brockmann-medium": "font-brockmann-medium",
        "brockmann-semibold": "font-brockmann-semibold",
        "brockmann-bold": "font-brockmann-bold",
        chaney: "font-chaney-regular",
        "chaney-wide": "font-chaney-wide",
        "chaney-extended": "font-chaney-extended",
        "chaney-ultra": "font-chaney-ultra",
      },
      weight: {
        normal: "font-normal",
        medium: "font-medium",
        semibold: "font-semibold",
        bold: "font-bold",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "base",
      font: "brockmann",
      weight: "normal",
    },
  }
)

export interface TextProps
  extends React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof textVariants> {
  as?: "p" | "span" | "div" | "label"
}

export function Text({
  className,
  variant,
  size,
  font,
  weight,
  as: Component = "p",
  ...props
}: TextProps) {
  return (
    <Component
      className={cn(textVariants({ variant, size, font, weight, className }))}
      {...props}
    />
  )
}