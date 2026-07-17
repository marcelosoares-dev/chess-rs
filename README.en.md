# 👑 chess-rs | Real-Time Multiplayer Chess

<p align="center">
  <a href="README.md"><img src="https://img.shields.io/badge/Português-🇧🇷-grey?style=for-the-badge" alt="Português"/></a>
  <a href="README.en.md"><img src="https://img.shields.io/badge/English-🇺🇸-3178c6?style=for-the-badge" alt="English"/></a>
</p>

[![Backend CI (Rust)](https://github.com/marcelosoares-dev/chess-rs/actions/workflows/ci.yml/badge.svg)](https://github.com/marcelosoares-dev/chess-rs/actions/workflows/ci.yml)
[![Frontend CI (React/TS)](https://github.com/marcelosoares-dev/chess-rs/actions/workflows/ci.yml/badge.svg)](https://github.com/marcelosoares-dev/chess-rs/actions/workflows/ci.yml)

This is a real-time multiplayer chess project built with a focus on high performance, safe concurrency, and robust systems architecture. The backend is developed entirely in **Rust (using Axum)**, while the frontend utilizes **React with TypeScript and TailwindCSS v4**.

The application was designed to showcase best practices in concurrent programming in Rust, serving as an excellent study reference for developers looking to deepen their knowledge in the asynchronous Rust ecosystem.

---

## 🚀 How to Run the Project Locally

The project is fully containerized using **Docker** and **Docker Compose**. Environment management is simplified through a `Makefile` at the root directory.

### Prerequisites
Make sure you have installed on your machine:
- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)
- [Make](https://www.gnu.org/software/make/) (optional, but recommended)

### Quick Start

1. **Start the services (Backend + Frontend)**:
   ```bash
   make dev
   ```
   *This will compile the Rust backend inside the container and start the Vite development server.*

2. **Access the Application**:
   - Open your browser at: [http://localhost:5173](http://localhost:5173)
   - The backend runs on port `8080` (WebSocket at `ws://localhost:8080/ws`).

3. **Stop the containers**:
   ```bash
   make down
   ```

4. **Clean Docker caches and volumes**:
   ```bash
   make clean
   ```

---

## 🏗️ System Architecture

```
  ┌─────────────────────────────────────────────────────────┐
  │                        FRONTEND                         │
  │            React + TypeScript + Tailwind v4             │
  └────────────────────────────┬────────────────────────────┘
                               │
                               │ WebSocket Connection (Real-Time)
                               ▼
  ┌─────────────────────────────────────────────────────────┐
  │                        BACKEND                          │
  │                     Rust (Axum WS)                      │
  ├────────────────────────────┼────────────────────────────┤
  │        GLOBAL STATE        │        CHESS ENGINE        │
  │   Arc<RwLock<AppState>>    │          Shakmaty          │
  └────────────────────────────┴────────────────────────────┘
```

### Backend (Rust)
The server acts as an asynchronous central hub for players in the lobby.
- **Axum**: Used to manage the HTTP transport layer and upgrade protocols to WebSockets (`axum::extract::ws`).
- **Tokio**: The asynchronous runtime that drives concurrent execution.
- **Shakmaty**: A rigorous mathematical chess library in Rust for move validation, game states (check, checkmate, draws, etc.), and FEN (Forsyth-Edwards Notation) parsing.
- **State Management**: Global structures protected by concurrency smart pointers (`Arc<RwLock<T>>`) to allow parallel connections to read and modify game rooms in a thread-safe manner.

### Frontend (React/TypeScript)
- Responsive dark-themed UI.
- **react-chessboard**: Board rendering and drag-and-drop support.
- **chess.js**: Semicent/visual move validation and synchronization client-side.
- **Framer Motion**: Smooth micro-animations and screen transitions.

---

## 🦀 Rust Technical Deep Dive (For Study Reference)

If you are studying Rust, pay attention to how these fundamental concepts are applied in the `/backend` folder:

### 1. Concurrent State with `Arc<RwLock>`
To share players and rooms states among all asynchronous WebSocket connections, we use:
```rust
#[derive(Clone)]
struct AppState {
    players: Arc<RwLock<HashMap<String, LobbyPlayer>>>,
    rooms: Arc<RwLock<HashMap<String, Room>>>,
}
```
This guarantees fast, concurrent asynchronous reads, locking for writes only when a player takes a move or joins/leaves the lobby.

### 2. Strongly Typed WebSocket Messages
We leverage Rust's powerful `enum`s in combination with `serde` to deserialize incoming payloads safely. If the frontend sends an invalid payload, Rust rejects it immediately at deserialization time:
```rust
#[derive(Deserialize)]
#[serde(tag = "type")]
enum ClientMessage {
    ClaimNickname { nickname: String },
    SendChallenge { to_nickname: String },
    AcceptChallenge { challenger_nickname: String },
    DeclineChallenge { challenger_nickname: String },
    MakeMove { room_id: String, from: String, to: String, promotion: Option<String> },
    QuitGame { room_id: String },
}
```

### 3. Integration with Shakmaty (Rules Engine)
All chess logic and rules are not rewritten from scratch but validated using the `shakmaty` library, which guarantees absolute mathematical correctness:
```rust
// Legitimate moves validation on backend
let mut chess = shakmaty::Chess::from_setup(setup, shakmaty::CastlingMode::Standard)
    .map_err(|_| "Invalid setup")?;

let legal_moves = chess.legals();
// Execute the move if it belongs to the set of legal moves
```

---

## 🛠️ Contributing to the Project

Contributions are extremely welcome! This project features strict Continuous Integration (CI) workflows via **GitHub Actions** to ensure quality for every pull request.

### How to Contribute:

1. Fork the repository.
2. Create your feature branch: `git checkout -b feature/my-feature`.
3. Ensure your code passes local lints and tests:
   - **Backend**:
     ```bash
     cd backend
     cargo fmt --check
     cargo clippy --all-targets -- -D warnings
     cargo test
     ```
   - **Frontend**:
     ```bash
     cd frontend
     npm run lint
     npm run build
     ```
4. Commit your changes: `git commit -m "feat: add some cool feature"` (following the [Conventional Commits](https://www.conventionalcommits.org/) format).
5. Push to the branch: `git push origin feature/my-feature`.
6. Open a detailed Pull Request describing your implementation.

---

## 👨‍💻 Author

Developed by **Marcelo Soares**.  
Feel free to reach out or connect on LinkedIn:  
[![LinkedIn](https://img.shields.io/badge/LinkedIn-Marcelo%20Soares-blue?style=flat&logo=linkedin)](https://www.linkedin.com/in/marcelosoares-dev/)
