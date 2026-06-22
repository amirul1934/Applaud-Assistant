.PHONY: help up down build logs sync-dev processing-dev web-dev fmt

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

up: ## Start the full stack (docker compose)
	docker compose up --build

up-ollama: ## Start the stack including the optional local Ollama runtime
	docker compose --profile ollama up --build

down: ## Stop the stack
	docker compose down

logs: ## Tail logs for all services
	docker compose logs -f

sync-dev: ## Run the TypeScript sync service locally
	cd services/sync && pnpm install && pnpm dev

processing-dev: ## Run the Python processing service locally
	cd services/processing && pip install -r requirements.txt && uvicorn app.main:app --reload --port 8000

web-dev: ## Run the web UI locally
	cd services/web && pnpm install && pnpm dev
