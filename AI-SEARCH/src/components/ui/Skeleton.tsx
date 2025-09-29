import * as React from 'react'
import { motion } from 'framer-motion'
import { cn } from '../../utils/cn'

interface SkeletonProps {
  className?: string
  variant?: 'default' | 'text' | 'circular' | 'rectangular'
  animation?: 'pulse' | 'wave' | 'none'
  lines?: number
}

const Skeleton: React.FC<SkeletonProps> = ({
  className,
  variant = 'default',
  animation = 'pulse',
  lines = 1,
}) => {
  const baseClasses = 'bg-gradient-to-r from-legal-navy/40 via-legal-blue/20 to-legal-navy/40'
  
  const variantClasses = {
    default: 'rounded-md',
    text: 'rounded h-4',
    circular: 'rounded-full',
    rectangular: 'rounded-none',
  }

  const animationVariants = {
    pulse: {
      opacity: [0.6, 1, 0.6],
      transition: {
        duration: 2,
        repeat: Infinity,
        ease: 'easeInOut',
      },
    },
    wave: {
      backgroundPosition: ['-200px 0', '200px 0'],
      transition: {
        duration: 2,
        repeat: Infinity,
        ease: 'linear',
      },
    },
    none: {},
  }

  if (variant === 'text' && lines > 1) {
    return (
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, index) => (
          <motion.div
            key={index}
            className={cn(
              baseClasses,
              variantClasses.text,
              index === lines - 1 && 'w-4/5', // Last line is shorter
              className
            )}
            animate={animation !== 'none' ? animationVariants[animation] : undefined}
            style={
              animation === 'wave'
                ? {
                    backgroundImage:
                      'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)',
                    backgroundSize: '200px 100%',
                    backgroundRepeat: 'no-repeat',
                  }
                : undefined
            }
          />
        ))}
      </div>
    )
  }

  return (
    <motion.div
      className={cn(baseClasses, variantClasses[variant], className)}
      animate={animation !== 'none' ? animationVariants[animation] : undefined}
      style={
        animation === 'wave'
          ? {
              backgroundImage:
                'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)',
              backgroundSize: '200px 100%',
              backgroundRepeat: 'no-repeat',
            }
          : undefined
      }
    />
  )
}

// Predefined skeleton components for common use cases
const SkeletonCard: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('space-y-4 p-4 border border-legal-gold/20 rounded-lg', className)}>
    <Skeleton className="h-6 w-3/4" />
    <Skeleton variant="text" lines={3} />
    <div className="flex space-x-2">
      <Skeleton className="h-8 w-16" />
      <Skeleton className="h-8 w-20" />
    </div>
  </div>
)

const SkeletonList: React.FC<{ items?: number; className?: string }> = ({ 
  items = 3, 
  className 
}) => (
  <div className={cn('space-y-4', className)}>
    {Array.from({ length: items }).map((_, index) => (
      <div key={index} className="flex items-center space-x-4">
        <Skeleton variant="circular" className="h-10 w-10" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
    ))}
  </div>
)

const SkeletonText: React.FC<{ lines?: number; className?: string }> = ({ 
  lines = 3, 
  className 
}) => (
  <Skeleton variant="text" lines={lines} className={className} />
)

export { Skeleton, SkeletonCard, SkeletonList, SkeletonText }