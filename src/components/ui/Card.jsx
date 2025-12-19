import React from 'react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

const VARIANTS = {
  surface: 'untd-card--surface',
  glass: 'untd-card--glass',
  gradient: 'untd-card--gradient',
};

const Card = ({
  // eslint-disable-next-line no-unused-vars
  as: Tag = 'div',
  variant = 'surface',
  className,
  children,
  ...rest
}) => {
  const variantClass = VARIANTS[variant] || VARIANTS.surface;

  return (
    <Tag
      className={twMerge(clsx('untd-card', variantClass), className)}
      {...rest}
    >
      {children}
    </Tag>
  );
};

export default Card;

