package backend

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"
)

// =============================================================================
// Persistence (JSON)
// =============================================================================

// QueueState represents the serializable state of the queue
type QueueState struct {
	Items     []QueueItem `json:"items"`
	UpdatedAt time.Time   `json:"updatedAt"`
}

// GetQueueFilePath returns the path to the queue state file
func GetQueueFilePath() string {
	return filepath.Join(GetDataPath(), "queue.json")
}

// SaveQueue persists the queue to disk
func (q *Queue) SaveQueue() error {
	q.mutex.RLock()
	defer q.mutex.RUnlock()

	state := QueueState{
		Items:     q.items,
		UpdatedAt: time.Now(),
	}

	data, err := json.MarshalIndent(state, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal queue: %w", err)
	}

	queuePath := GetQueueFilePath()
	if err := os.MkdirAll(filepath.Dir(queuePath), 0755); err != nil {
		return fmt.Errorf("failed to create queue directory: %w", err)
	}

	if err := os.WriteFile(queuePath, data, 0644); err != nil {
		return fmt.Errorf("failed to write queue file: %w", err)
	}

	return nil
}

// LoadQueue loads the queue from disk
func (q *Queue) LoadQueue() error {
	queuePath := GetQueueFilePath()

	data, err := os.ReadFile(queuePath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil // No queue file, start fresh
		}
		return fmt.Errorf("failed to read queue file: %w", err)
	}

	var state QueueState
	if err := json.Unmarshal(data, &state); err != nil {
		return fmt.Errorf("failed to unmarshal queue: %w", err)
	}

	q.mutex.Lock()
	defer q.mutex.Unlock()

	// Reset in-progress items to pending (they were interrupted)
	for i := range state.Items {
		switch state.Items[i].Status {
		case StatusFetchingInfo, StatusDownloadingVideo, StatusDownloadingAudio, StatusMuxing, StatusOrganizing:
			state.Items[i].Status = StatusPending
			state.Items[i].Progress = 0
			state.Items[i].Stage = "Waiting... (resumed)"
		}
	}

	q.items = state.Items
	return nil
}

// AutoSave starts periodic auto-saving of the queue
func (q *Queue) AutoSave(interval time.Duration) {
	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		for {
			select {
			case <-q.ctx.Done():
				// Final save on shutdown
				q.SaveQueue()
				return
			case <-ticker.C:
				q.SaveQueue()
			}
		}
	}()
}

// =============================================================================
// Helper Functions
// =============================================================================

// copyFile copies a file from src to dst
func copyFile(src, dst string) error {
	sourceFile, err := os.Open(src)
	if err != nil {
		return err
	}
	defer sourceFile.Close()

	// Ensure destination directory exists
	if err := os.MkdirAll(filepath.Dir(dst), 0755); err != nil {
		return err
	}

	destFile, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer destFile.Close()

	if _, err := io.Copy(destFile, sourceFile); err != nil {
		return err
	}

	return destFile.Sync()
}

// =============================================================================
// Queue Statistics
// =============================================================================

// QueueStats provides statistics about the queue
type QueueStats struct {
	Total     int `json:"total"`
	Pending   int `json:"pending"`
	Active    int `json:"active"`
	Completed int `json:"completed"`
	Failed    int `json:"failed"`
	Cancelled int `json:"cancelled"`
}

// GetStats returns queue statistics
func (q *Queue) GetStats() QueueStats {
	q.mutex.RLock()
	defer q.mutex.RUnlock()

	stats := QueueStats{
		Total: len(q.items),
	}

	for _, item := range q.items {
		switch item.Status {
		case StatusPending:
			stats.Pending++
		case StatusFetchingInfo, StatusDownloadingVideo, StatusDownloadingAudio, StatusMuxing, StatusOrganizing:
			stats.Active++
		case StatusComplete:
			stats.Completed++
		case StatusError:
			stats.Failed++
		case StatusCancelled:
			stats.Cancelled++
		}
	}

	return stats
}
