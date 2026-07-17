FROM rust:1.85-slim

WORKDIR /app

RUN cargo install --locked cargo-watch

COPY Cargo.toml ./
RUN mkdir src && echo "fn main() {}" > src/main.rs && cargo build

COPY . .

EXPOSE 8080

CMD ["cargo", "watch", "-x", "run"]
