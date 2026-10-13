import { useId, type ReactNode, type RefObject } from 'react';
import './figures.css';

interface Props {
  containerRef: RefObject<HTMLElement | null>;
  title: string;
  caption: string;
  children: ReactNode;
  running: boolean;
  variant?: 'default' | 'preview';
}

export default function AnimatedFigure({ containerRef, title, caption, children, running, variant = 'default' }: Props) {
  const titleId = useId();
  return <figure className={`animated-figure${variant === 'preview' ? ' animated-figure--preview' : ''}`} ref={containerRef} aria-labelledby={titleId} data-playing={running}>
    <div className="animated-figure__header">
      <strong id={titleId}>{title}</strong>
    </div>
    {children}
    <figcaption>{caption}</figcaption>
  </figure>;
}
