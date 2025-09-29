import * as React from 'react'
import { motion, type HTMLMotionProps } from 'framer-motion'
import { Search, X } from 'lucide-react'
import { cn } from '../../utils/cn'

export interface InputProps extends Omit<HTMLMotionProps<'input'>, 'size'> {
  label?: string
  error?: string
  helperText?: string
  icon?: React.ReactNode
  iconPosition?: 'left' | 'right'
  clearable?: boolean
  onClear?: () => void
  size?: 'sm' | 'default' | 'lg'
  variant?: 'default' | 'ghost' | 'filled'
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type = 'text',
      label,
      error,
      helperText,
      icon,
      iconPosition = 'left',
      clearable,
      onClear,
      size = 'default',
      variant = 'default',
      value,
      ...props
    },
    ref
  ) => {
    const [isFocused, setIsFocused] = React.useState(false)
    const hasValue = value !== undefined && value !== ''

    const inputSizeClasses = {
      sm: 'h-8 px-3 text-sm',
      default: 'h-10 px-4',
      lg: 'h-12 px-5 text-lg',
    }

    const containerClasses = cn(
      'relative flex items-center',
      variant === 'default' &&
        'border border-legal-gold/30 bg-gradient-to-r from-legal-navy/20 to-legal-blue/10 backdrop-blur-md',
      variant === 'ghost' && 'border-0 bg-transparent',
      variant === 'filled' && 'border-0 bg-legal-charcoal/50 backdrop-blur-md',
      'rounded-lg transition-all duration-300',
      isFocused && 'border-legal-gold shadow-lg shadow-legal-gold/20',
      error && 'border-red-500 shadow-lg shadow-red-500/20',
      className
    )

    const inputClasses = cn(
      'flex-1 bg-transparent text-legal-text-light placeholder:text-legal-text-muted',
      'focus:outline-none disabled:cursor-not-allowed disabled:opacity-50',
      inputSizeClasses[size],
      icon && iconPosition === 'left' && 'pl-10',
      icon && iconPosition === 'right' && 'pr-10',
      clearable && hasValue && 'pr-10'
    )

    return (
      <div className="space-y-2">
        {label && (
          <motion.label
            className="text-sm font-medium text-legal-gold"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {label}
          </motion.label>
        )}

        <motion.div
          className={containerClasses}
          animate={{
            scale: isFocused ? 1.02 : 1,
          }}
          transition={{ type: 'spring', stiffness: 300, damping: 15 }}
        >
          {icon && iconPosition === 'left' && (
            <div className="absolute left-3 flex items-center text-legal-text-muted">
              {icon}
            </div>
          )}

          <motion.input
            ref={ref}
            type={type}
            className={inputClasses}
            value={value}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            initial={false}
            {...props}
          />

          {clearable && hasValue && onClear && (
            <motion.button
              type="button"
              onClick={onClear}
              className="absolute right-3 flex items-center text-legal-text-muted hover:text-legal-text-light transition-colors"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <X size={16} />
            </motion.button>
          )}

          {icon && iconPosition === 'right' && !clearable && (
            <div className="absolute right-3 flex items-center text-legal-text-muted">
              {icon}
            </div>
          )}
        </motion.div>

        {(error || helperText) && (
          <motion.div
            className={cn(
              'text-xs',
              error ? 'text-red-400' : 'text-legal-text-muted'
            )}
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {error || helperText}
          </motion.div>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'

export { Input }