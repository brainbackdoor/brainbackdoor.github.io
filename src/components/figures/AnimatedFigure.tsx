import { useId, type ReactNode, type RefObject } from 'react';
import './figures.css';

interface Props {
  containerRef: RefObject<HTMLElement | null>;
  title: string;
  caption: string;
  children: ReactNode;
  showControl: boolean;
  paused: boolean;
  running: boolean;
  toggle: () => void;
  lang: 'ko' | 'en';
  variant?: 'default' | 'preview';
}

export default function AnimatedFigure({ containerRef, title, caption, children, showControl, paused, running, toggle, lang, variant = 'default' }: Props) {
  const titleId = useId();
  return <figure className={`animated-figure${variant === 'preview' ? ' animated-figure--preview' : ''}`} ref={containerRef} aria-labelledby={titleId} data-playing={running} data-user-paused={paused}>
    <div className="animated-figure__header">
      <strong id={titleId}>{title}</strong>
      {showControl && <button type="button" onClick={toggle} aria-pressed={paused} aria-label={`${title}: ${lang === 'ko' ? (paused ? '계속 재생' : '일시정지') : (paused ? 'Resume' : 'Pause')}`}>
        {lang === 'ko' ? (paused ? '계속 재생' : '일시정지') : (paused ? 'Resume' : 'Pause')}
      </button>}
    </div>
    {children}
    <figcaption>{caption}</figcaption>
  </figure>;
}
