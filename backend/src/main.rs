use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    response::IntoResponse,
    routing::get,
    Router,
};
use futures_util::{SinkExt, StreamExt};
use serde_json::Value;
use shakmaty::fen::Fen;
use shakmaty::{CastlingMode, Chess, EnPassantMode, Position, Square};
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::sync::{mpsc, RwLock};
use tower_http::cors::CorsLayer;

static NEXT_CONN_ID: AtomicUsize = AtomicUsize::new(1);

#[derive(Clone)]
struct LobbyPlayer {
    conn_id: String,
    nickname: String,
    status: String,
    tx: mpsc::UnboundedSender<Message>,
}

#[derive(Clone)]
struct PlayerConnection {
    id: String,
    nickname: String,
    color: String,
    tx: mpsc::UnboundedSender<Message>,
}

#[allow(dead_code)]
struct Room {
    fen: String,
    white_id: Option<String>,
    black_id: Option<String>,
    white_nickname: Option<String>,
    black_nickname: Option<String>,
    players: HashMap<String, PlayerConnection>,
    white_time_ms: u128,
    black_time_ms: u128,
    last_move_time: Option<u128>,
    game_started: bool,
    timeout_winner: Option<String>,
}

#[derive(Clone)]
struct AppState {
    players: Arc<RwLock<HashMap<String, LobbyPlayer>>>,
    rooms: Arc<RwLock<HashMap<String, Room>>>,
}

const DEFAULT_START_FEN: &str = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

fn get_current_time_ms() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
}

async fn broadcast_lobby_list(state: &AppState) {
    let players = state.players.read().await;
    let lobby_list: Vec<serde_json::Value> = players
        .values()
        .filter(|p| p.status == "lobby")
        .map(|p| {
            serde_json::json!({
                "conn_id": p.conn_id,
                "nickname": p.nickname,
            })
        })
        .collect();

    let response = serde_json::json!({
        "type": "LobbyUpdate",
        "payload": {
            "players": lobby_list
        }
    });

    let msg_str = response.to_string();
    for p in players.values() {
        if p.status == "lobby" {
            let _ = p.tx.send(Message::Text(msg_str.clone()));
        }
    }
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    let state = AppState {
        players: Arc::new(RwLock::new(HashMap::new())),
        rooms: Arc::new(RwLock::new(HashMap::new())),
    };

    let app = Router::new()
        .route("/health", get(health_check))
        .route("/ws", get(ws_handler))
        .layer(CorsLayer::permissive())
        .with_state(state);

    let addr = SocketAddr::from(([0, 0, 0, 0], 8080));
    tracing::info!("Servidor do Xadrez ativo em http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn health_check() -> impl IntoResponse {
    "OK - Backend Chess em Rust funcionando!"
}

async fn ws_handler(ws: WebSocketUpgrade, State(state): State<AppState>) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, state))
}

fn validate_and_play_move(fen_str: &str, from: &str, to: &str) -> Result<String, &'static str> {
    let fen: Fen = fen_str.parse().map_err(|_| "Failed to parse FEN")?;
    let pos: Chess = fen
        .into_position(CastlingMode::Standard)
        .map_err(|_| "Invalid FEN position")?;

    let from_sq = Square::from_ascii(from.as_bytes()).map_err(|_| "Invalid source square")?;
    let to_sq = Square::from_ascii(to.as_bytes()).map_err(|_| "Invalid target square")?;

    let legals = pos.legal_moves();
    let matched_move = legals
        .into_iter()
        .find(|m| m.from() == Some(from_sq) && m.to() == to_sq);

    if let Some(m) = matched_move {
        let next_pos = pos.play(&m).map_err(|_| "Illegal move execution")?;
        let next_fen = Fen::from_position(next_pos, EnPassantMode::Legal).to_string();
        Ok(next_fen)
    } else {
        Err("Move is not legal in current position")
    }
}

