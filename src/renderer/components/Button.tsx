import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-accent-fg hover:brightness-110 border border-transparent font-semibold',
  secondary: 'bg-panel text-fg border border-line hover:bg-panel-2',
  ghost: 'bg-transparent text-fg border border-transparent hover:bg-panel-2',
  danger: 'bg-danger text-white border border-transparent hover:brightness-110 font-semibold dark:text-black',
};
const sizes: Record<Size, string> = {
  sm: 'text-sm px-2 py-1 rounded-md',
  md: 'text-base px-3 py-1.5 rounded-lg',
  lg: 'text-lg px-5 py-2.5 rounded-xl',
};

export function Button({ variant = 'secondary', size = 'md', className = '', type = 'button', children, ...rest }: ButtonProps): React.JSX.Element {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
