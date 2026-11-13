use std::{
    collections::{HashMap, HashSet},
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc,
    },
    time::{Duration, Instant},
};

use tokio::{
    sync::mpsc::{self, error::TrySendError},
    time::{interval, MissedTickBehavior},
};

use crate::{
    game::{parse_promotion, parse_square, Game, MoveOutcome},
    protocol::{ClientMessage, ConnId, ExitReason, GameId, LobbyEntry, ServerMessage, Side},
};

pub type Outbox = mpsc::Sender<Arc<str>>;

const COMMAND_QUEUE: usize = 1024;
const CLOCK_RESOLUTION: Duration = Duration::from_millis(250);
const MAX_NICKNAME_CHARS: usize = 24;
const MAX_CHAT_CHARS: usize = 500;

#[derive(Debug)]
pub enum Command {
    Connect { id: ConnId, outbox: Outbox },
    Inbound { id: ConnId, message: ClientMessage },
    Disconnect { id: ConnId },
}

#[derive(Clone)]
pub struct Hub {
    commands: mpsc::Sender<Command>,
    next_id: Arc<AtomicU64>,
}

impl Hub {
    pub fn spawn() -> Self {
        let (commands, inbox) = mpsc::channel(COMMAND_QUEUE);
        tokio::spawn(Actor::default().run(inbox));
        Self {
            commands,
            next_id: Arc::new(AtomicU64::new(1)),
        }
    }

    pub fn allocate_id(&self) -> ConnId {
        ConnId(self.next_id.fetch_add(1, Ordering::Relaxed))
    }

    pub async fn dispatch(&self, command: Command) -> bool {
        self.commands.send(command).await.is_ok()
    }
}

struct Session {
    outbox: Outbox,
    nickname: Option<String>,
    game: Option<GameId>,
}

impl Session {
    fn in_lobby(&self) -> bool {
        self.nickname.is_some() && self.game.is_none()
    }

    fn deliver(&self, frame: Arc<str>) {
        if let Err(TrySendError::Full(_)) = self.outbox.try_send(frame) {
            tracing::warn!("outbox saturada, quadro descartado");
        }
    }
}

struct Room {
    game: Game,
    white: ConnId,
    black: ConnId,
}

impl Room {
    fn players(&self) -> [ConnId; 2] {
        [self.white, self.black]
    }

    fn side_of(&self, id: ConnId) -> Option<Side> {
        match id {
            _ if id == self.white => Some(Side::White),
            _ if id == self.black => Some(Side::Black),
            _ => None,
        }
    }

    fn opponent_of(&self, id: ConnId) -> ConnId {
        if id == self.white {
            self.black
        } else {
            self.white
        }
    }
}

#[derive(Default)]
struct Actor {
    sessions: HashMap<ConnId, Session>,
    rooms: HashMap<GameId, Room>,
    challenges: HashSet<(ConnId, ConnId)>,
    games_started: u64,
}

fn encode(message: &ServerMessage) -> Arc<str> {
    serde_json::to_string(message)
        .expect("mensagens do protocolo são sempre serializáveis")
        .into()
}

impl Actor {
    async fn run(mut self, mut inbox: mpsc::Receiver<Command>) {
        let mut clock = interval(CLOCK_RESOLUTION);
        clock.set_missed_tick_behavior(MissedTickBehavior::Delay);

        loop {
            tokio::select! {
                command = inbox.recv() => match command {
                    Some(command) => self.handle(command),
                    None => break,
                },
                _ = clock.tick() => self.advance_clocks(Instant::now()),
            }
        }
    }

    fn handle(&mut self, command: Command) {
        match command {
            Command::Connect { id, outbox } => self.connect(id, outbox),
            Command::Disconnect { id } => self.disconnect(id),
            Command::Inbound { id, message } => self.dispatch(id, message),
        }
    }

    fn dispatch(&mut self, id: ConnId, message: ClientMessage) {
        match message {
            ClientMessage::Ping => self.send(id, &ServerMessage::Pong {}),
            ClientMessage::ClaimNickname { nickname } => self.claim_nickname(id, &nickname),
            ClientMessage::ChatMessage { message } => self.chat(id, &message),
            ClientMessage::SendChallenge { target_nickname } => {
                self.challenge(id, &target_nickname)
            }
            ClientMessage::AcceptChallenge { from_conn_id } => {
                self.accept_challenge(id, from_conn_id)
            }
            ClientMessage::DeclineChallenge { from_conn_id } => {
                self.decline_challenge(id, from_conn_id)
            }
            ClientMessage::MakeMove {
                game_id,
                from,
                to,
                promotion,
            } => self.make_move(id, &game_id, &from, &to, promotion),
            ClientMessage::ResetGame { game_id } => self.reset_game(id, &game_id),
            ClientMessage::QuitGame { game_id } => self.quit_game(id, &game_id),
        }
    }