async fn handle_socket(socket: WebSocket, state: AppState) {
    let conn_id = NEXT_CONN_ID.fetch_add(1, Ordering::Relaxed).to_string();
    tracing::info!("Nova conexão WebSocket estabelecida! ID: {}", conn_id);

    let (mut ws_sender, mut ws_receiver) = socket.split();
    let (tx, mut rx) = mpsc::unbounded_channel::<Message>();

    let writer_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if ws_sender.send(msg).await.is_err() {
                break;
            }
        }
    });

    let welcome = serde_json::json!({
        "type": "ConnectionEstablished",
        "payload": {
            "message": "Conectado ao Servidor Axum Chess Backend!"
        }
    });
    let _ = tx.send(Message::Text(welcome.to_string()));

    let mut current_room_id: Option<String> = None;

    while let Some(msg_result) = ws_receiver.next().await {
        match msg_result {
            Ok(msg) => match msg {
                Message::Text(text) => {
                    tracing::debug!("Mensagem recebida do ID {}: {}", conn_id, text);

                    if let Ok(val) = serde_json::from_str::<Value>(&text) {
                        let msg_type = val
                            .get("type")
                            .and_then(|t| t.as_str())
                            .unwrap_or("Unknown");
                        let payload = val.get("payload").cloned().unwrap_or(Value::Null);

                        match msg_type {
                            "Ping" => {
                                let response = serde_json::json!({
                                    "type": "Pong",
                                    "payload": payload
                                });
                                let _ = tx.send(Message::Text(response.to_string()));
                            }
                            "ChatMessage" => {
                                if let Some(room_id) = &current_room_id {
                                    let rooms = state.rooms.read().await;
                                    if let Some(room) = rooms.get(room_id) {
                                        let my_nick = room
                                            .players
                                            .get(&conn_id)
                                            .map(|p| p.nickname.as_str())
                                            .unwrap_or("Jogador");
                                        let response = serde_json::json!({
                                            "type": "ChatMessageEcho",
                                            "payload": {
                                                "sender": my_nick,
                                                "message": payload.get("message").and_then(|m| m.as_str()).unwrap_or("")
                                            }
                                        });
                                        for player in room.players.values() {
                                            let _ =
                                                player.tx.send(Message::Text(response.to_string()));
                                        }
                                    }
                                } else {
                                    let players = state.players.read().await;
                                    let my_nick = players
                                        .get(&conn_id)
                                        .map(|p| p.nickname.as_str())
                                        .unwrap_or("Jogador");
                                    let response = serde_json::json!({
                                        "type": "ChatMessageEcho",
                                        "payload": {
                                            "sender": my_nick,
                                            "message": payload.get("message").and_then(|m| m.as_str()).unwrap_or("")
                                        }
                                    });
                                    for p in players.values() {
                                        if p.status == "lobby" {
                                            let _ = p.tx.send(Message::Text(response.to_string()));
                                        }
                                    }
                                }
                            }
                            "ClaimNickname" => {
                                let requested_nickname = payload
                                    .get("nickname")
                                    .and_then(|n| n.as_str())
                                    .unwrap_or("")
                                    .trim();
                                let mut name_taken = false;

                                if requested_nickname.is_empty() {
                                    name_taken = true;
                                } else {
                                    let players = state.players.read().await;
                                    for p in players.values() {
                                        if p.nickname.eq_ignore_ascii_case(requested_nickname) {
                                            name_taken = true;
                                            break;
                                        }
                                    }
                                }

                                if name_taken {
                                    let reject_msg = serde_json::json!({
                                        "type": "NicknameRejected",
                                        "payload": {
                                            "message": "Este nickname já está em uso ou é inválido!"
                                        }
                                    });
                                    let _ = tx.send(Message::Text(reject_msg.to_string()));
                                } else {
                                    {
                                        let mut players = state.players.write().await;
                                        let p = LobbyPlayer {
                                            conn_id: conn_id.clone(),
                                            nickname: requested_nickname.to_string(),
                                            status: "lobby".to_string(),
                                            tx: tx.clone(),
                                        };
                                        players.insert(conn_id.clone(), p);
                                    }

                                    let accept_msg = serde_json::json!({
                                        "type": "NicknameAccepted",
                                        "payload": {
                                            "nickname": requested_nickname
                                        }
                                    });
                                    let _ = tx.send(Message::Text(accept_msg.to_string()));
                                    broadcast_lobby_list(&state).await;
                                }
                            }
                            "SendChallenge" => {
                                let target_nickname = payload
                                    .get("target_nickname")
                                    .and_then(|n| n.as_str())
                                    .unwrap_or("");
                                let players = state.players.read().await;
                                let target_player = players
                                    .values()
                                    .find(|p| p.nickname == target_nickname && p.status == "lobby");

                                if let Some(target) = target_player {
                                    if let Some(me) = players.get(&conn_id) {
                                        let challenge_msg = serde_json::json!({
                                            "type": "ChallengeReceived",
                                            "payload": {
                                                "from_conn_id": conn_id.clone(),
                                                "from_nickname": me.nickname.clone(),
                                            }
                                        });
                                        let _ = target
                                            .tx
                                            .send(Message::Text(challenge_msg.to_string()));
                                    }
                                } else {
                                    let err_msg = serde_json::json!({
                                        "type": "Error",
                                        "payload": { "message": "Jogador não encontrado ou ocupado!" }
                                    });
                                    let _ = tx.send(Message::Text(err_msg.to_string()));
                                }
                            }
                            "DeclineChallenge" => {
                                let from_conn_id = payload
                                    .get("from_conn_id")
                                    .and_then(|id| id.as_str())
                                    .unwrap_or("");
                                let players = state.players.read().await;
                                if let Some(target) = players.get(from_conn_id) {
                                    if let Some(me) = players.get(&conn_id) {
                                        let decline_msg = serde_json::json!({
                                            "type": "ChallengeDeclined",
                                            "payload": {
                                                "from_nickname": me.nickname.clone(),
                                            }
                                        });
                                        let _ =
                                            target.tx.send(Message::Text(decline_msg.to_string()));
                                    }
                                }
                            }
                            "AcceptChallenge" => {
                                let from_conn_id = payload
                                    .get("from_conn_id")
                                    .and_then(|id| id.as_str())
                                    .unwrap_or("");
                                let mut players = state.players.write().await;

                                let challenger_ok = players
                                    .get(from_conn_id)
                                    .map(|p| p.status == "lobby")
                                    .unwrap_or(false);
                                let me_ok = players
                                    .get(&conn_id)
                                    .map(|p| p.status == "lobby")
                                    .unwrap_or(false);

                                if challenger_ok && me_ok {
                                    if let Some(p) = players.get_mut(from_conn_id) {
                                        p.status = "playing".to_string();
                                    }
                                    if let Some(p) = players.get_mut(&conn_id) {
                                        p.status = "playing".to_string();
                                    }

                                    let nick_a =
                                        players.get(from_conn_id).unwrap().nickname.clone();
                                    let nick_b = players.get(&conn_id).unwrap().nickname.clone();
                                    let tx_a = players.get(from_conn_id).unwrap().tx.clone();
                                    let tx_b = players.get(&conn_id).unwrap().tx.clone();

                                    let room_id = format!("match_{}_{}", from_conn_id, conn_id);
                                    current_room_id = Some(room_id.clone());

                                    let mut room_players = HashMap::new();

                                    let conn_a = PlayerConnection {
                                        id: from_conn_id.to_string(),
                                        nickname: nick_a.clone(),
                                        color: "white".to_string(),
                                        tx: tx_a.clone(),
                                    };
                                    let conn_b = PlayerConnection {
                                        id: conn_id.clone(),
                                        nickname: nick_b.clone(),
                                        color: "black".to_string(),
                                        tx: tx_b.clone(),
                                    };

                                    room_players.insert(from_conn_id.to_string(), conn_a);
                                    room_players.insert(conn_id.clone(), conn_b);

                                    let new_room = Room {
                                        fen: DEFAULT_START_FEN.to_string(),
                                        white_id: Some(from_conn_id.to_string()),
                                        black_id: Some(conn_id.clone()),
                                        white_nickname: Some(nick_a.clone()),
                                        black_nickname: Some(nick_b.clone()),
                                        players: room_players,
                                        white_time_ms: 300000,
                                        black_time_ms: 300000,
                                        last_move_time: None,
                                        game_started: false,
                                        timeout_winner: None,
                                    };

                                    {
                                        let mut rooms = state.rooms.write().await;
                                        rooms.insert(room_id.clone(), new_room);
                                    }

                                    let match_a = serde_json::json!({
                                        "type": "ChallengeAccepted",
                                        "payload": {
                                            "game_id": room_id.clone(),
                                            "color": "white",
                                            "opponent_nickname": nick_b.clone(),
                                            "fen": DEFAULT_START_FEN,
                                            "white_time_ms": 300000,
                                            "black_time_ms": 300000,
                                            "game_started": false,
                                        }
                                    });
                                    let match_b = serde_json::json!({
                                        "type": "ChallengeAccepted",
                                        "payload": {
                                            "game_id": room_id.clone(),
                                            "color": "black",
                                            "opponent_nickname": nick_a.clone(),
                                            "fen": DEFAULT_START_FEN,
                                            "white_time_ms": 300000,
                                            "black_time_ms": 300000,
                                            "game_started": false,
                                        }
                                    });

                                    let _ = tx_a.send(Message::Text(match_a.to_string()));
                                    let _ = tx_b.send(Message::Text(match_b.to_string()));

                                    drop(players);
                                    broadcast_lobby_list(&state).await;
                                } else {
                                    let err_msg = serde_json::json!({
                                        "type": "Error",
                                        "payload": { "message": "O oponente saiu do saguão ou já está em jogo!" }
                                    });
                                    let _ = tx.send(Message::Text(err_msg.to_string()));
                                }
                            }
                            "QuitGame" => {
                                let game_id = payload
                                    .get("game_id")
                                    .and_then(|id| id.as_str())
                                    .unwrap_or("");
                                current_room_id = None;

                                let mut players = state.players.write().await;
                                let mut rooms = state.rooms.write().await;

                                if let Some(room) = rooms.remove(game_id) {
                                    let quitter_nick = room
                                        .players
                                        .get(&conn_id)
                                        .map(|x| x.nickname.as_str())
                                        .unwrap_or("Oponente");
                                    for p_conn in room.players.values() {
                                        if p_conn.id == conn_id {
                                            players.remove(&p_conn.id);
                                            let exit_notify = serde_json::json!({
                                                "type": "GameExited",
                                                "payload": {
                                                    "reason": "self_quit",
                                                    "by": quitter_nick
                                                }
                                            });
                                            let _ = p_conn
                                                .tx
                                                .send(Message::Text(exit_notify.to_string()));
                                        } else {
                                            if let Some(p) = players.get_mut(&p_conn.id) {
                                                p.status = "lobby".to_string();
                                                let exit_notify = serde_json::json!({
                                                    "type": "GameExited",
                                                    "payload": {
                                                        "reason": "opponent_quit",
                                                        "by": quitter_nick
                                                    }
                                                });
                                                let _ = p
                                                    .tx
                                                    .send(Message::Text(exit_notify.to_string()));
                                            }
                                        }
                                    }
                                }
                                drop(players);
                                drop(rooms);
                                broadcast_lobby_list(&state).await;
                            }
                            "MakeMove" => {
                                let room_id = payload
                                    .get("game_id")
                                    .and_then(|g| g.as_str())
                                    .unwrap_or("")
                                    .to_string();
                                let from =
                                    payload.get("from").and_then(|f| f.as_str()).unwrap_or("");
                                let to = payload.get("to").and_then(|t| t.as_str()).unwrap_or("");

                                let mut rooms = state.rooms.write().await;
                                if let Some(room) = rooms.get_mut(&room_id) {
                                    let fen: Fen = room.fen.parse().unwrap();
                                    let pos: Chess =
                                        fen.into_position(CastlingMode::Standard).unwrap();
                                    let expected_color = if pos.turn().is_white() {
                                        "white"
                                    } else {
                                        "black"
                                    };

                                    let player_color = room
                                        .players
                                        .get(&conn_id)
                                        .map(|p| p.color.as_str())
                                        .unwrap_or("spectator");

                                    if player_color == "spectator" {
                                        let _ = tx.send(Message::Text(serde_json::json!({
                                                "type": "Error",
                                                "payload": { "message": "Espectadores não podem mover peças!" }
                                            }).to_string()));
                                        continue;
                                    }

                                    if player_color != expected_color {
                                        let _ = tx.send(Message::Text(serde_json::json!({
                                                "type": "Error",
                                                "payload": { "message": "Não é o seu turno de jogar!" }
                                            }).to_string()));
                                        continue;
                                    }

                                    if room.timeout_winner.is_some() {
                                        let _ = tx.send(Message::Text(serde_json::json!({
                                                "type": "Error",
                                                "payload": { "message": "O tempo já esgotou nesta partida!" }
                                            }).to_string()));
                                        continue;
                                    }

                                    let now = get_current_time_ms();
                                    if room.game_started {
                                        if let Some(last_time) = room.last_move_time {
                                            let elapsed = now.saturating_sub(last_time);
                                            if expected_color == "white" {
                                                room.white_time_ms =
                                                    room.white_time_ms.saturating_sub(elapsed);
                                                if room.white_time_ms == 0 {
                                                    room.timeout_winner = Some("black".to_string());
                                                }
                                            } else {
                                                room.black_time_ms =
                                                    room.black_time_ms.saturating_sub(elapsed);
                                                if room.black_time_ms == 0 {
                                                    room.timeout_winner = Some("white".to_string());
                                                }
                                            }
                                        }
                                    } else {
                                        room.game_started = true;
                                    }
                                    room.last_move_time = Some(now);

                                    if let Some(winner) = &room.timeout_winner {
                                        let response = serde_json::json!({
                                            "type": "GameState",
                                            "payload": {
                                                "game_id": room_id,
                                                "fen": room.fen,
                                                "white_time_ms": room.white_time_ms,
                                                "black_time_ms": room.black_time_ms,
                                                "game_started": room.game_started,
                                                "timeout_winner": Some(winner.clone()),
                                            }
                                        });
                                        for player in room.players.values() {
                                            let _ =
                                                player.tx.send(Message::Text(response.to_string()));
                                        }
                                        continue;
                                    }

                                    match validate_and_play_move(&room.fen, from, to) {
                                        Ok(next_fen) => {
                                            room.fen = next_fen.clone();
                                            let response = serde_json::json!({
                                                "type": "MoveResponse",
                                                "payload": {
                                                    "game_id": room_id,
                                                    "fen": next_fen,
                                                    "success": true,
                                                    "white_time_ms": room.white_time_ms,
                                                    "black_time_ms": room.black_time_ms,
                                                    "game_started": room.game_started,
                                                    "timeout_winner": room.timeout_winner,
                                                }
                                            });
                                            for player in room.players.values() {
                                                let _ = player
                                                    .tx
                                                    .send(Message::Text(response.to_string()));
                                            }
                                        }
                                        Err(err_msg) => {
                                            let _ = tx.send(Message::Text(
                                                serde_json::json!({
                                                    "type": "Error",
                                                    "payload": { "message": err_msg }
                                                })
                                                .to_string(),
                                            ));
                                        }
                                    }
                                }
                            }
                            "ResetGame" => {
                                let room_id = payload
                                    .get("game_id")
                                    .and_then(|g| g.as_str())
                                    .unwrap_or("")
                                    .to_string();
                                let mut rooms = state.rooms.write().await;
                                if let Some(room) = rooms.get_mut(&room_id) {
                                    room.fen = DEFAULT_START_FEN.to_string();
                                    room.white_time_ms = 300_000;
                                    room.black_time_ms = 300_000;
                                    room.last_move_time = None;
                                    room.game_started = false;
                                    room.timeout_winner = None;

                                    let response = serde_json::json!({
                                        "type": "GameState",
                                        "payload": {
                                            "game_id": room_id,
                                            "fen": room.fen,
                                            "white_time_ms": room.white_time_ms,
                                            "black_time_ms": room.black_time_ms,
                                            "game_started": room.game_started,
                                            "timeout_winner": room.timeout_winner,
                                        }
                                    });
                                    for player in room.players.values() {
                                        let _ = player.tx.send(Message::Text(response.to_string()));
                                    }
                                }
                            }
                            "Timeout" => {
                                let room_id = payload
                                    .get("game_id")
                                    .and_then(|g| g.as_str())
                                    .unwrap_or("")
                                    .to_string();
                                let loser_color =
                                    payload.get("color").and_then(|c| c.as_str()).unwrap_or("");
                                let mut rooms = state.rooms.write().await;
                                if let Some(room) = rooms.get_mut(&room_id) {
                                    if room.timeout_winner.is_none() {
                                        let winner = if loser_color == "white" {
                                            "black"
                                        } else {
                                            "white"
                                        };
                                        room.timeout_winner = Some(winner.to_string());
                                        if loser_color == "white" {
                                            room.white_time_ms = 0;
                                        } else {
                                            room.black_time_ms = 0;
                                        }

                                        let response = serde_json::json!({
                                            "type": "GameState",
                                            "payload": {
                                                "game_id": room_id,
                                                "fen": room.fen,
                                                "white_time_ms": room.white_time_ms,
                                                "black_time_ms": room.black_time_ms,
                                                "game_started": room.game_started,
                                                "timeout_winner": room.timeout_winner,
                                            }
                                        });
                                        for player in room.players.values() {
                                            let _ =
                                                player.tx.send(Message::Text(response.to_string()));
                                        }
                                    }
                                }
                            }
                            _ => {
                                tracing::warn!("Tipo de mensagem desconhecido: {}", msg_type);
                            }
                        }
                    }
                }
                Message::Close(_) => {
                    tracing::info!("Conexão fechada pelo cliente");
                    break;
                }
                _ => {}
            },
            Err(e) => {
                tracing::error!("Erro na comunicação WebSocket: {}", e);
                break;
            }
        }
    }

    {
        let mut players = state.players.write().await;
        let mut rooms = state.rooms.write().await;

        players.remove(&conn_id);

        let mut room_to_remove: Option<String> = None;
        for (room_id, room) in rooms.iter() {
            if room.players.contains_key(&conn_id) {
                room_to_remove = Some(room_id.clone());
                break;
            }
        }

        if let Some(r_id) = room_to_remove {
            if let Some(room) = rooms.remove(&r_id) {
                for p_conn in room.players.values() {
                    if p_conn.id != conn_id {
                        if let Some(p) = players.get_mut(&p_conn.id) {
                            p.status = "lobby".to_string();
                            let opponent_left = serde_json::json!({
                                "type": "OpponentDisconnected",
                                "payload": {}
                            });
                            let _ = p.tx.send(Message::Text(opponent_left.to_string()));
                        }
                    }
                }
            }
        }

        drop(players);
        drop(rooms);
        broadcast_lobby_list(&state).await;
    }

    writer_task.abort();
    tracing::info!("Conexão WebSocket finalizada. ID: {}", conn_id);
}
