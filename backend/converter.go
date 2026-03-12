package backend

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// ConvertRequest represents an audio conversion request
type ConvertRequest struct {
	SourcePath   string `json:"sourcePath"`
	TargetFormat string `json:"targetFormat"` // mp3, wav, aac, ogg, alac, flac
	Bitrate      int    `json:"bitrate,omitempty"`
	SampleRate   int    `json:"sampleRate,omitempty"`
}

// ConvertResult contains the result of a conversion
type ConvertResult struct {
	OutputPath string `json:"outputPath"`
	Format     string `json:"format"`
	Size       int64  `json:"size"`
}

// SupportedConvertFormats returns the list of supported output formats
var SupportedConvertFormats = []string{"mp3", "wav", "aac", "ogg", "alac", "flac"}

// ConvertAudio converts an audio file to the specified format using FFmpeg
func ConvertAudio(req ConvertRequest) (*ConvertResult, error) {
	ffmpegPath := GetFFmpegPath()
	if ffmpegPath == "" {
		return nil, fmt.Errorf("ffmpeg not found")
	}

	// Validate source exists
	if _, err := os.Stat(req.SourcePath); err != nil {
		return nil, fmt.Errorf("source file not found: %w", err)
	}

	// Validate format
	format := strings.ToLower(req.TargetFormat)
	if !isValidFormat(format) {
		return nil, fmt.Errorf("unsupported format: %s", format)
	}

	// Build output path
	ext := "." + format
	if format == "alac" {
		ext = ".m4a"
	}
	baseName := strings.TrimSuffix(filepath.Base(req.SourcePath), filepath.Ext(req.SourcePath))
	outputPath := filepath.Join(filepath.Dir(req.SourcePath), baseName+ext)

	// Avoid overwriting source
	if outputPath == req.SourcePath {
		outputPath = filepath.Join(filepath.Dir(req.SourcePath), baseName+"_converted"+ext)
	}

	// Build FFmpeg args
	args := []string{"-y", "-i", req.SourcePath}
	args = append(args, getCodecArgs(format, req.Bitrate, req.SampleRate)...)
	args = append(args, outputPath)

	cmd := exec.Command(ffmpegPath, args...)
	if output, err := cmd.CombinedOutput(); err != nil {
		return nil, fmt.Errorf("conversion failed: %w, output: %s", err, string(output))
	}

	// Get output size
	stat, err := os.Stat(outputPath)
	if err != nil {
		return nil, fmt.Errorf("output file not found after conversion: %w", err)
	}

	return &ConvertResult{
		OutputPath: outputPath,
		Format:     format,
		Size:       stat.Size(),
	}, nil
}

func isValidFormat(format string) bool {
	for _, f := range SupportedConvertFormats {
		if f == format {
			return true
		}
	}
	return false
}

func getCodecArgs(format string, bitrate, sampleRate int) []string {
	args := []string{}

	switch format {
	case "mp3":
		args = append(args, "-codec:a", "libmp3lame")
		if bitrate > 0 {
			args = append(args, "-b:a", fmt.Sprintf("%dk", bitrate))
		} else {
			args = append(args, "-b:a", "320k")
		}
	case "wav":
		args = append(args, "-codec:a", "pcm_s16le")
	case "aac":
		args = append(args, "-codec:a", "aac")
		if bitrate > 0 {
			args = append(args, "-b:a", fmt.Sprintf("%dk", bitrate))
		} else {
			args = append(args, "-b:a", "256k")
		}
	case "ogg":
		args = append(args, "-codec:a", "libvorbis")
		if bitrate > 0 {
			args = append(args, "-b:a", fmt.Sprintf("%dk", bitrate))
		} else {
			args = append(args, "-b:a", "256k")
		}
	case "alac":
		args = append(args, "-codec:a", "alac")
	case "flac":
		args = append(args, "-codec:a", "flac")
	}

	if sampleRate > 0 {
		args = append(args, "-ar", fmt.Sprintf("%d", sampleRate))
	}

	// Strip video streams
	args = append(args, "-vn")

	return args
}
