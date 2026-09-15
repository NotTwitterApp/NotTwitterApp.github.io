import cn from 'clsx';
import type { ReactNode, JSX } from 'react';

type MainContainerProps = {
  children: ReactNode;
  className?: string;
};

export function MainContainer({
  children,
  className
}: MainContainerProps): JSX.Element {
  return (
    <main
      className={cn(
        `hover-animation flex min-h-screen w-full min-w-0 max-w-[600px] flex-col border-x-0
         border-light-border pb-96 dark:border-dark-border xs:border-x`,
        className
      )}
    >
      {children}
    </main>
  );
}
