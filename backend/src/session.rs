use std::{sync::Arc, time::Duration};

use axum::extract::ws::{Message, WebSocket};
use futures_util::{
    stream::{SplitSink, SplitStream},
    SinkExt, StreamExt,
};
use tokio::{
    sync::mpsc,
    time::{interval_at, timeout, Instant},
};

use crate::{
    hub::{Command, Hub},
    protocol::{ClientMessage, ConnId},
};

const OUTBOX_CAPACITY: usize = 64;
const HEARTBEAT: Duration = Duration::from_secs(15);
const IDLE_TIMEOUT: Duration = Duration::from_secs(45);

pub async fn run(socket: WebSocket, hub: Hub) {
    let id = hub.allocate_id();
    let (outbox, frames) = mpsc::channel(OUTBOX_CAPACITY);
    let (sink, stream) = socket.split();
    let mut writer = tokio::spawn(write_frames(sink, frames));

    if hub.dispatch(Command::Connect { id, outbox }).await {
        tokio::select! {
            () = read_frames(stream, id, &hub) => {}
            _ = &mut writer => {}
        }
        hub.dispatch(Command::Disconnect { id }).await;
    }
    writer.abort();
}

async fn write_frames(
    mut sink: SplitSink<WebSocket, Message>,
    mut frames: mpsc::Receiver<Arc<str>>,
) {
    let mut heartbeat = interval_at(Instant::now() + HEARTBEAT, HEARTBEAT);

    loop {
        let message = tokio::select! {
            frame = frames.recv() => match frame {
                Some(frame) => Message::Text(frame.to_string()),
                None => break,
            },
            _ = heartbeat.tick() => Message::Ping(Vec::new()),
        };
        if sink.send(message).await.is_err() {
            break;
        }
    }
}

async fn read_frames(mut stream: SplitStream<WebSocket>, id: ConnId, hub: &Hub) {
    loop {
        let Ok(Some(Ok(frame))) = timeout(IDLE_TIMEOUT, stream.next()).await else {
            break;
        };

        match frame {
            Message::Text(text) => match serde_json::from_str::<ClientMessage>(&text) {
                Ok(message) => {
                    if !hub.dispatch(Command::Inbound { id, message }).await {
                        break;
                    }
                }
                Err(error) => tracing::debug!(%id, %error, "quadro descartado"),
            },
            Message::Close(_) => break,
            _ => {}
        }
    }
}