    fn send(&self, to: ConnId, message: &ServerMessage) {
        if let Some(session) = self.sessions.get(&to) {
            session.deliver(encode(message));
        }
    }

    fn send_all(&self, recipients: impl IntoIterator<Item = ConnId>, message: &ServerMessage) {
        let frame = encode(message);
        for id in recipients {
            if let Some(session) = self.sessions.get(&id) {
                session.deliver(Arc::clone(&frame));
            }
        }
    }

    fn lobby_members(&self) -> impl Iterator<Item = (ConnId, &str)> {
        self.sessions
            .iter()
            .filter(|(_, session)| session.in_lobby())
            .map(|(id, session)| (*id, session.nickname.as_deref().unwrap_or_default()))
    }

    fn nickname_of(&self, id: ConnId) -> Option<&str> {
        self.sessions.get(&id)?.nickname.as_deref()
    }

    fn broadcast_lobby(&self) {
        let mut players: Vec<LobbyEntry> = self
            .lobby_members()
            .map(|(conn_id, nickname)| LobbyEntry {
                conn_id,
                nickname: nickname.to_owned(),
            })
            .collect();
        players.sort_by_key(|entry| entry.nickname.to_lowercase());

        let recipients: Vec<ConnId> = players.iter().map(|entry| entry.conn_id).collect();
        self.send_all(recipients, &ServerMessage::LobbyUpdate { players });
    }

    fn connect(&mut self, id: ConnId, outbox: Outbox) {
        tracing::info!(%id, "conexão aberta");
        self.sessions.insert(
            id,
            Session {
                outbox,
                nickname: None,
                game: None,
            },
        );
        self.send(id, &ServerMessage::ConnectionEstablished { conn_id: id });
    }

    fn disconnect(&mut self, id: ConnId) {
        let Some(session) = self.sessions.remove(&id) else {
            return;
        };
        tracing::info!(%id, "conexão encerrada");
        self.challenges.retain(|&(from, to)| from != id && to != id);

        if let Some(room) = session.game.and_then(|game| self.rooms.remove(&game)) {
            let opponent = room.opponent_of(id);
            if let Some(session) = self.sessions.get_mut(&opponent) {
                session.game = None;
            }
            self.send(opponent, &ServerMessage::OpponentDisconnected {});
        }
        self.broadcast_lobby();
    }

    fn claim_nickname(&mut self, id: ConnId, requested: &str) {
        let nickname = requested.trim();
        let well_formed = (1..=MAX_NICKNAME_CHARS).contains(&nickname.chars().count())
            && !nickname.chars().any(char::is_control);
        let key = nickname.to_lowercase();
        let taken = self.sessions.values().any(|session| {
            session
                .nickname
                .as_deref()
                .is_some_and(|existing| existing.to_lowercase() == key)
        });
        let already_named = self.nickname_of(id).is_some();

        if !well_formed || taken || already_named {
            self.send(
                id,
                &ServerMessage::NicknameRejected {
                    message: "Este nickname já está em uso ou é inválido!".into(),
                },
            );
            return;
        }

        if let Some(session) = self.sessions.get_mut(&id) {
            session.nickname = Some(nickname.to_owned());
        }
        self.send(
            id,
            &ServerMessage::NicknameAccepted {
                nickname: nickname.to_owned(),
            },
        );
        self.broadcast_lobby();
    }

    fn chat(&self, id: ConnId, text: &str) {
        let text: String = text.trim().chars().take(MAX_CHAT_CHARS).collect();
        let Some(session) = self.sessions.get(&id) else {
            return;
        };
        let Some(sender) = session.nickname.clone() else {
            return;
        };
        if text.is_empty() {
            return;
        }

        let recipients: Vec<ConnId> = match session.game.as_ref().and_then(|g| self.rooms.get(g)) {
            Some(room) => room.players().to_vec(),
            None => self.lobby_members().map(|(id, _)| id).collect(),
        };
        self.send_all(
            recipients,
            &ServerMessage::ChatMessageEcho {
                sender,
                message: text,
            },
        );
    }

    fn challenge(&mut self, id: ConnId, target_nickname: &str) {
        let key = target_nickname.trim().to_lowercase();
        let challenger = self
            .sessions
            .get(&id)
            .filter(|session| session.in_lobby())
            .and_then(|session| session.nickname.clone());
        let target = self
            .lobby_members()
            .find(|&(other, nickname)| other != id && nickname.to_lowercase() == key)
            .map(|(other, _)| other);

        match (challenger, target) {
            (Some(from_nickname), Some(target)) => {
                self.challenges.insert((id, target));
                self.send(
                    target,
                    &ServerMessage::ChallengeReceived {
                        from_conn_id: id,
                        from_nickname,
                    },
                );
            }
            _ => self.send(
                id,
                &ServerMessage::error("Jogador não encontrado ou ocupado!"),
            ),
        }
    }

