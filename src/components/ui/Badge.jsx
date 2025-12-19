import React from 'react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

const VARIANTS = {
  neutral: 'untd-badge--neutral',
  soft: 'untd-badge--soft',
  ghost: 'untd-badge--ghost',
  gray: 'untd-badge--gray',
  success: 'untd-badge--success',
  warning: 'untd-badge--warning',
  gradient: 'untd-badge--gradient',
};

const SIZES = {
  sm: 'untd-badge--sm',
  md: 'untd-badge--md',
};

const Badge = ({ variant = 'neutral', size = 'md', dot, className, children, ...props }) => {
  return (
    <span
      className={twMerge(
        clsx('untd-badge', VARIANTS[variant] || VARIANTS.neutral, SIZES[size] || SIZES.md, {
          'untd-badge--dot': dot,
        }),
        className
      )}
      {...props}
    >
      {dot && <span className="untd-badge__dot" aria-hidden="true" />}
      {children}
    </span>
  );
};

export default Badge;

