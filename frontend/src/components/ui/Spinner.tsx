import React from 'react';
import clsx from 'clsx';
import { Loader2 } from 'lucide-react';

export type SpinnerSize = 'sm' | 'md' | 'lg' | 'xl';

interface SpinnerProps {
  size?: SpinnerSize;
  className?: string;
  label?: string;
}

const sizeMap: Record<SpinnerSize, number> = {
  sm: 16,
  md: 24,
  lg: 32,
  xl: 48,
};

export const Spinner: React.FC<SpinnerProps> = ({
  size = 'md',
  className,
  label,
}) => {
  const pixelSize = sizeMap[size];

  return (
    <div
      className={clsx('spinner-container', `spinner-${size}`, className)}
      role="status"
      aria-label={label || 'Loading'}
    >
      <Loader2 size={pixelSize} className="spinner-icon" />
      {label && <span className="spinner-label">{label}</span>}
    </div>
  );
};

export default Spinner;
