import { useEffect, useRef } from 'react';
import type { PlayedMove } from '../lib/chess';

interface Props {
  title: string;
  empty: string;
  moves: PlayedMove[];
}

export function MoveList({ title, empty, moves }: Props) {
  const scroller = useRef<HTMLOListElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' });
  }, [moves.length]);

  const rounds = Array.from({ length: Math.ceil(moves.length / 2) }, (_, index) => ({
    number: index + 1,
    white: moves[index * 2],
    black: moves[index * 2 + 1],
  }));

  return (
    <section className="panel moves">
      <h2 className="panel__title">{title}</h2>
      {rounds.length === 0 ? (
        <p className="muted">{empty}</p>
      ) : (
        <ol className="moves__list" ref={scroller}>
          {rounds.map((round) => (
            <li key={round.number} className="moves__round">
              <span className="moves__number">{round.number}</span>
              <span className="moves__san">{round.white.san}</span>
              <span className="moves__san">{round.black?.san}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
