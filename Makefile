.PHONY: dev build down clean

dev:
	docker compose up -d --build

down:
	docker compose down

clean:
	docker compose down -v
	docker system prune -f
