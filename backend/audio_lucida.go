package backend

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// ============================================================================
// Lucida.to Service Implementation
// Used by many music download tools including SpotiFLAC-style applications
// ============================================================================

const (
	lucidaAPIBase = "https://lucida.to"
	lucidaAPIPath = "/api/load"
)

// LucidaService implements AudioDownloadService using lucida.to
type LucidaService struct {
	client  *http.Client
	baseURL string
}

// LucidaResponse represents the API response from lucida.to
type LucidaResponse struct {
	Success bool   `json:"success"`
	Error   string `json:"error,omitempty"`
	Track   struct {
		ID          string  `json:"id"`
		Title       string  `json:"title"`
		Artist      string  `json:"artist"`
		Album       string  `json:"album"`
		Duration    float64 `json:"duration"`
		CoverURL    string  `json:"cover"`
		ReleaseDate string  `json:"releaseDate"`
		ISRC        string  `json:"isrc"`
		Platform    string  `json:"platform"`
	} `json:"track"`
	Formats []struct {
		Format  string `json:"format"`
		Quality string `json:"quality"`
		Size    int64  `json:"size"`
		URL     string `json:"url"`
	} `json:"formats"`
}

// NewLucidaService creates a new Lucida download service
func NewLucidaService() *LucidaService {
	return &LucidaService{
		client: &http.Client{
			Timeout: 60 * time.Second,
		},
		baseURL: lucidaAPIBase,
	}
}

func (l *LucidaService) Name() string {
	return "lucida"
}

func (l *LucidaService) IsAvailable() bool {
	resp, err := l.client.Head(l.baseURL)
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	return resp.StatusCode < 500
}

func (l *LucidaService) SupportsFormat(format string) bool {
	supported := []string{"flac", "mp3", "wav", "aac", "ogg"}
	format = strings.ToLower(format)
	for _, f := range supported {
		if f == format {
			return true
		}
	}
	return false
}

func (l *LucidaService) GetTrackInfo(trackURL string) (*AudioTrackInfo, error) {
	resp, err := l.fetchTrackData(trackURL)
	if err != nil {
		return nil, err
	}

	return &AudioTrackInfo{
		ID:          resp.Track.ID,
		Title:       resp.Track.Title,
		Artist:      resp.Track.Artist,
		Album:       resp.Track.Album,
		Duration:    resp.Track.Duration,
		ISRC:        resp.Track.ISRC,
		Platform:    resp.Track.Platform,
		CoverURL:    resp.Track.CoverURL,
		ReleaseDate: resp.Track.ReleaseDate,
	}, nil
}

func (l *LucidaService) fetchTrackData(trackURL string) (*LucidaResponse, error) {
	apiURL := l.baseURL + lucidaAPIPath

	data := url.Values{}
	data.Set("url", trackURL)

	req, err := http.NewRequest("POST", apiURL, strings.NewReader(data.Encode()))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
	req.Header.Set("Origin", "https://lucida.to")
	req.Header.Set("Referer", "https://lucida.to/")

	resp, err := l.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("API request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	var result LucidaResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if !result.Success {
		return nil, fmt.Errorf("API error: %s", result.Error)
	}

	return &result, nil
}

func (l *LucidaService) Download(trackURL string, outputDir string, format string) (*AudioDownloadResult, error) {
	resp, err := l.fetchTrackData(trackURL)
	if err != nil {
		return nil, err
	}

	var downloadURL string
	var downloadFormat string
	var downloadSize int64
	var quality string

	format = strings.ToLower(format)

	// First try exact format match
	for _, f := range resp.Formats {
		if strings.ToLower(f.Format) == format {
			downloadURL = f.URL
			downloadFormat = f.Format
			downloadSize = f.Size
			quality = f.Quality
			break
		}
	}

	// If FLAC not available, fall back to best available
	if downloadURL == "" && format == "flac" {
		priorities := []string{"flac", "wav", "mp3"}
		for _, pf := range priorities {
			for _, f := range resp.Formats {
				if strings.ToLower(f.Format) == pf {
					downloadURL = f.URL
					downloadFormat = f.Format
					downloadSize = f.Size
					quality = f.Quality
					break
				}
			}
			if downloadURL != "" {
				break
			}
		}
	}

	if downloadURL == "" {
		return nil, fmt.Errorf("format %s not available for this track", format)
	}

	if err := os.MkdirAll(outputDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create output directory: %w", err)
	}

	safeTitle := SanitizeFileName(fmt.Sprintf("%s - %s", resp.Track.Artist, resp.Track.Title))
	outputPath := filepath.Join(outputDir, fmt.Sprintf("%s.%s", safeTitle, strings.ToLower(downloadFormat)))

	if err := l.downloadFile(downloadURL, outputPath); err != nil {
		return nil, fmt.Errorf("download failed: %w", err)
	}

	stat, _ := os.Stat(outputPath)
	if stat != nil {
		downloadSize = stat.Size()
	}

	return &AudioDownloadResult{
		FilePath: outputPath,
		Track: &AudioTrackInfo{
			ID:          resp.Track.ID,
			Title:       resp.Track.Title,
			Artist:      resp.Track.Artist,
			Album:       resp.Track.Album,
			Duration:    resp.Track.Duration,
			ISRC:        resp.Track.ISRC,
			Platform:    resp.Track.Platform,
			CoverURL:    resp.Track.CoverURL,
			Quality:     quality,
			ReleaseDate: resp.Track.ReleaseDate,
		},
		Format: downloadFormat,
		Size:   downloadSize,
	}, nil
}

func (l *LucidaService) downloadFile(downloadURL, outputPath string) error {
	resp, err := l.client.Get(downloadURL)
	if err != nil {
		return fmt.Errorf("failed to start download: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return fmt.Errorf("download server returned %d", resp.StatusCode)
	}

	outFile, err := os.Create(outputPath)
	if err != nil {
		return fmt.Errorf("failed to create file: %w", err)
	}
	defer outFile.Close()

	if _, err = io.Copy(outFile, resp.Body); err != nil {
		os.Remove(outputPath)
		return fmt.Errorf("download interrupted: %w", err)
	}

	return nil
}
