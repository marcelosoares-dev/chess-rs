FROM rust:1-slim-bookworm
RUN cargo install --locked cargo-watch
WORKDIR /app
EXPOSE 8080
CMD ["cargo", "watch", "-x", "run"]