    fn decline_challenge(&mut self, id: ConnId, from: ConnId) {
        if !self.challenges.remove(&(from, id)) {
            return;
        }
        if let Some(from_nickname) = self.nickname_of(id).map(str::to_owned) {
            self.send(from, &ServerMessage::ChallengeDeclined { from_nickname });
        }
    }

    fn accept_challenge(&mut self, id: ConnId, from: ConnId) {
        let pending = self.challenges.remove(&(from, id));
        let both_available = [id, from]
            .iter()
            .all(|conn| self.sessions.get(conn).is_some_and(Session::in_lobby));

        if !(pending && both_available) {
            self.send(
                id,
                &ServerMessage::error("O oponente saiu do saguão ou já está em jogo!"),
            );
            return;
        }
        self.start_game(from, id);
    }

    fn start_game(&mut self, white: ConnId, black: ConnId) {
        self.challenges
            .retain(|&(a, b)| ![a, b].iter().any(|id| *id == white || *id == black));

        self.games_started += 1;
        let game_id = GameId(format!("match_{}", self.games_started));
        let game = Game::new();
        let state = game.snapshot(&game_id);

        for id in [white, black] {
            if let Some(session) = self.sessions.get_mut(&id) {
                session.game = Some(game_id.clone());
            }
        }
        self.rooms.insert(game_id, Room { game, white, black });

        for (me, color, opponent) in [(white, Side::White, black), (black, Side::Black, white)] {
            let opponent_nickname = self.nickname_of(opponent).unwrap_or_default().to_owned();
            self.send(
                me,
                &ServerMessage::ChallengeAccepted {
                    color,
                    opponent_nickname,
                    state: state.clone(),
                },
            );
        }
        self.broadcast_lobby();
    }

    fn make_move(
        &mut self,
        id: ConnId,
        game_id: &GameId,
        from: &str,
        to: &str,
        promotion: Option<char>,
    ) {
        let Some((from, to)) = parse_square(from).zip(parse_square(to)) else {
            self.send(id, &ServerMessage::error("Casa inválida."));
            return;
        };
        let Some(room) = self.rooms.get_mut(game_id) else {
            self.send(id, &ServerMessage::error("Partida não encontrada."));
            return;
        };
        let Some(side) = room.side_of(id) else {
            self.send(
                id,
                &ServerMessage::error("Espectadores não podem mover peças!"),
            );
            return;
        };

        let outcome = room
            .game
            .play(side, from, to, parse_promotion(promotion), Instant::now());
        let state = room.game.snapshot(game_id);
        let players = room.players();

        match outcome {
            Ok(MoveOutcome::Played) => self.send_all(
                players,
                &ServerMessage::MoveResponse {
                    success: true,
                    state,
                },
            ),
            Ok(MoveOutcome::Flagged { .. }) => {
                self.send_all(players, &ServerMessage::GameState(state))
            }
            Err(error) => self.send(id, &ServerMessage::error(error.to_string())),
        }
    }

    fn reset_game(&mut self, id: ConnId, game_id: &GameId) {
        let Some(room) = self.rooms.get_mut(game_id) else {
            return;
        };
        if room.side_of(id).is_none() {
            return;
        }
        room.game = Game::new();
        let state = room.game.snapshot(game_id);
        let players = room.players();
        self.send_all(players, &ServerMessage::GameState(state));
    }

    fn quit_game(&mut self, id: ConnId, game_id: &GameId) {
        let is_member = self
            .rooms
            .get(game_id)
            .is_some_and(|room| room.side_of(id).is_some());
        if !is_member {
            return;
        }
        let Some(room) = self.rooms.remove(game_id) else {
            return;
        };

        let by = self.nickname_of(id).unwrap_or_default().to_owned();
        let opponent = room.opponent_of(id);

        if let Some(session) = self.sessions.get_mut(&id) {
            session.game = None;
            session.nickname = None;
        }
        if let Some(session) = self.sessions.get_mut(&opponent) {
            session.game = None;
        }

        self.send(
            id,
            &ServerMessage::GameExited {
                reason: ExitReason::SelfQuit,
                by: by.clone(),
            },
        );
        self.send(
            opponent,
            &ServerMessage::GameExited {
                reason: ExitReason::OpponentQuit,
                by,
            },
        );
        self.broadcast_lobby();
    }

    fn advance_clocks(&mut self, now: Instant) {
        let expired: Vec<(GameId, [ConnId; 2])> = self
            .rooms
            .iter_mut()
            .filter_map(|(game_id, room)| {
                room.game
                    .tick(now)
                    .map(|_| (game_id.clone(), room.players()))
            })
            .collect();

        for (game_id, players) in expired {
            if let Some(room) = self.rooms.get(&game_id) {
                let state = room.game.snapshot(&game_id);
                self.send_all(players, &ServerMessage::GameState(state));
            }
        }
    }
}
