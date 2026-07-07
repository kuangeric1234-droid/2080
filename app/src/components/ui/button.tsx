/* Vendored from watermellon-registry/src/components/ui/button.tsx.
   Restyled to 20-80 scale: 11.5px/650 label, 8px radius (design-comps
   button spec); colors flow from the token aliases in index.css. */
import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg text-[11.5px] font-semibold whitespace-nowrap transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-teal-deep',
        destructive:
          'bg-crit-tint text-crit hover:bg-crit hover:text-white focus-visible:ring-destructive/20',
        outline:
          'border border-line bg-surface text-ink hover:border-teal hover:text-teal',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-accent',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        soft: 'bg-teal-tint text-teal hover:bg-teal hover:text-white',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-8 px-3 py-1.5 has-[>svg]:px-2.5',
        xs: "h-6 gap-1 rounded-md px-2 text-[10.5px] has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: 'h-7 gap-1.5 rounded-md px-2.5 has-[>svg]:px-2',
        lg: 'h-9 rounded-lg px-4 has-[>svg]:px-3',
        icon: 'size-8',
        'icon-xs': "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        'icon-sm': 'size-7',
        'icon-lg': 'size-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : 'button'

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
