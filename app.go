package main

import (
	"context"
	"log"
	"os"

	core "github.com/kushiemoon-dev/youflac-core/v4"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App is the Wails-bound application struct. Its methods (defined across
// app_*.go, mirroring internal/api/handlers_*.go) are exposed to the
// frontend via Wails' Bind mechanism.
type App struct {
	ctx context.Context

	config    *core.Config
	queue     *core.Queue
	history   *core.History
	fileIndex *core.FileIndex

	sourceMgr    *core.SourceManager
	orchestrator *core.DownloadOrchestrator
	registry     *core.ChannelJobRegistry
}

func NewApp() *App {
	return &App{}
}

// startup mirrors cmd/server/main.go's initialization sequence, minus
// anything Fiber/HTTP-specific (no server.NewServer, no Listen). Queue
// progress is pushed to the frontend via runtime.EventsEmit instead of a
// WebSocket broadcast.
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	config, err := core.LoadConfigWithEnv()
	if err != nil {
		log.Printf("Warning: Could not load config: %v, using defaults", err)
		config = core.GetDefaultConfig()
	}
	core.InitLogger(config.LogLevel)
	core.SetCookiesBrowser(config.CookiesBrowser)

	outputDir := config.OutputDirectory
	if outputDir == "" {
		outputDir = core.GetDefaultOutputDirectory()
	}
	if err := os.MkdirAll(outputDir, 0755); err != nil {
		log.Printf("Warning: Could not create output directory: %v", err)
	}

	a.queue = core.NewQueue(ctx, config.ConcurrentDownloads)
	a.history = core.NewHistory()

	dataPath := core.GetDataPathWithEnv()
	a.fileIndex = core.NewFileIndex(dataPath)
	go func() {
		if err := a.fileIndex.ScanDirectory(outputDir); err != nil {
			log.Printf("Warning: Could not scan output directory: %v", err)
		}
	}()

	db, dbErr := core.NewDatabase()
	if dbErr != nil {
		log.Printf("Warning: database init failed, ISRC cache disabled: %v", dbErr)
	}
	a.sourceMgr = core.NewSourceManager()
	core.RegisterAllSources(config, a.sourceMgr, db)
	orchestratorLog := core.NewLogBuffer(500)
	a.orchestrator = core.NewDownloadOrchestrator(a.sourceMgr, config.SourceOrder, orchestratorLog)
	a.orchestrator.SetDatabase(db)
	if config.VerifyDownloads {
		a.orchestrator.SetVerifyPolicy(&core.VerifyPolicy{
			MinSampleRate: config.VerifyMinSampleRate,
			MinBitDepth:   config.VerifyMinBitDepth,
		})
	}
	a.queue.SetOrchestrator(a.orchestrator)
	a.queue.SetConfig(config)
	a.queue.SetHistory(a.history)
	a.config = config

	a.registry = core.NewChannelJobRegistry()

	// Real-time queue updates -> frontend, via Wails events instead of a
	// WebSocket broadcast (see lib/websocket.ts on the frontend side).
	a.queue.SetProgressCallback(func(event core.QueueEvent) {
		runtime.EventsEmit(a.ctx, "queue:event", event)
	})

	a.queue.StartProcessing()
}

func (a *App) shutdown(ctx context.Context) {
	a.queue.StopProcessing()
	a.queue.SaveQueue()
}
