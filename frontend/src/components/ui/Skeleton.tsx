import React from 'react';
import clsx from 'clsx';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  variant?: 'text' | 'circular' | 'rectangular';
  className?: string;
  animation?: 'pulse' | 'wave' | 'none';
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width,
  height,
  variant = 'rectangular',
  className,
  animation = 'pulse',
}) => {
  const style: React.CSSProperties = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
  };

  return (
    <div
      className={clsx(
        'skeleton',
        `skeleton-${variant}`,
        `skeleton-${animation}`,
        className
      )}
      style={style}
      aria-hidden="true"
    />
  );
};

// Skeleton variants for common use cases
interface SkeletonTextProps {
  lines?: number;
  className?: string;
}

export const SkeletonText: React.FC<SkeletonTextProps> = ({
  lines = 1,
  className,
}) => {
  return (
    <div className={clsx('skeleton-text-group', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          variant="text"
          width={i === lines - 1 && lines > 1 ? '75%' : '100%'}
          height={16}
        />
      ))}
    </div>
  );
};

interface SkeletonCardProps {
  showImage?: boolean;
  lines?: number;
  className?: string;
}

export const SkeletonCard: React.FC<SkeletonCardProps> = ({
  showImage = true,
  lines = 3,
  className,
}) => {
  return (
    <div className={clsx('skeleton-card', className)}>
      {showImage && (
        <Skeleton variant="rectangular" height={160} className="skeleton-card-image" />
      )}
      <div className="skeleton-card-content">
        <Skeleton variant="text" height={24} width="60%" />
        <SkeletonText lines={lines} />
      </div>
    </div>
  );
};

// Stats card skeleton
export const SkeletonStatsCard: React.FC<{ className?: string }> = ({
  className,
}) => {
  return (
    <div className={clsx('skeleton-stats-card', className)}>
      <Skeleton variant="circular" width={56} height={56} />
      <div className="skeleton-stats-content">
        <Skeleton variant="text" height={14} width={100} />
        <Skeleton variant="text" height={32} width={60} />
      </div>
    </div>
  );
};

export default Skeleton;
