.PHONY: test test-race test-frontend lint coverage bench bench-matcher clean

test:
	go test ./backend/... -short -timeout 60s

test-race:
	go test ./backend/... -short -timeout 60s -race

test-frontend:
	cd frontend && npm ci && npx tsc --noEmit

lint:
	golangci-lint run ./backend/...

coverage:
	go test ./backend/... -short -timeout 60s -covermode=atomic \
		-coverprofile=coverage.out
	go tool cover -html=coverage.out -o coverage.html
	go tool cover -func=coverage.out

bench:
	go test ./backend/... -bench=. -benchmem -run='^$$' -timeout 120s

bench-matcher:
	go test ./backend/... -bench=BenchmarkLevenshtein -benchmem -run='^$$'

clean:
	rm -f coverage.out coverage.html
