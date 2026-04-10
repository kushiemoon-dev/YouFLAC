package api

import (
	"context"
	"encoding/json"
	"io"
	"net/http/httptest"
	"testing"

	core "github.com/kushiemoon-dev/youflac-core"
)

func TestHandleGetItemLogs_ReturnsBuffered(t *testing.T) {
	core.InitLogger("debug")
	q := core.NewQueue(context.Background(), 1)
	s := NewServer(core.GetDefaultConfig(), q, nil, nil)

	core.RegisterItemLogger("item-x")
	defer core.UnregisterItemLogger("item-x")
	// Simulate a captured log entry via the handler path.
	ctx := core.WithItemID(context.Background(), "item-x")
	core.Logger.InfoContext(ctx, "hello")

	req := httptest.NewRequest("GET", "/api/queue/item-x/logs", nil)
	resp, err := s.app.Test(req)
	if err != nil {
		t.Fatalf("Test: %v", err)
	}
	if resp.StatusCode != 200 {
		t.Fatalf("status = %d", resp.StatusCode)
	}
	body, _ := io.ReadAll(resp.Body)
	var entries []core.LogEntry
	if err := json.Unmarshal(body, &entries); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if len(entries) == 0 {
		t.Fatal("expected at least one entry")
	}
}
