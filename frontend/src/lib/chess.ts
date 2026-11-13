import { Chess } from 'chess.js';
import type { Move } from 'chess.js';
import type { Side } from '../protocol';

export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q';

export interface PlayedMove {
  san: string;
  from: string;
  to: string;
}

export type Outcome =
  | { kind: 'checkmate'; winner: Side }
  | { kind: 'timeout'; winner: Side }
  | { kind: 'stalemate' | 'repetition' | 'material' | 'draw' };

const POSITION_KEY_FIELDS = 3;
const PIECE_VALUES: Record<PieceType, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };
const STARTING_COUNTS: Record<PieceType, number> = { p: 8, n: 2, b: 2, r: 2, q: 1 };
const CAPTURE_ORDER: PieceType[] = ['q', 'r', 'b', 'n', 'p'];

export const sideToMove = (chess: Chess): Side => (chess.turn() === 'w' ? 'white' : 'black');

export const opposite = (side: Side): Side => (side === 'white' ? 'black' : 'white');

const positionKey = (fen: string) => fen.split(' ').slice(0, POSITION_KEY_FIELDS).join(' ');

export function describeTransition(previousFen: string, nextFen: string): PlayedMove | null {
  const target = positionKey(nextFen);
  const candidates = new Chess(previousFen).moves({ verbose: true });
  const found = candidates.find((candidate: Move) => {
    const probe = new Chess(previousFen);
    probe.move(candidate.san);
    return positionKey(probe.fen()) === target;
  });
  return found ? { san: found.san, from: found.from, to: found.to } : null;
}

export function outcomeOf(chess: Chess, timeoutWinner: Side | null): Outcome | null {
  if (timeoutWinner) return { kind: 'timeout', winner: timeoutWinner };
  if (chess.isCheckmate()) return { kind: 'checkmate', winner: opposite(sideToMove(chess)) };
  if (chess.isStalemate()) return { kind: 'stalemate' };
  if (chess.isThreefoldRepetition()) return { kind: 'repetition' };
  if (chess.isInsufficientMaterial()) return { kind: 'material' };
  if (chess.isDraw()) return { kind: 'draw' };
  return null;
}

export interface Material {
  capturedByWhite: PieceType[];
  capturedByBlack: PieceType[];
  advantage: number;
}

export function materialOf(fen: string): Material {
  const onBoard = { white: emptyCounts(), black: emptyCounts() };
  for (const symbol of fen.split(' ')[0]) {
    const type = symbol.toLowerCase() as PieceType;
    if (!(type in PIECE_VALUES)) continue;
    onBoard[symbol === symbol.toUpperCase() ? 'white' : 'black'][type]++;
  }

  const missing = (counts: Record<PieceType, number>) =>
    CAPTURE_ORDER.flatMap((type) =>
      Array.from({ length: Math.max(0, STARTING_COUNTS[type] - counts[type]) }, () => type),
    );
  const value = (counts: Record<PieceType, number>) =>
    CAPTURE_ORDER.reduce((sum, type) => sum + counts[type] * PIECE_VALUES[type], 0);

  return {
    capturedByWhite: missing(onBoard.black),
    capturedByBlack: missing(onBoard.white),
    advantage: value(onBoard.white) - value(onBoard.black),
  };
}

const emptyCounts = (): Record<PieceType, number> => ({ p: 0, n: 0, b: 0, r: 0, q: 0 });

export function kingSquare(chess: Chess, color: 'w' | 'b'): string | null {
  for (const row of chess.board()) {
    for (const piece of row) {
      if (piece?.type === 'k' && piece.color === color) return piece.square;
    }
  }
  return null;
}

export function formatClock(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
