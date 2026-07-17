# 👑 chess-rs | Xadrez Multiplayer em Tempo Real

<p align="center">
  <a href="README.md"><img src="https://img.shields.io/badge/Português-🇧🇷-3178c6?style=for-the-badge" alt="Português"/></a>
  <a href="README.en.md"><img src="https://img.shields.io/badge/English-🇺🇸-grey?style=for-the-badge" alt="English"/></a>
</p>

[![Backend CI (Rust)](https://github.com/marcelosoares-dev/chess-rs/actions/workflows/ci.yml/badge.svg)](https://github.com/marcelosoares-dev/chess-rs/actions/workflows/ci.yml)
[![Frontend CI (React/TS)](https://github.com/marcelosoares-dev/chess-rs/actions/workflows/ci.yml/badge.svg)](https://github.com/marcelosoares-dev/chess-rs/actions/workflows/ci.yml)

Este é um projeto de xadrez multiplayer em tempo real, construído com foco em alta performance, concorrência segura e arquitetura de sistemas robusta. O backend é desenvolvido inteiramente em **Rust (com a biblioteca Axum)** e o frontend utiliza **React com TypeScript e TailwindCSS v4**.

A aplicação foi projetada para demonstrar boas práticas de programação concorrente em Rust, servindo como uma excelente referência de estudos para desenvolvedores que buscam aprofundar seus conhecimentos no ecossistema Rust assíncrono.

---

## 🚀 Como Executar o Projeto Localmente

O projeto está totalmente conteinerizado utilizando o **Docker** e o **Docker Compose**. O gerenciamento do ambiente é feito através de um `Makefile` na raiz.

### Pré-requisitos
Certifique-se de ter instalado em sua máquina:
- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)
- [Make](https://www.gnu.org/software/make/) (opcional, mas recomendado)

### Inicialização Rápida

1. **Subir os serviços (Backend + Frontend)**:
   ```bash
   make dev
   ```
   *Isso compilará o backend em Rust dentro do contêiner e iniciará o servidor de desenvolvimento do Vite.*

2. **Acessar a Aplicação**:
   - Abra o navegador em: [http://localhost:5173](http://localhost:5173)
   - O backend rodará na porta `8080` (WebSocket em `ws://localhost:8080/ws`).

3. **Parar os contêineres**:
   ```bash
   make down
   ```

4. **Limpar caches e volumes do Docker**:
   ```bash
   make clean
   ```

---

## 🏗️ Arquitetura do Sistema

```
  ┌─────────────────────────────────────────────────────────┐
  │                        FRONTEND                         │
  │            React + TypeScript + Tailwind v4             │
  └────────────────────────────┬────────────────────────────┘
                               │
                               │ Conexão WebSocket (Tempo Real)
                               ▼
  ┌─────────────────────────────────────────────────────────┐
  │                        BACKEND                          │
  │                     Rust (Axum WS)                      │
  ├────────────────────────────┼────────────────────────────┤
  │      ESTADO GLOBAL         │     MOTOR DE XADREZ        │
  │   Arc<RwLock<AppState>>    │        Shakmaty            │
  └────────────────────────────┴────────────────────────────┘
```

### Backend (Rust)
O servidor atua como um hub central assíncrono para os jogadores do saguão.
- **Axum**: Utilizado para gerenciar a camada de transporte HTTP e atualização de protocolo para WebSockets (`axum::extract::ws`).
- **Tokio**: O runtime assíncrono que impulsiona a execução concorrente.
- **Shakmaty**: Biblioteca matemática rigorosa em Rust para validação de movimentos, estados de jogo (xeque, xeque-mate, empates, etc.) e parse de FEN (Forsyth-Edwards Notation).
- **Gerenciamento de Estado**: Estruturas globais protegidas por ponteiros inteligentes de concorrência (`Arc<RwLock<T>>`) para permitir que conexões paralelas leiam e modifiquem salas de jogos de forma thread-safe.

### Frontend (React/TypeScript)
- Interface responsiva com design moderno e tema escuro.
- **react-chessboard**: Renderização do tabuleiro e suporte a drag-and-drop de peças.
- **chess.js**: Sincronização e animação do fluxo de movimentos no lado do cliente.
- **Framer Motion**: Micro-animações e transições de tela suaves.

---

## 🦀 Mergulho Técnico em Rust (Foco em Estudos)

Se você está estudando Rust, preste atenção em como estes conceitos fundamentais são aplicados na pasta `/backend`:

### 1. Estado Concorrente com `Arc<RwLock>`
Para compartilhar o estado dos jogadores e das salas de jogos entre todas as conexões assíncronas do WebSocket, utilizamos:
```rust
#[derive(Clone)]
struct AppState {
    players: Arc<RwLock<HashMap<String, LobbyPlayer>>>,
    rooms: Arc<RwLock<HashMap<String, Room>>>,
}
```
Isso garante leituras assíncronas concorrentes de forma ultra-rápida, bloqueando a escrita apenas quando um jogador realiza um movimento ou entra/sai do saguão.

### 2. Mensagens WebSocket Fortemente Tipadas
Usamos as poderosas `enum`s do Rust em conjunto com o `serde` para deserializar mensagens de forma segura. Se o frontend enviar uma mensagem inválida, o Rust a rejeitará imediatamente em tempo de compilação/deserialização:
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

### 3. Integração com Shakmaty (Motor de Regras)
Toda a lógica e regras do xadrez não são recriadas manualmente, mas validadas com a biblioteca `shakmaty` que garante corretude teórica matemática:
```rust
// Validação de movimentos legítimos no backend
let mut chess = shakmaty::Chess::from_setup(setup, shakmaty::CastlingMode::Standard)
    .map_err(|_| "Configuração inválida")?;

let legal_moves = chess.legals();
// Executa o movimento se ele pertencer ao conjunto de movimentos legítimos
```

---

## 🛠️ Contribuindo com o Projeto

Contribuições são extremamente bem-vindas! Este projeto possui automações rigorosas de Integração Contínua (CI) via **GitHub Actions** para garantir a qualidade de cada alteração.

### Como Contribuir:

1. Faça um Fork do repositório.
2. Crie uma branch com sua feature: `git checkout -b feature/minha-feature`.
3. Garanta que seu código passa nas validações locais de estilo e testes:
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
4. Faça commit de suas alterações: `git commit -m "feat: adiciona nova funcionalidade"` (siga o padrão [Conventional Commits](https://www.conventionalcommits.org/)).
5. Envie para sua branch: `git push origin feature/minha-feature`.
6. Abra um Pull Request detalhado descrevendo sua implementação.

---

## 👨‍💻 Autor

Desenvolvido por **Marcelo Soares**.  
Fique à vontade para se conectar comigo no LinkedIn:  
[![LinkedIn](https://img.shields.io/badge/LinkedIn-Marcelo%20Soares-blue?style=flat&logo=linkedin)](https://www.linkedin.com/in/marcelosoares-dev/)
