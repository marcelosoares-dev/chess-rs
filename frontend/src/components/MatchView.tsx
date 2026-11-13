import { Chess } from 'chess.js';
import { Flag } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { MessageKey, Params } from '../i18n';
import { materialOf, opposite, outcomeOf, sideToMove } from '../lib/chess';
import type { Match } from '../state/store';
import { Board } from './Board';
import { Chat } from './Chat';
import { Dialog } from './Dialog';
import { MoveList } from './MoveList';
import { PlayerBar } from './PlayerBar';

const CLOCK_RESOLUTION_MS = 200;
const RETURN_COUNTDOWN_S = 10;

interface Props {
  match: Match;
  me: string;
  t: (key: MessageKey, params?: Params) => string;
  onMove: (from: string, to: string) => boolean;
  onRematch: () => void;
  onResign: () => void;
  onReturn: () => void;
  onChat: (text: string) => void;
}

export function MatchView({ match, me, t, onMove, onRematch, onResign, onReturn, onChat }: Props) {
  const chess = useMemo(() => new Chess(match.fen), [match.fen]);
  const outcome = outcomeOf(chess, match.timeoutWinner);
  const turn = sideToMove(chess);
  const running = match.started && !outcome && !match.departure;

  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setNow(performance.now()), CLOCK_RESOLUTION_MS);
    return () => clearInterval(timer);
  }, [running]);

  const elapsed = running ? Math.max(0, now - match.syncedAt) : 0;
  const clocks = {
    white: match.whiteMs - (turn === 'white' ? elapsed : 0),
    black: match.blackMs - (turn === 'black' ? elapsed : 0),
  };

  const [dismissedAt, setDismissedAt] = useState<string | null>(null);
  const showOutcome = outcome !== null && dismissedAt !== match.fen + match.timeoutWinner;

  const opponentSide = opposite(match.color);
  const material = materialOf(match.fen);
  const captured = { white: material.capturedByWhite, black: material.capturedByBlack };
  const sideName = (side: 'white' | 'black') => t(side === 'white' ? 'whiteSide' : 'blackSide');

  const status = !match.started && turn === 'white' && match.moves.length === 0
    ? t('notStarted')
    : turn === match.color
      ? t('yourTurn')
      : t('opponentTurn', { name: match.opponent });

  const outcomeTitle = !outcome
    ? ''
    : 'winner' in outcome
      ? t(outcome.winner === match.color ? 'victory' : 'defeat')
      : t('drawTitle');
  const outcomeBody = !outcome
    ? ''
    : 'winner' in outcome
      ? t(outcome.kind, { side: sideName(outcome.winner) })
      : t(outcome.kind);

  return (
    <main className="match">
      <section className="match__stage">
        <PlayerBar
          name={match.opponent}
          side={opponentSide}
          captured={captured[opponentSide]}
          advantage={opponentSide === 'white' ? Math.max(0, material.advantage) : Math.max(0, -material.advantage)}
          clockMs={clocks[opponentSide]}
          active={running && turn === opponentSide}
        />
        <Board
          chess={chess}
          orientation={match.color}
          lastMove={match.moves.at(-1) ?? null}
          locked={outcome !== null || match.departure !== null}
          onMove={onMove}
        />
        <PlayerBar
          name={me}
          suffix={t('you')}
          side={match.color}
          captured={captured[match.color]}
          advantage={match.color === 'white' ? Math.max(0, material.advantage) : Math.max(0, -material.advantage)}
          clockMs={clocks[match.color]}
          active={running && turn === match.color}
        />
      </section>

      <aside className="match__side">
        <div className="panel status-card">
          <span className={`status-card__headline ${chess.inCheck() ? 'is-check' : ''}`}>
            {chess.inCheck() && !outcome ? `${t('check')} · ${status}` : status}
          </span>
          <button className="button button--danger-ghost" onClick={onResign}>
            <Flag size={14} />
            {t('leave')}
          </button>
        </div>
        <MoveList title={t('moves')} empty={t('noMoves')} moves={match.moves} />
        <Chat
          title={t('matchChat')}
          lines={match.chat}
          me={me}
          placeholder={t('chatPlaceholder')}
          empty={t('chatEmpty')}
          sendLabel={t('send')}
          onSend={onChat}
        />
      </aside>

      <Dialog
        open={showOutcome && !match.departure}
        title={outcomeTitle}
        actions={
          <>
            <button className="button button--ghost" onClick={() => setDismissedAt(match.fen + match.timeoutWinner)}>
              {t('viewBoard')}
            </button>
            <button className="button button--primary" onClick={onRematch}>{t('rematch')}</button>
          </>
        }
      >
        <p className="muted">{outcomeBody}</p>
      </Dialog>

      <DepartureDialog match={match} t={t} onReturn={onReturn} />
    </main>
  );
}

function DepartureDialog({ match, t, onReturn }: Pick<Props, 'match' | 't' | 'onReturn'>) {
  const { departure } = match;
  const [seconds, setSeconds] = useState(RETURN_COUNTDOWN_S);

  useEffect(() => {
    if (!departure) return;
    setSeconds(RETURN_COUNTDOWN_S);
    const timer = setInterval(() => setSeconds((value) => value - 1), 1000);
    return () => clearInterval(timer);
  }, [departure]);

  useEffect(() => {
    if (departure && seconds <= 0) onReturn();
  }, [departure, seconds, onReturn]);

  return (
    <Dialog
      open={departure !== null}
      title={t('opponentLeftTitle')}
      actions={
        <button className="button button--primary" onClick={onReturn}>{t('backToLobby')}</button>
      }
    >
      <p>{departure && t(departure.dropped ? 'opponentDroppedBody' : 'opponentLeftBody', { name: departure.name })}</p>
      <p className="muted">{t('returningIn', { sec: Math.max(0, seconds) })}</p>
    </Dialog>
  );
}
