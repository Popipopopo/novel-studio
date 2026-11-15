import { X } from 'lucide-react';
import { ReactNode, useEffect } from 'react';

interface Props {
  title?: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}

export default function Modal({ title, open, onClose, children, footer, wide }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-40 bg-ink-800/40 backdrop-blur-[1px] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className={
          'bg-paper-50 dark:bg-ink-700 rounded-xl shadow-2xl border border-paper-200 dark:border-ink-500 w-full ' +
          (wide ? 'max-w-3xl' : 'max-w-lg')
        }
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-paper-200 dark:border-ink-500">
          <h3 className="font-serif text-lg">{title}</h3>
          <button className="ghost" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="p-5 space-y-3">{children}</div>
        {footer && (
          <div className="px-5 py-3 border-t border-paper-200 dark:border-ink-500 flex justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  disabled,
  title,
  type,
}: {
  children: ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  variant?: 'primary' | 'ghost' | 'danger';
  disabled?: boolean;
  title?: string;
  type?: 'submit' | 'button';
}) {
  const base =
    'px-3 py-1.5 rounded-md text-sm transition disabled:opacity-40 disabled:cursor-not-allowed';
  const styles =
    variant === 'primary'
      ? 'bg-accent-500 hover:bg-accent-400 text-white'
      : variant === 'danger'
      ? 'bg-red-600 hover:bg-red-500 text-white'
      : 'hover:bg-paper-100 dark:hover:bg-ink-600 text-ink-500 dark:text-ink-50';
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      title={title}
      className={`${base} ${styles}`}
    >
      {children}
    </button>
  );
}
