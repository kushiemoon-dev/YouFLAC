package main

import (
	"embed"

	"youflac/internal/app"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	youflacApp := app.NewApp()

	err := wails.Run(&options.App{
		Title:  "YouFLAC",
		Width:  1280,
		Height: 800,
		AssetServer: &assetserver.Options{
			Assets:  assets,
			Handler: youflacApp.PreviewAssetHandler(),
		},
		BackgroundColour: &options.RGBA{R: 15, G: 20, B: 25, A: 1},
		OnStartup:        youflacApp.Startup,
		OnShutdown:       youflacApp.Shutdown,
		Bind: []interface{}{
			youflacApp,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
