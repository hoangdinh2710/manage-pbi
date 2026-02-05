import React from 'react';
import { LucideIcon } from 'lucide-react';
import clsx from 'clsx';

export type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface IconProps {
  icon: LucideIcon;
  size?: IconSize;
  className?: string;
  color?: string;
  'aria-label'?: string;
}

const sizeMap: Record<IconSize, number> = {
  xs: 14,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
};

export const Icon: React.FC<IconProps> = ({
  icon: LucideIconComponent,
  size = 'md',
  className,
  color,
  'aria-label': ariaLabel,
}) => {
  const pixelSize = sizeMap[size];

  return (
    <LucideIconComponent
      size={pixelSize}
      className={clsx('icon', `icon-${size}`, className)}
      color={color}
      aria-label={ariaLabel}
      aria-hidden={!ariaLabel}
    />
  );
};

export default Icon;
