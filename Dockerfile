# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS web
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY frontend/ ./
RUN npm run build

FROM rust:1-slim-bookworm AS chef
RUN cargo install --locked cargo-chef
WORKDIR /app

FROM chef AS planner
COPY backend/ ./
RUN cargo chef prepare --recipe-path recipe.json

FROM chef AS builder
COPY --from=planner /app/recipe.json recipe.json
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    cargo chef cook --release --locked --recipe-path recipe.json
COPY backend/ ./
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    cargo build --release --locked --bin chess-backend

FROM gcr.io/distroless/cc-debian12:nonroot AS runtime
COPY --from=builder /app/target/release/chess-backend /usr/local/bin/chess-backend
COPY --from=web /web/dist /srv/www
ENV BIND_ADDR=0.0.0.0:8080 \
    STATIC_DIR=/srv/www \
    RUST_LOG=info
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
    CMD ["/usr/local/bin/chess-backend", "healthcheck"]
ENTRYPOINT ["/usr/local/bin/chess-backend"]
