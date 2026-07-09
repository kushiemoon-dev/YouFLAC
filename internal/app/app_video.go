package app

import (
	"fmt"
	"strings"

	core "github.com/kushiemoon-dev/youflac-core/v4"
	"github.com/kushiemoon-dev/youflac-core/v4/channeljobs"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// ============== Video/URL methods (mirrors internal/api/handlers_video.go) ==============

type ParseURLResult struct {
	Type       string `json:"type"` // "video", "playlist", "channel", "invalid"
	VideoID    string `json:"videoId"`
	PlaylistID string `json:"playlistId"`
	URL        string `json:"url"`
}

func (a *App) ParseURL(url string) (ParseURLResult, error) {
	url = strings.TrimSpace(url)
	result := ParseURLResult{URL: url}

	// Check if channel URL
	if core.IsChannelURL(url) {
		result.Type = "channel"
	} else if strings.Contains(url, "list=") {
		// Check if playlist
		result.Type = "playlist"
		if idx := strings.Index(url, "list="); idx != -1 {
			pID := url[idx+5:]
			if ampIdx := strings.Index(pID, "&"); ampIdx != -1 {
				pID = pID[:ampIdx]
			}
			result.PlaylistID = pID
		}
	} else {
		// Try to parse as video
		videoID, err := core.ParseYouTubeURL(url)
		if err != nil {
			result.Type = "invalid"
		} else {
			result.Type = "video"
			result.VideoID = videoID
		}
	}

	return result, nil
}

func (a *App) GetVideoInfo(url string) (*core.VideoInfo, error) {
	if url == "" {
		return nil, fmt.Errorf("URL required")
	}

	videoID, err := core.ParseYouTubeURL(url)
	if err != nil {
		return nil, err
	}

	return core.GetVideoMetadata(videoID)
}

func (a *App) VideoCheck(url string) (core.AvailabilityResult, error) {
	if url == "" {
		return core.AvailabilityResult{}, fmt.Errorf("url required")
	}
	return core.CheckAvailable(url)
}

func (a *App) FindAudioMatch(videoInfo core.VideoInfo) (*core.MatchResult, error) {
	// Use empty candidates and default options - the matcher will try to find matches
	return core.MatchVideoToAudio(&videoInfo, nil, nil)
}

func (a *App) Search(query string, limit int) ([]core.VideoInfo, error) {
	if query == "" {
		return nil, fmt.Errorf("query parameter 'q' required")
	}

	if limit <= 0 {
		limit = a.config.SearchResultsLimit
	}
	if limit <= 0 {
		limit = 10
	}
	if limit > 30 {
		limit = 30
	}

	return core.SearchYouTube(query, limit)
}

// ============== Channel methods (mirrors internal/api/handlers_channel.go) ==============

type ChannelAssetsResult struct {
	Assets *core.ChannelAssets `json:"assets"`
	Dir    string              `json:"dir"`
}

func (a *App) ChannelAssets(url string) (ChannelAssetsResult, error) {
	if url == "" {
		return ChannelAssetsResult{}, fmt.Errorf("url required")
	}
	assets, err := core.GetChannelAssets(url)
	if err != nil {
		return ChannelAssetsResult{}, err
	}
	dir, err := core.DownloadChannelAssets(assets, a.config.OutputDirectory)
	if err != nil {
		return ChannelAssetsResult{}, err
	}
	return ChannelAssetsResult{Assets: assets, Dir: dir}, nil
}

func (a *App) ChannelFetch(url string, includeShorts bool, onlyLongForm bool, playlistID string, maxItems int) (string, error) {
	if url == "" {
		return "", fmt.Errorf("url required")
	}
	if !core.IsChannelURL(url) {
		return "", fmt.Errorf("invalid channel URL")
	}
	opts := core.ChannelOpts{
		IncludeShorts: includeShorts,
		OnlyLongForm:  onlyLongForm,
		PlaylistID:    playlistID,
		MaxItems:      maxItems,
	}
	jobID := a.registry.StartJob(url, opts, func(jid string, v core.VideoInfoLite, n int) {
		runtime.EventsEmit(a.ctx, "channel_fetch_progress", map[string]interface{}{
			"jobID": jid,
			"count": n,
			"total": -1,
			"item":  v,
		})
	}, func(jid string, total, errs int) {
		runtime.EventsEmit(a.ctx, "channel_fetch_done", map[string]interface{}{
			"jobID":        jid,
			"totalFetched": total,
			"errorCount":   errs,
		})
	})
	return jobID, nil
}

func (a *App) ChannelFetchCancel(id string) error {
	if !a.registry.CancelJob(id) {
		return fmt.Errorf("job not found")
	}
	return nil
}

func (a *App) ChannelFetchStatus(id string) (*channeljobs.ChannelJob, error) {
	job, ok := a.registry.GetJobStatus(id)
	if !ok {
		return nil, fmt.Errorf("job not found")
	}
	return job, nil
}
