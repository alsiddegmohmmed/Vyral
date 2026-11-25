import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'scanner';

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-on-accent hover:bg-accent-hover',
  secondary: 'bg-bg text-text border border-border hover:bg-surface',
  ghost: 'bg-transparent text-text hover:bg-surface',
  danger: 'bg-danger text-on-danger hover:brightness-110',
};
const sizes: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-sm font-semibold gap-2',
  lg: 'h-12 px-5 text-base font-semibold gap-2',
  scanner: 'h-16 px-6 text-lg font-semibold gap-3 rounded-lg',
};

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  block?: boolean;
  /** internal: square icon-only sizing (use IconButton) */
  iconOnly?: boolean;
};

const iconSizes: Record<ButtonSize, string> = {
  sm: 'size-8', md: 'size-10', lg: 'size-12', scanner: 'size-16 rounded-full',
};

export const buttonClass = (variant: ButtonVariant = 'primary', size: ButtonSize = 'md', block = false, iconOnly = false) =>
  cn(
    'inline-flex items-center justify-center whitespace-nowrap rounded-md select-none',
    'transition-[background-color,transform,filter] duration-[var(--tk-motion-fast)] ease-out active:translate-y-px',
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:translate-y-0',
    '[&>svg]:shrink-0',
    variants[variant], iconOnly ? iconSizes[size] : sizes[size], block && 'w-full',
  );

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading = false, block = false, iconOnly = false, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(buttonClass(variant, size, block, iconOnly), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <Loader2 aria-hidden className="size-4 animate-spin" />}
      {children}
    </button>
  );
});

type IconButtonProps = Omit<ButtonProps, 'children' | 'block'> & { 'aria-label': string; icon: React.ReactNode };

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, size = 'md', variant = 'ghost', className, ...rest },
  ref,
) {
  return (
    <Button ref={ref} variant={variant} size={size} iconOnly className={className} {...rest}>
      {icon}
    </Button>
  );
});
