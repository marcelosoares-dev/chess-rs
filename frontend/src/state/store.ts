import { Chess } from 'chess.js';
import type { Lang, MessageKey, Params } from '../i18n';
import { describeTransition, sideToMove } from '../lib/chess';
import type { PlayedMove } from '../lib/chess';
import type { LobbyEntry, ServerMessage, Side, Snapshot } from '../protocol';

const CHAT_HISTORY_LIMIT = 200;

export interface ChatLine {
  id: number;
  sender: string;
  text: string;
}

export interface Departure {
  name: string;
  dropped: boolean;
}

export interface Match {
  id: string;
  color: Side;
  opponent: string;
  fen: string;
  moves: PlayedMove[];
  whiteMs: number;
  blackMs: number;
  started: boolean;
  timeoutWinner: Side | null;
  syncedAt: number;
  rollback: { fen: string; moves: PlayedMove[] } | null;
  departure: Departure | null;
  chat: ChatLine[];
}

export type Notice = { id: number } & ({ key: MessageKey; params?: Params } | { text: string });

export interface AppState {
  lang: Lang;
  nickname: string | null;
  nicknameRejected: boolean;
  players: LobbyEntry[];
  incoming: { connId: string; nickname: string } | null;
  outgoing: string | null;
  lobbyChat: ChatLine[];
  match: Match | null;
  notice: Notice | null;
  sequence: number;
}

export type Action =
  | { type: 'server'; message: ServerMessage; at: number }
  | { type: 'moved'; move: PlayedMove; fen: string; at: number }
  | { type: 'language'; lang: Lang }
  | { type: 'challengeSent'; to: string }
  | { type: 'challengeCleared' }
  | { type: 'incomingCleared' }
  | { type: 'noticed'; key: MessageKey }
  | { type: 'noticeDismissed' }
  | { type: 'matchLeft' };

export const initialState = (lang: Lang = 'pt'): AppState => ({
  lang,
  nickname: null,
  nicknameRejected: false,
  players: [],
  incoming: null,
  outgoing: null,
  lobbyChat: [],
  match: null,
  notice: null,
  sequence: 0,
});

const remember = (lines: ChatLine[], line: ChatLine) => [...lines, line].slice(-CHAT_HISTORY_LIMIT);

function withNotice(state: AppState, content: { key: MessageKey; params?: Params } | { text: string }): AppState {
  const sequence = state.sequence + 1;
  return { ...state, sequence, notice: { id: sequence, ...content } };
}

function openMatch(payload: Snapshot & { color: Side; opponent_nickname: string }, at: number): Match {
  return {
    id: payload.game_id,
    color: payload.color,
    opponent: payload.opponent_nickname,
    fen: payload.fen,
    moves: [],
    whiteMs: payload.white_time_ms,
    blackMs: payload.black_time_ms,
    started: payload.game_started,
    timeoutWinner: payload.timeout_winner,
    syncedAt: at,
    rollback: null,
    departure: null,
    chat: [],
  };
}

function synchronize(match: Match, snapshot: Snapshot, at: number): Match {
  let moves = match.moves;
  if (snapshot.fen !== match.fen) {
    if (!snapshot.game_started) {
      moves = [];
    } else {
      const played = describeTransition(match.fen, snapshot.fen);
      moves = played ? [...match.moves, played] : match.moves;
    }
  }
  return {
    ...match,
    fen: snapshot.fen,
    moves,
    whiteMs: snapshot.white_time_ms,
    blackMs: snapshot.black_time_ms,
    started: snapshot.game_started,
    timeoutWinner: snapshot.timeout_winner,
    syncedAt: at,
    rollback: null,
  };
}

function handleServer(state: AppState, message: ServerMessage, at: number): AppState {
  const { match } = state;

  switch (message.type) {
    case 'ConnectionEstablished':
      if (state.nickname || match) {
        return withNotice(initialState(state.lang), { key: 'connectionLost' });
      }
      return state;

    case 'NicknameAccepted':
      return { ...state, nickname: message.payload.nickname, nicknameRejected: false };

    case 'NicknameRejected':
      return { ...state, nicknameRejected: true };

    case 'LobbyUpdate':
      return { ...state, players: message.payload.players };

    case 'ChallengeReceived':
      return {
        ...state,
        incoming: { connId: message.payload.from_conn_id, nickname: message.payload.from_nickname },
      };

    case 'ChallengeDeclined':
      return withNotice(
        { ...state, outgoing: null },
        { key: 'declined', params: { name: message.payload.from_nickname } },
      );

    case 'ChallengeAccepted':
      return { ...state, incoming: null, outgoing: null, match: openMatch(message.payload, at) };

    case 'GameState':
    case 'MoveResponse':
      if (!match || match.id !== message.payload.game_id) return state;
      return { ...state, match: synchronize(match, message.payload, at) };

    case 'GameExited':
      if (message.payload.reason === 'self_quit') {
        return { ...initialState(state.lang), sequence: state.sequence };
      }
      return match
        ? { ...state, match: { ...match, departure: { name: message.payload.by, dropped: false } } }
        : state;

    case 'OpponentDisconnected':
      return match
        ? { ...state, match: { ...match, departure: { name: match.opponent, dropped: true } } }
        : state;

    case 'ChatMessageEcho': {
      const line = { id: state.sequence + 1, sender: message.payload.sender, text: message.payload.message };
      const next = { ...state, sequence: line.id };
      return match
        ? { ...next, match: { ...match, chat: remember(match.chat, line) } }
        : { ...next, lobbyChat: remember(state.lobbyChat, line) };
    }

    case 'Error': {
      const restored = match?.rollback
        ? { ...match, ...match.rollback, rollback: null }
        : match;
      return withNotice({ ...state, match: restored }, { text: message.payload.message });
    }

    case 'Pong':
      return state;
  }
}

export function reduce(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'server':
      return handleServer(state, action.message, action.at);

    case 'moved': {
      const { match } = state;
      if (!match) return state;
      const elapsed = match.started ? action.at - match.syncedAt : 0;
      const mover = sideToMove(new Chess(match.fen));
      return {
        ...state,
        match: {
          ...match,
          fen: action.fen,
          moves: [...match.moves, action.move],
          whiteMs: mover === 'white' ? match.whiteMs - elapsed : match.whiteMs,
          blackMs: mover === 'black' ? match.blackMs - elapsed : match.blackMs,
          started: true,
          syncedAt: action.at,
          rollback: match.rollback ?? { fen: match.fen, moves: match.moves },
        },
      };
    }

    case 'language':
      return { ...state, lang: action.lang };
    case 'challengeSent':
      return { ...state, outgoing: action.to };
    case 'challengeCleared':
      return { ...state, outgoing: null };
    case 'incomingCleared':
      return { ...state, incoming: null };
    case 'noticed':
      return withNotice(state, { key: action.key });
    case 'noticeDismissed':
      return { ...state, notice: null };
    case 'matchLeft':
      return { ...state, match: null };
  }
}
