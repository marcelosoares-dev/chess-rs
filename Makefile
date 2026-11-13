.PHONY: up down dev check clean

up:
	docker compose up --build -d

down:
	docker compose down

dev:
	docker compose -f docker-compose.dev.yml up --build

check:
	cargo fmt --manifest-path backend/Cargo.toml --check
	cargo clippy --manifest-path backend/Cargo.toml --all-targets -- -D warnings
	cargo test --manifest-path backend/Cargo.toml
	npm --prefix frontend run lint
	npm --prefix frontend run build

clean:
	docker compose down -v --remove-orphans
