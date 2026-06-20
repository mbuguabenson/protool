import * as React from 'react';
import classNames from 'classnames';

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

interface BadgeProps extends React.ComponentProps<'span'> {
    variant?: BadgeVariant;
    asChild?: boolean;
}

function Badge({ className, variant = 'default', ...props }: BadgeProps) {
    const baseStyles = 'inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 gap-1 overflow-hidden';
    
    const variantStyles = {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        destructive: 'border-transparent bg-destructive text-white',
        outline: 'text-foreground',
    };

    return (
        <span
            data-slot='badge'
            className={classNames(baseStyles, variantStyles[variant], className)}
            {...props}
        />
    );
}

export { Badge };
