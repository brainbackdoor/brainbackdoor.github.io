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
  // Search indexes the article text only: drawn labels, captions and static scenes would add words the post never had.
  return <figure className={`animated-figure${variant === 'preview' ? ' animated-figure--preview' : ''}`} data-pagefind-ignore="" ref={containerRef} aria-labelledby={titleId} data-playing={running} data-figure-id={figureId} data-source-block-id={sourceBlockId}>
    {/* The article heading already names the topic; the figure keeps its own name for assistive technology, read once as that name. */}
    <strong id={titleId} className="sr-only" aria-hidden="true">{title}</strong>
    {children}
    <figcaption>{caption}</figcaption>
  </figure>;
}
