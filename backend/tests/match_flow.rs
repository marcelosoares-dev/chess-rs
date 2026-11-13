use std::time::Duration;

use chess_backend::{hub::Hub, server};
use futures_util::{SinkExt, StreamExt};
use serde_json::{json, Value};
use tokio::{net::TcpStream, time::timeout};
use tokio_tungstenite::{connect_async, tungstenite::Message, MaybeTlsStream, WebSocketStream};

type Client = WebSocketStream<MaybeTlsStream<TcpStream>>;

async fn spawn_server() -> String {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    let app = server::router(Hub::spawn(), None);
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    format!("ws://{addr}/ws")
}

async fn connect(url: &str) -> Client {
    let (mut client, _) = connect_async(url).await.unwrap();
    expect(&mut client, "ConnectionEstablished").await;
    client
}

async fn send(client: &mut Client, kind: &str, payload: Value) {
    let frame = json!({ "type": kind, "payload": payload }).to_string();
    client.send(Message::Text(frame)).await.unwrap();
}

async fn expect(client: &mut Client, kind: &str) -> Value {
    loop {
        let frame = timeout(Duration::from_secs(5), client.next())
            .await
            .unwrap_or_else(|_| panic!("timeout aguardando {kind}"))
            .unwrap()
            .unwrap();
        let Message::Text(text) = frame else { continue };
        let message: Value = serde_json::from_str(&text).unwrap();
        if message["type"] == kind {
            return message["payload"].clone();
        }
    }
}

async fn join_lobby(url: &str, nickname: &str) -> (Client, String) {
    let mut client = connect(url).await;
    send(
        &mut client,
        "ClaimNickname",
        json!({ "nickname": nickname }),
    )
    .await;
    expect(&mut client, "NicknameAccepted").await;
    let lobby = expect(&mut client, "LobbyUpdate").await;
    let id = lobby["players"]
        .as_array()
        .unwrap()
        .iter()
        .find(|entry| entry["nickname"] == nickname)
        .unwrap()["conn_id"]
        .as_str()
        .unwrap()
        .to_owned();
    (client, id)
}

async fn start_match(url: &str) -> (Client, Client, String) {
    let (mut ana, ana_id) = join_lobby(url, "ana").await;
    let (mut bia, _) = join_lobby(url, "bia").await;

    send(
        &mut bia,
        "SendChallenge",
        json!({ "target_nickname": "ana" }),
    )
    .await;
    let challenge = expect(&mut ana, "ChallengeReceived").await;
    assert_eq!(challenge["from_nickname"], "bia");
    let bia_id = challenge["from_conn_id"].as_str().unwrap().to_owned();
    assert_ne!(bia_id, ana_id);

    send(
        &mut ana,
        "AcceptChallenge",
        json!({ "from_conn_id": bia_id }),
    )
    .await;
    let for_ana = expect(&mut ana, "ChallengeAccepted").await;
    let for_bia = expect(&mut bia, "ChallengeAccepted").await;
    assert_eq!(for_ana["color"], "black");
    assert_eq!(for_bia["color"], "white");
    assert_eq!(for_bia["game_started"], false);

    let game_id = for_bia["game_id"].as_str().unwrap().to_owned();
    (bia, ana, game_id)
}

#[tokio::test]
async fn duplicate_nicknames_are_rejected_case_insensitively() {
    let url = spawn_server().await;
    let (_first, _) = join_lobby(&url, "Marcelo").await;

    let mut second = connect(&url).await;
    send(
        &mut second,
        "ClaimNickname",
        json!({ "nickname": "marcelo" }),
    )
    .await;
    expect(&mut second, "NicknameRejected").await;
}

#[tokio::test]
async fn moves_are_validated_and_broadcast_to_both_players() {
    let url = spawn_server().await;
    let (mut white, mut black, game_id) = start_match(&url).await;

    send(
        &mut black,
        "MakeMove",
        json!({ "game_id": game_id, "from": "e7", "to": "e5" }),
    )
    .await;
    let refusal = expect(&mut black, "Error").await;
    assert_eq!(refusal["message"], "Não é o seu turno de jogar!");

    send(
        &mut white,
        "MakeMove",
        json!({ "game_id": game_id, "from": "e2", "to": "e4" }),
    )
    .await;
    for client in [&mut white, &mut black] {
        let update = expect(client, "MoveResponse").await;
        assert_eq!(update["success"], true);
        assert_eq!(update["game_started"], true);
        assert!(update["fen"]
            .as_str()
            .unwrap()
            .starts_with("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b"));
    }
}

#[tokio::test]
async fn abrupt_disconnect_returns_the_opponent_to_the_lobby() {
    let url = spawn_server().await;
    let (white, mut black, _) = start_match(&url).await;

    drop(white);
    expect(&mut black, "OpponentDisconnected").await;
    let lobby = expect(&mut black, "LobbyUpdate").await;
    let nicknames: Vec<&str> = lobby["players"]
        .as_array()
        .unwrap()
        .iter()
        .map(|entry| entry["nickname"].as_str().unwrap())
        .collect();
    assert_eq!(nicknames, ["ana"]);
}

#[tokio::test]
async fn quitting_releases_the_nickname_and_notifies_the_opponent() {
    let url = spawn_server().await;
    let (mut white, mut black, game_id) = start_match(&url).await;

    send(&mut white, "QuitGame", json!({ "game_id": game_id })).await;
    assert_eq!(
        expect(&mut white, "GameExited").await["reason"],
        "self_quit"
    );
    assert_eq!(
        expect(&mut black, "GameExited").await["reason"],
        "opponent_quit"
    );

    send(&mut white, "ClaimNickname", json!({ "nickname": "bia" })).await;
    expect(&mut white, "NicknameAccepted").await;
}
