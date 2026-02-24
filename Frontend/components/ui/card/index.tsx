import React from 'react';
import { View } from 'react-native';
import { tva } from '@gluestack-ui/utils/nativewind-utils';

const cardStyle = tva({
  base: 'bg-white rounded-2xl border border-slate-200 shadow-soft-1',
});

type CardProps = React.ComponentProps<typeof View> & { className?: string };

export const Card = React.forwardRef<React.ElementRef<typeof View>, CardProps>(
  function Card({ className, ...props }, ref) {
    return (
      <View
        ref={ref}
        {...props}
        className={cardStyle({
          class: className,
        })}
      />
    );
  }
);

