import React from 'react';
import clsx from 'clsx';
import { LucideIcon } from 'lucide-react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'link';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: LucideIcon;
  rightIcon?: LucideIcon;
  fullWidth?: boolean;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'secondary',
  size = 'md',
  loading = false,
  leftIcon: LeftIcon,
  rightIcon: RightIcon,
  fullWidth = false,
  disabled,
  className,
  children,
  ...props
}) => {
  const isDisabled = disabled || loading;

  const iconSize = size === 'sm' ? 14 : size === 'lg' ? 20 : 16;

  return (
    <button
      className={clsx(
        'button',
        variant,
        size,
        {
          'full-width': fullWidth,
          loading: loading,
        },
        className
      )}
      disabled={isDisabled}
      {...props}
    >
      {loading ? (
        <Loader2 size={iconSize} className="button-spinner" />
      ) : LeftIcon ? (
        <LeftIcon size={iconSize} />
      ) : null}
      <span className="button-text">{children}</span>
      {!loading && RightIcon && <RightIcon size={iconSize} />}
    </button>
  );
};

export default Button;
