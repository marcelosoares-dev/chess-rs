import { formatClock } from '../lib/chess';
import type { PieceType } from '../lib/chess';

const GLYPHS: Record<PieceType, string> = { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛' };

interface Props {
  name: string;
  suffix?: string;
  side: 'white' | 'black';
  captured: PieceType[];
  advantage: number;
  clockMs: number;
  active: boolean;
}

export function PlayerBar({ name, suffix, side, captured, advantage, clockMs, active }: Props) {
  const low = clockMs <= 30_000;

  return (
    <div className={`player ${active ? 'is-active' : ''}`}>
      <span className={`player__swatch player__swatch--${side}`} />
      <div className="player__identity">
        <span className="player__name">
          {name}
          {suffix && <span className="muted"> · {suffix}</span>}
        </span>
        <span className="player__captured" aria-hidden>
          {captured.map((type, index) => (
            <span key={`${type}${index}`}>{GLYPHS[type]}</span>
          ))}
          {advantage > 0 && <span className="player__advantage">+{advantage}</span>}
        </span>
      </div>
      <span className={`clock ${active ? 'is-running' : ''} ${low && active ? 'is-low' : ''}`}>
        {formatClock(clockMs)}
      </span>
    </div>
  );
}
