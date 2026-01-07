
import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingStateProps {
  loading: boolean;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  loading,
  children,
  fallback,
  className,
  size = 'md'
}) => {
  if (loading) {
    if (fallback) {
      return <>{fallback}</>;
    }

    const sizeClasses = {
      sm: 'h-4 w-4',
      md: 'h-6 w-6',
      lg: 'h-8 w-8'
    };

    return (
      <div className={cn('flex items-center justify-center py-4', className)}>
        <Loader2 className={cn('animate-spin', sizeClasses[size])} />
      </div>
    );
  }

  return <>{children}</>;
};

interface LoadingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading: boolean;
  children: React.ReactNode;
  loadingText?: string;
}

export const LoadingButton: React.FC<LoadingButtonProps> = ({
  loading,
  children,
  loadingText,
  disabled,
  className,
  ...props
}) => {
  return (
    <button
      {...props}
      disabled={loading || disabled}
      className={cn(
        'flex items-center justify-center gap-2',
        className
      )}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {loading && loadingText ? loadingText : children}
    </button>
  );
};

export const LoadingSpinner: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({ size = 'md' }) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8'
  };

  return <Loader2 className={cn('animate-spin', sizeClasses[size])} />;
};
