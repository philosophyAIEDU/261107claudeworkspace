import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

interface ToastItem {
  id: number;
  text: string;
  kind: 'info' | 'error';
}
interface ToastApi {
  show(text: string, kind?: ToastItem['kind']): void;
}
const ToastContext = createContext<ToastApi>({ show: () => undefined });

let nextId = 1;

/** 화면 아래쪽에 잠깐 떴다 사라지는 알림. 화면 읽기 프로그램도 읽어 준다(aria-live). */
export function ToastProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [items, setItems] = useState<ToastItem[]>([]);
  const show = useCallback((text: string, kind: ToastItem['kind'] = 'info') => {
    const id = nextId++;
    setItems((xs) => [...xs, { id, text, kind }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), kind === 'error' ? 7000 : 3500);
  }, []);
  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed bottom-10 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            role={t.kind === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto max-w-xl rounded-xl px-4 py-2 text-base shadow-lg ${t.kind === 'error' ? 'bg-danger text-white dark:text-black' : 'bg-fg text-bg'}`}
          >
            {t.kind === 'error' ? '⚠️ ' : ''}
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  return useContext(ToastContext);
}
