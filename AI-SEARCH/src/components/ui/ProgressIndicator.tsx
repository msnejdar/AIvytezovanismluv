import * as React from 'react'
import { motion } from 'framer-motion'
import { CheckCircle, Circle, Clock, AlertCircle } from 'lucide-react'
import { cn } from '../../utils/cn'

interface Step {
  id: string
  label: string
  description?: string
  status: 'pending' | 'in-progress' | 'completed' | 'error'
  optional?: boolean
}

interface ProgressIndicatorProps {
  steps: Step[]
  currentStep?: string
  orientation?: 'horizontal' | 'vertical'
  showLabels?: boolean
  showDescriptions?: boolean
  className?: string
}

const stepStatusColors = {
  pending: 'text-legal-text-muted border-legal-text-muted',
  'in-progress': 'text-legal-blue-accent border-legal-blue-accent bg-legal-blue-accent/10',
  completed: 'text-legal-gold border-legal-gold bg-legal-gold/10',
  error: 'text-red-400 border-red-400 bg-red-400/10',
}

const stepStatusIcons = {
  pending: Circle,
  'in-progress': Clock,
  completed: CheckCircle,
  error: AlertCircle,
}

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  steps,
  currentStep,
  orientation = 'horizontal',
  showLabels = true,
  showDescriptions = false,
  className,
}) => {
  const currentStepIndex = currentStep ? steps.findIndex(step => step.id === currentStep) : -1

  if (orientation === 'vertical') {
    return (
      <div className={cn('space-y-4', className)}>
        {steps.map((step, index) => {
          const Icon = stepStatusIcons[step.status]
          const isActive = step.id === currentStep
          const isPast = index < currentStepIndex
          const isNext = index === currentStepIndex + 1

          return (
            <motion.div
              key={step.id}
              className="flex items-start space-x-3"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <div className="flex flex-col items-center">
                <motion.div
                  className={cn(
                    'flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all duration-300',
                    stepStatusColors[step.status],
                    isActive && 'ring-2 ring-offset-2 ring-legal-blue-accent ring-offset-legal-dark'
                  )}
                  animate={{
                    scale: isActive ? 1.1 : 1,
                  }}
                  transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                >
                  <Icon size={16} />
                </motion.div>
                
                {index < steps.length - 1 && (
                  <motion.div
                    className={cn(
                      'w-0.5 h-8 mt-2 transition-colors duration-500',
                      isPast ? 'bg-legal-gold' : 'bg-legal-text-muted/30'
                    )}
                    initial={{ scaleY: 0 }}
                    animate={{ scaleY: isPast ? 1 : 0.3 }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                  />
                )}
              </div>

              <div className="flex-1 min-w-0">
                {showLabels && (
                  <motion.h4
                    className={cn(
                      'text-sm font-medium transition-colors duration-300',
                      isActive ? 'text-legal-text-light' : 'text-legal-text-muted',
                      step.status === 'completed' && 'text-legal-gold'
                    )}
                    animate={{
                      scale: isActive ? 1.02 : 1,
                    }}
                  >
                    {step.label}
                    {step.optional && (
                      <span className="text-xs text-legal-text-muted ml-1">(volitelné)</span>
                    )}
                  </motion.h4>
                )}
                
                {showDescriptions && step.description && (
                  <motion.p
                    className="text-xs text-legal-text-muted mt-1"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ 
                      opacity: isActive || isPast ? 1 : 0.7,
                      height: 'auto'
                    }}
                  >
                    {step.description}
                  </motion.p>
                )}
              </div>
            </motion.div>
          )
        })}
      </div>
    )
  }

  // Horizontal layout
  return (
    <div className={cn('flex items-center justify-between', className)}>
      {steps.map((step, index) => {
        const Icon = stepStatusIcons[step.status]
        const isActive = step.id === currentStep
        const isPast = index < currentStepIndex
        const isLast = index === steps.length - 1

        return (
          <React.Fragment key={step.id}>
            <motion.div
              className="flex flex-col items-center space-y-2"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <motion.div
                className={cn(
                  'flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-300',
                  stepStatusColors[step.status],
                  isActive && 'ring-2 ring-offset-2 ring-legal-blue-accent ring-offset-legal-dark'
                )}
                animate={{
                  scale: isActive ? 1.1 : 1,
                }}
                transition={{ type: 'spring', stiffness: 300, damping: 15 }}
              >
                <Icon size={18} />
              </motion.div>

              {showLabels && (
                <motion.div
                  className="text-center"
                  animate={{
                    scale: isActive ? 1.05 : 1,
                  }}
                >
                  <h4
                    className={cn(
                      'text-sm font-medium transition-colors duration-300 max-w-24 text-center',
                      isActive ? 'text-legal-text-light' : 'text-legal-text-muted',
                      step.status === 'completed' && 'text-legal-gold'
                    )}
                  >
                    {step.label}
                  </h4>
                  
                  {step.optional && (
                    <span className="text-xs text-legal-text-muted">(volitelné)</span>
                  )}
                  
                  {showDescriptions && step.description && (
                    <p className="text-xs text-legal-text-muted mt-1 max-w-32">
                      {step.description}
                    </p>
                  )}
                </motion.div>
              )}
            </motion.div>

            {!isLast && (
              <motion.div
                className={cn(
                  'flex-1 h-0.5 mx-4 transition-colors duration-500',
                  isPast ? 'bg-legal-gold' : 'bg-legal-text-muted/30'
                )}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: isPast ? 1 : 0.3 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

// Linear progress bar component
interface LinearProgressProps {
  value: number
  max?: number
  showLabel?: boolean
  label?: string
  color?: 'default' | 'success' | 'warning' | 'error'
  animated?: boolean
  className?: string
}

const progressColors = {
  default: 'bg-legal-blue-accent',
  success: 'bg-green-500',
  warning: 'bg-yellow-500',
  error: 'bg-red-500',
}

export const LinearProgress: React.FC<LinearProgressProps> = ({
  value,
  max = 100,
  showLabel = false,
  label,
  color = 'default',
  animated = true,
  className,
}) => {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100))

  return (
    <div className={cn('space-y-2', className)}>
      {(showLabel || label) && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-legal-text-light">{label || 'Progress'}</span>
          <span className="text-legal-text-muted">{Math.round(percentage)}%</span>
        </div>
      )}
      
      <div className="w-full bg-legal-navy/30 rounded-full h-2 overflow-hidden">
        <motion.div
          className={cn(
            'h-full rounded-full transition-all duration-300',
            progressColors[color]
          )}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{
            duration: animated ? 1 : 0,
            ease: 'easeOut',
          }}
        />
      </div>
    </div>
  )
}

// Circular progress component
interface CircularProgressProps {
  value: number
  max?: number
  size?: number
  strokeWidth?: number
  showLabel?: boolean
  label?: string
  color?: 'default' | 'success' | 'warning' | 'error'
  className?: string
}

export const CircularProgress: React.FC<CircularProgressProps> = ({
  value,
  max = 100,
  size = 80,
  strokeWidth = 8,
  showLabel = false,
  label,
  color = 'default',
  className,
}) => {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100))
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (percentage / 100) * circumference

  const strokeColors = {
    default: '#4DA9FF',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
  }

  return (
    <div className={cn('flex flex-col items-center space-y-2', className)}>
      <div className="relative">
        <svg
          width={size}
          height={size}
          className="transform -rotate-90"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="rgba(255, 255, 255, 0.1)"
            strokeWidth={strokeWidth}
            fill="none"
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={strokeColors[color]}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        </svg>
        
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-semibold text-legal-text-light">
            {Math.round(percentage)}%
          </span>
        </div>
      </div>
      
      {(showLabel || label) && (
        <span className="text-sm text-legal-text-muted text-center">
          {label || 'Progress'}
        </span>
      )}
    </div>
  )
}