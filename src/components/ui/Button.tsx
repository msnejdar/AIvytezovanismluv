import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { motion, type HTMLMotionProps } from 'framer-motion'
import { cn } from '../../utils/cn'

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-gradient-to-r from-legal-gold to-yellow-600 text-legal-dark shadow hover:from-legal-gold/90 hover:to-yellow-600/90',
        destructive: 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-sm hover:from-red-500/90 hover:to-red-600/90',
        outline: 'border border-legal-gold/30 bg-transparent text-legal-text-light shadow-sm hover:bg-legal-gold/10',
        secondary: 'bg-gradient-to-r from-legal-blue to-legal-navy text-legal-text-light shadow-sm hover:from-legal-blue/90 hover:to-legal-navy/90',
        ghost: 'text-legal-text-light hover:bg-legal-gold/10',
        link: 'text-legal-blue-accent underline-offset-4 hover:underline',
        premium: 'bg-gradient-to-r from-legal-gold via-yellow-500 to-legal-gold text-legal-dark shadow-lg border border-legal-gold/50 hover:shadow-xl hover:border-legal-gold',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-10 rounded-md px-8',
        xl: 'h-12 rounded-lg px-10 text-base',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface ButtonProps
  extends Omit<HTMLMotionProps<'button'>, 'size'>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean
  icon?: React.ReactNode
  iconPosition?: 'left' | 'right'
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, icon, iconPosition = 'left', children, disabled, ...props }, ref) => {
    const isDisabled = disabled || loading

    return (
      <motion.button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={isDisabled}
        whileHover={!isDisabled ? { scale: 1.02 } : undefined}
        whileTap={!isDisabled ? { scale: 0.98 } : undefined}
        transition={{ type: 'spring', stiffness: 300, damping: 15 }}
        {...props}
      >
        {loading && (
          <motion.div
            className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
          />
        )}
        
        {icon && iconPosition === 'left' && !loading && (
          <span className={cn('mr-2', size === 'sm' && 'mr-1')}>{icon}</span>
        )}
        
        {children}
        
        {icon && iconPosition === 'right' && !loading && (
          <span className={cn('ml-2', size === 'sm' && 'ml-1')}>{icon}</span>
        )}
      </motion.button>
    )
  }
)

Button.displayName = 'Button'

export { Button, buttonVariants }