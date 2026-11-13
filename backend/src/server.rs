use std::path::Path;

use axum::{
    extract::{State, WebSocketUpgrade},
    response::IntoResponse,
    routing::get,
    Router,
};
use tower_http::{
    services::{ServeDir, ServeFile},
    trace::TraceLayer,
};

use crate::{hub::Hub, session};

const MAX_FRAME_BYTES: usize = 16 * 1024;

pub fn router(hub: Hub, static_dir: Option<&Path>) -> Router {
    let router = Router::new()
        .route("/health", get(health))
        .route("/ws", get(upgrade))
        .with_state(hub);

    let router = match static_dir {
        Some(dir) => router
            .fallback_service(ServeDir::new(dir).fallback(ServeFile::new(dir.join("index.html")))),
        None => router,
    };
    router.layer(TraceLayer::new_for_http())
}

async fn health() -> &'static str {
    "ok"
}

async fn upgrade(ws: WebSocketUpgrade, State(hub): State<Hub>) -> impl IntoResponse {
    ws.max_message_size(MAX_FRAME_BYTES)
        .max_frame_size(MAX_FRAME_BYTES)
        .on_upgrade(move |socket| session::run(socket, hub))
}
