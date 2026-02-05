import React from 'react';
import clsx from 'clsx';

export type CardVariant = 'elevated' | 'outlined' | 'flat';

interface CardProps {
  variant?: CardVariant;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({
  variant = 'elevated',
  padding = 'md',
  className,
  children,
  onClick,
}) => {
  const Component = onClick ? 'button' : 'div';

  return (
    <Component
      className={clsx(
        'card',
        `card-${variant}`,
        `card-padding-${padding}`,
        { 'card-clickable': !!onClick },
        className
      )}
      onClick={onClick}
      type={onClick ? 'button' : undefined}
    >
      {children}
    </Component>
  );
};

interface CardHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}

export const CardHeader: React.FC<CardHeaderProps> = ({
  title,
  subtitle,
  action,
  className,
}) => {
  return (
    <div className={clsx('card-header', className)}>
      <div className="card-header-content">
        <h3 className="card-title">{title}</h3>
        {subtitle && <p className="card-subtitle">{subtitle}</p>}
      </div>
      {action && <div className="card-header-action">{action}</div>}
    </div>
  );
};

interface CardBodyProps {
  className?: string;
  children: React.ReactNode;
}

export const CardBody: React.FC<CardBodyProps> = ({ className, children }) => {
  return <div className={clsx('card-body', className)}>{children}</div>;
};

interface CardFooterProps {
  className?: string;
  children: React.ReactNode;
}

export const CardFooter: React.FC<CardFooterProps> = ({
  className,
  children,
}) => {
  return <div className={clsx('card-footer', className)}>{children}</div>;
};

export default Card;
