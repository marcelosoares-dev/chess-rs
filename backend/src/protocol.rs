use std::{fmt, str::FromStr};

use serde::{de, Deserialize, Deserializer, Serialize, Serializer};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct ConnId(pub u64);

impl fmt::Display for ConnId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        self.0.fmt(f)
    }
}

impl Serialize for ConnId {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.collect_str(self)
    }
}

impl<'de> Deserialize<'de> for ConnId {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let raw = String::deserialize(deserializer)?;
        u64::from_str(&raw).map(Self).map_err(de::Error::custom)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct GameId(pub String);

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Side {
    White,
    Black,
}

impl Side {
    pub const fn opposite(self) -> Self {
        match self {
            Self::White => Self::Black,
            Self::Black => Self::White,
        }
    }

    pub const fn index(self) -> usize {
        match self {
            Self::White => 0,
            Self::Black => 1,
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type", content = "payload")]
pub enum ClientMessage {
    Ping,
    ClaimNickname {
        nickname: String,
    },
    ChatMessage {
        message: String,
    },
    SendChallenge {
        target_nickname: String,
    },
    AcceptChallenge {
        from_conn_id: ConnId,
    },
    DeclineChallenge {
        from_conn_id: ConnId,
    },
    MakeMove {
        game_id: GameId,
        from: String,
        to: String,
        #[serde(default)]
        promotion: Option<char>,
    },
    ResetGame {
        game_id: GameId,
    },
    QuitGame {
        game_id: GameId,
    },
}

#[derive(Debug, Clone, Serialize)]
pub struct GameSnapshot {
    pub game_id: GameId,
    pub fen: String,
    pub white_time_ms: u64,
    pub black_time_ms: u64,
    pub game_started: bool,
    pub timeout_winner: Option<Side>,
}

#[derive(Debug, Clone, Serialize)]
pub struct LobbyEntry {
    pub conn_id: ConnId,
    pub nickname: String,
}

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ExitReason {
    SelfQuit,
    OpponentQuit,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", content = "payload")]
pub enum ServerMessage {
    ConnectionEstablished {
        conn_id: ConnId,
    },
    Pong {},
    NicknameAccepted {
        nickname: String,
    },
    NicknameRejected {
        message: String,
    },
    LobbyUpdate {
        players: Vec<LobbyEntry>,
    },
    ChallengeReceived {
        from_conn_id: ConnId,
        from_nickname: String,
    },
    ChallengeDeclined {
        from_nickname: String,
    },
    ChallengeAccepted {
        color: Side,
        opponent_nickname: String,
        #[serde(flatten)]
        state: GameSnapshot,
    },
    GameState(GameSnapshot),
    MoveResponse {
        success: bool,
        #[serde(flatten)]
        state: GameSnapshot,
    },
    GameExited {
        reason: ExitReason,
        by: String,
    },
    OpponentDisconnected {},
    ChatMessageEcho {
        sender: String,
        message: String,
    },
    Error {
        message: String,
    },
}

impl ServerMessage {
    pub fn error(message: impl Into<String>) -> Self {
        Self::Error {
            message: message.into(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn decodes_move_with_optional_promotion() {
        let raw = json!({
            "type": "MakeMove",
            "payload": { "game_id": "match_1", "from": "e7", "to": "e8" }
        });
        let message: ClientMessage = serde_json::from_value(raw).unwrap();
        assert!(matches!(
            message,
            ClientMessage::MakeMove {
                promotion: None,
                ..
            }
        ));
    }

    #[test]
    fn decodes_connection_ids_from_strings() {
        let raw = json!({ "type": "AcceptChallenge", "payload": { "from_conn_id": "42" } });
        let message: ClientMessage = serde_json::from_value(raw).unwrap();
        assert!(matches!(
            message,
            ClientMessage::AcceptChallenge {
                from_conn_id: ConnId(42)
            }
        ));
    }

    #[test]
    fn decodes_ping_without_payload() {
        let message: ClientMessage = serde_json::from_value(json!({ "type": "Ping" })).unwrap();
        assert!(matches!(message, ClientMessage::Ping));
    }

    #[test]
    fn rejects_unknown_message_types() {
        assert!(serde_json::from_value::<ClientMessage>(json!({ "type": "Nope" })).is_err());
    }

    #[test]
    fn flattens_snapshot_into_the_payload() {
        let message = ServerMessage::MoveResponse {
            success: true,
            state: GameSnapshot {
                game_id: GameId("match_1".into()),
                fen: "8/8/8/8/8/8/8/8 w - - 0 1".into(),
                white_time_ms: 1,
                black_time_ms: 2,
                game_started: true,
                timeout_winner: Some(Side::Black),
            },
        };
        let encoded = serde_json::to_value(message).unwrap();
        assert_eq!(encoded["type"], "MoveResponse");
        assert_eq!(encoded["payload"]["success"], true);
        assert_eq!(encoded["payload"]["game_id"], "match_1");
        assert_eq!(encoded["payload"]["timeout_winner"], "black");
    }

    #[test]
    fn serializes_connection_ids_as_strings() {
        let encoded = serde_json::to_value(LobbyEntry {
            conn_id: ConnId(7),
            nickname: "ana".into(),
        })
        .unwrap();
        assert_eq!(encoded["conn_id"], "7");
    }
}
