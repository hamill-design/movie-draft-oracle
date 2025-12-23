import * as React from "react"

export type OscarStatus = "winner" | "nominee" | "none" | "unknown" | null | undefined

export interface OscarStatusChipProps extends React.HTMLAttributes<HTMLDivElement> {
  status: OscarStatus
  fullWidth?: boolean
}

const statusConfig: Record<
  "winner" | "nominee" | "none" | "unknown",
  { label: string; background: string }
> = {
  winner: {
    label: "Winner",
    background: "var(--Yellow-500, #FFD60A)",
  },
  nominee: {
    label: "Nominee",
    background: "var(--Yellow-200, #FFF2B2)",
  },
  none: {
    label: "None",
    background: "var(--Greyscale-(Blue)-200, #D9E0DF)",
  },
  unknown: {
    label: "Unknown",
    background: "var(--Greyscale-(Blue)-200, #D9E0DF)",
  },
}

export function OscarStatusChip({ 
  status, 
  style,
  fullWidth = false,
  ...props 
}: OscarStatusChipProps) {
  const normalizedStatus: "winner" | "nominee" | "none" | "unknown" = 
    (status === null || status === undefined) ? "none" : status
  
  const config = statusConfig[normalizedStatus]

  return (
    <div
      style={{
        ...(fullWidth && { width: '100%', height: '100%' }),
        paddingLeft: '12px',
        paddingRight: '12px',
        paddingTop: '4px',
        paddingBottom: '4px',
        borderRadius: '9999px',
        justifyContent: 'flex-start',
        alignItems: 'center',
        display: 'inline-flex',
        ...style,
        // Ensure background is always set based on status, even if style prop tries to override
        background: config.background,
      }}
      {...props}
    >
      <div
        style={{
          justifyContent: 'center',
          display: 'flex',
          flexDirection: 'column',
          color: normalizedStatus === 'none' ? 'rgba(43, 47, 49, 1)' : 'var(--UI-Primary, #1D1D1F)',
          fontSize: '12px',
          fontFamily: 'Brockmann',
          fontWeight: 600,
          lineHeight: '16px',
          wordWrap: 'break-word',
        }}
      >
        {config.label}
      </div>
    </div>
  )
}

