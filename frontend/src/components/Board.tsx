import { Chess } from 'chess.js';
import type { Square } from 'chess.js';
import type { CSSProperties } from 'react';
import { useMemo, useState } from 'react';
import { Chessboard } from 'react-chessboard';
import { kingSquare } from '../lib/chess';
import type { PlayedMove } from '../lib/chess';
import type { Side } from '../protocol';

interface Props {
  chess: Chess;
  orientation: Side;
  lastMove: PlayedMove | null;
  locked: boolean;
  onMove: (from: string, to: string) => boolean;
}

const LAST_MOVE: CSSProperties = { backgroundColor: 'var(--board-last-move)' };
const SELECTED: CSSProperties = { backgroundColor: 'var(--board-selected)' };
const CHECK: CSSProperties = {
  background: 'radial-gradient(circle, var(--red) 0%, rgba(255, 69, 58, 0.35) 55%, transparent 75%)',
};
const DOT: CSSProperties = {
  background: 'radial-gradient(circle, var(--board-hint) 0 17%, transparent 19%)',
};
const RING: CSSProperties = {
  background: 'radial-gradient(circle, transparent 0 66%, var(--board-hint) 68% 82%, transparent 84%)',
};

export function Board({ chess, orientation, lastMove, locked, onMove }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const mine = orientation === 'white' ? 'w' : 'b';
  const fen = chess.fen();

  const targets = useMemo(() => {
    if (!selected || locked) return [];
    return new Chess(fen).moves({ square: selected as Square, verbose: true }).map((move) => move.to);
  }, [selected, fen, locked]);

  const squareStyles = useMemo(() => {
    const styles: Record<string, CSSProperties> = {};
    if (lastMove) {
      styles[lastMove.from] = LAST_MOVE;
      styles[lastMove.to] = LAST_MOVE;
    }
    if (chess.inCheck()) {
      const square = kingSquare(chess, chess.turn());
      if (square) styles[square] = CHECK;
    }
    if (selected) styles[selected] = { ...styles[selected], ...SELECTED };
    for (const square of targets) {
      styles[square] = { ...styles[square], ...(chess.get(square as Square) ? RING : DOT) };
    }
    return styles;
  }, [chess, lastMove, selected, targets]);

  const attempt = (from: string, to: string) => {
    setSelected(null);
    return onMove(from, to);
  };

  return (
    <div className="board">
      <Chessboard
        options={{
          position: fen,
          boardOrientation: orientation,
          squareStyles,
          animationDurationInMs: 220,
          showNotation: true,
          allowDragging: !locked,
          canDragPiece: ({ piece }) => piece.pieceType.startsWith(mine),
          onPieceDrop: ({ sourceSquare, targetSquare }) =>
            targetSquare ? attempt(sourceSquare, targetSquare) : false,
          onSquareClick: ({ square }) => {
            if (locked) return;
            if (selected && targets.includes(square as Square)) {
              attempt(selected, square);
              return;
            }
            const piece = chess.get(square as Square);
            setSelected(piece?.color === mine && square !== selected ? square : null);
          },
          boardStyle: { borderRadius: 'var(--radius-board)', boxShadow: 'var(--shadow-board)' },
          lightSquareStyle: { backgroundColor: 'var(--board-light)' },
          darkSquareStyle: { backgroundColor: 'var(--board-dark)' },
          alphaNotationStyle: { fontSize: 11, fontWeight: 600 },
          numericNotationStyle: { fontSize: 11, fontWeight: 600 },
        }}
      />
    </div>
  );
}
