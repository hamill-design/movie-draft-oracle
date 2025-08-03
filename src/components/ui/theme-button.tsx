import * as React from "react"
import { cn } from "@/lib/utils"

interface ThemeButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
  selected?: boolean
}

const ThemeButton = React.forwardRef<HTMLButtonElement, ThemeButtonProps>(
  ({ className, children, selected = false, ...props }, ref) => {
    return (
      <button
        className={cn(
          // Base styles
          "flex-1 h-20 min-w-[294px] px-9 py-[9px] flex justify-center items-center gap-4",
          "text-lg font-medium font-brockmann text-[var(--Text-Primary,#2B2D2D)]",
          "transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          // 6px border radius
          "rounded-[6px]",
          // Selected state
          selected
            ? "bg-primary text-primary-foreground"
            : "bg-card border border-border",
          // Hover state - purple background and outline
          !selected && "hover:bg-purple-100 hover:outline hover:outline-1 hover:outline-purple-200 hover:outline-offset-[-1px]",
          // Pressed state - darker purple background and outline
          !selected && "active:bg-purple-200 active:outline active:outline-1 active:outline-purple-300 active:outline-offset-[-1px]",
          className
        )}
        ref={ref}
        {...props}
      >
        {children}
      </button>
    )
  }
)
ThemeButton.displayName = "ThemeButton"

export { ThemeButton }