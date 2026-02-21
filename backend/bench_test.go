package backend

import "testing"

// ============================================================================
// Benchmarks — matcher.go
// ============================================================================

func BenchmarkLevenshteinDistance_Short(b *testing.B) {
	a, s := "hello", "helo"
	b.ResetTimer()
	for range b.N {
		levenshteinDistance(a, s)
	}
}

func BenchmarkLevenshteinDistance_Medium(b *testing.B) {
	a := "never gonna give you up"
	s := "never gonna let you down"
	b.ResetTimer()
	for range b.N {
		levenshteinDistance(a, s)
	}
}

func BenchmarkLevenshteinDistance_Long(b *testing.B) {
	a := "the quick brown fox jumps over the lazy dog and the lazy dog barks back"
	s := "the quick brown fox jumped over the lazy dog and the lazy dog barked back"
	b.ResetTimer()
	for range b.N {
		levenshteinDistance(a, s)
	}
}

func BenchmarkStringSimilarity(b *testing.B) {
	a, s := "Bohemian Rhapsody", "Bohemian Rhapsody (Remastered)"
	b.ResetTimer()
	for range b.N {
		stringSimilarity(a, s)
	}
}

func BenchmarkComputeTitleSimilarity(b *testing.B) {
	video := "Bohemian Rhapsody (Official Music Video) [HD]"
	audio := "Bohemian Rhapsody - Remastered 2011"
	b.ResetTimer()
	for range b.N {
		ComputeTitleSimilarity(video, audio)
	}
}

func BenchmarkComputeArtistSimilarity(b *testing.B) {
	video := "Queen VEVO"
	audio := "Queen feat. David Bowie"
	b.ResetTimer()
	for range b.N {
		ComputeArtistSimilarity(video, audio)
	}
}

func BenchmarkMatchVideoToAudio_ISRC(b *testing.B) {
	video := &VideoInfo{
		Title:    "Bohemian Rhapsody",
		Artist:   "Queen",
		ISRC:     "GBUM71029604",
		Duration: 354,
	}
	candidates := []AudioCandidate{
		{Platform: "tidal", Title: "Bohemian Rhapsody", Artist: "Queen", ISRC: "GBUM71029604", Duration: 354, Priority: 1},
		{Platform: "qobuz", Title: "Bohemian Rhapsody", Artist: "Queen", ISRC: "GBUM71029604", Duration: 354, Priority: 2},
		{Platform: "amazon", Title: "Bohemian Rhapsody", Artist: "Queen", ISRC: "GBUM71029604", Duration: 354, Priority: 3},
		{Platform: "deezer", Title: "Bohemian Rhapsody", Artist: "Queen", ISRC: "GBUM71029604", Duration: 354, Priority: 4},
		{Platform: "spotify", Title: "Bohemian Rhapsody", Artist: "Queen", ISRC: "GBUM71029604", Duration: 354, Priority: 5},
	}
	opts := DefaultMatchOptions()
	b.ResetTimer()
	for range b.N {
		MatchVideoToAudio(video, candidates, opts) //nolint:errcheck
	}
}

func BenchmarkMatchVideoToAudio_Metadata(b *testing.B) {
	video := &VideoInfo{
		Title:    "Bohemian Rhapsody (Official Music Video)",
		Artist:   "Queen VEVO",
		Duration: 354,
	}
	candidates := []AudioCandidate{
		{Platform: "tidal", Title: "Bohemian Rhapsody", Artist: "Queen", Duration: 354, Priority: 1},
		{Platform: "qobuz", Title: "Bohemian Rhapsody", Artist: "Queen", Duration: 355, Priority: 2},
		{Platform: "amazon", Title: "Bohemian Rhapsody - Remastered", Artist: "Queen", Duration: 354, Priority: 3},
		{Platform: "deezer", Title: "Bohemian Rhapsody", Artist: "Queen", Duration: 356, Priority: 4},
		{Platform: "spotify", Title: "Bohemian Rhapsody (2011 Remaster)", Artist: "Queen", Duration: 354, Priority: 5},
	}
	opts := DefaultMatchOptions()
	b.ResetTimer()
	for range b.N {
		MatchVideoToAudio(video, candidates, opts) //nolint:errcheck
	}
}

// ============================================================================
// Benchmarks — naming.go
// ============================================================================

func BenchmarkSanitizeFileName_Normal(b *testing.B) {
	name := "Rick Astley - Never Gonna Give You Up"
	b.ResetTimer()
	for range b.N {
		SanitizeFileName(name)
	}
}

func BenchmarkSanitizeFileName_HeavySpecial(b *testing.B) {
	name := `AC/DC: "Back\In\Black" <Live> | HD? * Special*`
	b.ResetTimer()
	for range b.N {
		SanitizeFileName(name)
	}
}

func BenchmarkApplyTemplate_Simple(b *testing.B) {
	meta := &Metadata{
		Title:  "Never Gonna Give You Up",
		Artist: "Rick Astley",
		Album:  "Whenever You Need Somebody",
		Year:   1987,
	}
	tmpl := "{artist} - {title}"
	b.ResetTimer()
	for range b.N {
		ApplyTemplate(tmpl, meta)
	}
}

func BenchmarkApplyTemplate_Complex(b *testing.B) {
	meta := &Metadata{
		Title:  "Never Gonna Give You Up",
		Artist: "Rick Astley",
		Album:  "Whenever You Need Somebody",
		Year:   1987,
		Track:  1,
		Genre:  "Pop",
	}
	tmpl := "{year}/{artist}/{album}/{track} - {artist} - {title}"
	b.ResetTimer()
	for range b.N {
		ApplyTemplate(tmpl, meta)
	}
}

func BenchmarkGenerateFilePath(b *testing.B) {
	meta := &Metadata{
		Title:  "Never Gonna Give You Up",
		Artist: "Rick Astley",
		Album:  "Whenever You Need Somebody",
		Year:   1987,
	}
	b.ResetTimer()
	for range b.N {
		GenerateFilePath(meta, "{artist}/{album}/{title}", "/music", ".mkv")
	}
}

// ============================================================================
// Benchmarks — audio_downloader.go (qualityRankOf)
// ============================================================================

func BenchmarkQualityRankOf(b *testing.B) {
	qualities := []string{"hi_res 24-bit/96kHz", "lossless 16-bit/44.1kHz", "mp3 320kbps", "unknown"}
	b.ResetTimer()
	for i := range b.N {
		qualityRankOf(qualities[i%len(qualities)])
	}
}
