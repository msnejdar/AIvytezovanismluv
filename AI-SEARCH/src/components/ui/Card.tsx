import * as React from 'react'
import { motion, type HTMLMotionProps } from 'framer-motion'
import { cn } from '../../utils/cn'

interface CardProps extends HTMLMotionProps<'div'> {
  variant?: 'default' | 'glass' | 'elevated' | 'outline'
  hover?: boolean
  clickable?: boolean
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', hover = false, clickable = false, children, ...props }, ref) => {
    const variants = {
      default: 'bg-gradient-to-br from-legal-navy/30 to-legal-blue/20 border border-legal-gold/30',
      glass: 'bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md border border-white/20',
      elevated: 'bg-gradient-to-br from-legal-navy/40 to-legal-blue/30 border border-legal-gold/40 shadow-2xl shadow-legal-navy/50',
      outline: 'bg-transparent border-2 border-legal-gold/50',
    }

    return (
      <motion.div
        ref={ref}
        className={cn(
          'rounded-lg p-6 transition-all duration-300',
          variants[variant],
          clickable && 'cursor-pointer',
          className
        )}
        whileHover={
          hover || clickable
            ? {
                scale: 1.02,
                boxShadow: '0 20px 40px rgba(212, 175, 55, 0.15)',
              }
            : undefined
        }
        whileTap={clickable ? { scale: 0.98 } : undefined}
        transition={{ type: 'spring', stiffness: 300, damping: 15 }}
        {...props}
      >
        {children}
      </motion.div>
    )
  }
)

Card.displayName = 'Card'

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex flex-col space-y-1.5 pb-4', className)}
      {...props}
    />
  )
)
CardHeader.displayName = 'CardHeader'

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn('font-semibold text-legal-text-light tracking-tight', className)}
      {...props}
    />
  )
)
CardTitle.displayName = 'CardTitle'

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      className={cn('text-sm text-legal-text-muted', className)}
      {...props}
    />
  )
)
CardDescription.displayName = 'CardDescription'

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('pt-0', className)} {...props} />
  )
)
CardContent.displayName = 'CardContent'

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex items-center pt-4', className)}
      {...props}
    />
  )
)
CardFooter.displayName = 'CardFooter'

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }