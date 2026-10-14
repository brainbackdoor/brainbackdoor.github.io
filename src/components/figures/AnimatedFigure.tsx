import { useId, type ReactNode, type RefObject } from 'react';
import './figures.css';

interface Props {
  containerRef: RefObject<HTMLElement | null>;
  title: string;
  caption: string;
  children: ReactNode;
  running: boolean;
  variant?: 'default' | 'preview';
  figureId?: string;
  sourceBlockId?: string;
}

export default function AnimatedFigure({ containerRef, title, caption, children, running, variant = 'default', figureId, sourceBlockId }: Props) {
  const titleId = useId();
  return <figure className={`animated-figure${variant === 'preview' ? ' animated-figure--preview' : ''}`} ref={containerRef} aria-labelledby={titleId} data-playing={running} data-figure-id={figureId} data-source-block-id={sourceBlockId}>
    {/* The article heading already names the topic; the figure keeps its own name for assistive technology. */}
    <strong id={titleId} className="sr-only">{title}</strong>
    {children}
    <figcaption>{caption}</figcaption>
  </figure>;
}
