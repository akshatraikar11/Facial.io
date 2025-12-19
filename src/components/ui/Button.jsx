import React, { forwardRef } from 'react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

const VARIANTS = {
  primary: 'untd-button--primary',
  soft: 'untd-button--soft',
  ghost: 'untd-button--ghost',
  outline: 'untd-button--outline',
};

const SIZES = {
  sm: 'untd-button--sm',
  md: 'untd-button--md',
  lg: 'untd-button--lg',
};

const Button = forwardRef(
  (
    {
      as: Component = 'button',
      variant = 'primary',
      size = 'md',
      className,
      children,
      ...rest
    },
    ref,
  ) => {
    const variantClass = VARIANTS[variant] || VARIANTS.primary;
    const sizeClass = SIZES[size] || SIZES.md;
    const componentProps = { ...rest };

    if (Component === 'button' && !componentProps.type) {
      componentProps.type = 'button';
    }

    return (
      <Component
        ref={ref}
        className={twMerge(clsx('untd-button', variantClass, sizeClass), className)}
        {...componentProps}
      >
        {children}
      </Component>
    );
  },
);

Button.displayName = 'Button';

export default Button;

