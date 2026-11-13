export type Side = 'white' | 'black';

export interface Snapshot {
  game_id: string;
  fen: string;
  white_time_ms: number;
  black_time_ms: number;
  game_started: boolean;
  timeout_winner: Side | null;
}

export interface LobbyEntry {
  conn_id: string;
  nickname: string;
}

export type ServerMessage =
  | { type: 'ConnectionEstablished'; payload: { conn_id: string } }
  | { type: 'Pong'; payload: Record<string, never> }
  | { type: 'NicknameAccepted'; payload: { nickname: string } }
  | { type: 'NicknameRejected'; payload: { message: string } }
  | { type: 'LobbyUpdate'; payload: { players: LobbyEntry[] } }
  | { type: 'ChallengeReceived'; payload: { from_conn_id: string; from_nickname: string } }
  | { type: 'ChallengeDeclined'; payload: { from_nickname: string } }
  | { type: 'ChallengeAccepted'; payload: Snapshot & { color: Side; opponent_nickname: string } }
  | { type: 'GameState'; payload: Snapshot }
  | { type: 'MoveResponse'; payload: Snapshot & { success: boolean } }
  | { type: 'GameExited'; payload: { reason: 'self_quit' | 'opponent_quit'; by: string } }
  | { type: 'OpponentDisconnected'; payload: Record<string, never> }
  | { type: 'ChatMessageEcho'; payload: { sender: string; message: string } }
  | { type: 'Error'; payload: { message: string } };

export type ClientMessage =
  | { type: 'ClaimNickname'; payload: { nickname: string } }
  | { type: 'ChatMessage'; payload: { message: string } }
  | { type: 'SendChallenge'; payload: { target_nickname: string } }
  | { type: 'AcceptChallenge'; payload: { from_conn_id: string } }
  | { type: 'DeclineChallenge'; payload: { from_conn_id: string } }
  | { type: 'MakeMove'; payload: { game_id: string; from: string; to: string } }
  | { type: 'ResetGame'; payload: { game_id: string } }
  | { type: 'QuitGame'; payload: { game_id: string } };
