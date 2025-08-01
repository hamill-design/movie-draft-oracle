import { cn } from "@/lib/utils"
import { cva, type VariantProps } from "class-variance-authority"

const headingVariants = cva(
  "font-medium leading-tight tracking-tight",
  {
    variants: {
      variant: {
        primary: "text-foreground",
        secondary: "text-muted-foreground",
        accent: "text-accent-foreground",
      },
      size: {
        h1: "text-4xl md:text-5xl lg:text-6xl",
        h2: "text-3xl md:text-4xl lg:text-5xl",
        h3: "text-2xl md:text-3xl lg:text-4xl",
        h4: "text-xl md:text-2xl lg:text-3xl",
        h5: "text-lg md:text-xl lg:text-2xl",
        h6: "text-base md:text-lg lg:text-xl",
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
    },
    defaultVariants: {
      variant: "primary",
      size: "h3",
      font: "brockmann-semibold",
    },
  }
)

export interface HeadingProps
  extends React.HTMLAttributes<HTMLHeadingElement>,
    VariantProps<typeof headingVariants> {
  as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6"
}

export function Heading({
  className,
  variant,
  size,
  font,
  as: Component = "h3",
  ...props
}: HeadingProps) {
  return (
    <Component
      className={cn(headingVariants({ variant, size, font, className }))}
      {...props}
    />
  )
}