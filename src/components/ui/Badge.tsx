import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { motion } from 'framer-motion'
import { cn } from '../../utils/cn'

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-legal-gold text-legal-dark shadow hover:bg-legal-gold/80',
        secondary: 'border-transparent bg-legal-blue text-legal-text-light hover:bg-legal-blue/80',
        destructive: 'border-transparent bg-red-500 text-white shadow hover:bg-red-500/80',
        outline: 'border-legal-gold/50 text-legal-gold hover:bg-legal-gold/10',
        success: 'border-transparent bg-green-500 text-white shadow hover:bg-green-500/80',
        warning: 'border-transparent bg-yellow-500 text-legal-dark shadow hover:bg-yellow-500/80',
        info: 'border-transparent bg-blue-500 text-white shadow hover:bg-blue-500/80',
        premium: 'border-legal-gold bg-gradient-to-r from-legal-gold/20 to-yellow-500/20 text-legal-gold shadow-lg',
      },
      size: {
        default: 'px-2.5 py-0.5 text-xs',
        sm: 'px-2 py-0.5 text-xs',
        lg: 'px-3 py-1 text-sm',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  animated?: boolean
  pulse?: boolean
  removable?: boolean
  onRemove?: () => void
}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, size, animated = false, pulse = false, removable = false, onRemove, children, ...props }, ref) => {
    return (
      <motion.div
        ref={ref}
        className={cn(badgeVariants({ variant, size }), className)}
        initial={animated ? { opacity: 0, scale: 0.8 } : false}
        animate={animated ? { opacity: 1, scale: 1 } : undefined}
        whileHover={animated ? { scale: 1.05 } : undefined}
        transition={{ type: 'spring', stiffness: 300, damping: 15 }}
        {...props}
      >
        {pulse && (
          <motion.div
            className="absolute inset-0 rounded-md bg-current opacity-20"
            animate={{
              scale: [1, 1.1, 1],
              opacity: [0.2, 0.4, 0.2],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        )}
        
        <span className="relative z-10">{children}</span>
        
        {removable && onRemove && (
          <motion.button
            type="button"
            onClick={onRemove}
            className="ml-1 -mr-1 rounded-full p-0.5 hover:bg-current/20 transition-colors"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </motion.button>
        )}
      </motion.div>
    )
  }
)

Badge.displayName = 'Badge'

export { Badge, badgeVariants }