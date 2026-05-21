package main

import (
	"embed"
	"fmt"
	"io/fs"
	"log"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"powerctrl/api"
	"powerctrl/database"
	"powerctrl/services"

	"github.com/jchv/go-webview2"
)

//go:embed web/*
var webFiles embed.FS

func main() {
	// Register to Windows Startup
	services.RegisterAutoStart()

	// 1. Setup Embedded UI File Server
	// The web files are inside the "web" directory in the embed.FS
	subFS, err := fs.Sub(webFiles, "web")
	if err != nil {
		log.Fatal("Failed to setup embedded fs:", err)
	}

	mux := http.NewServeMux()

	// Use standard FileServer for all static assets but disable caching so updates show in WebView2
	fsHandler := http.FileServer(http.FS(subFS))
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
		w.Header().Set("Pragma", "no-cache")
		w.Header().Set("Expires", "0")
		// Prevent 304 Not Modified from http.FileServer for embedded files
		r.Header.Del("If-Modified-Since")
		r.Header.Del("If-None-Match")
		fsHandler.ServeHTTP(w, r)
	})

	// Initialize database
	database.InitDB()
	services.LoadSettings()

	// 2. Setup API Routes
	api.RegisterRoutes(mux)

	// 3. Start the Server on the preferred port
	preferredPortStr := fmt.Sprintf(":%d", services.GlobalSettings.PreferredPort)
	listener, err := net.Listen("tcp", preferredPortStr)
	if err != nil {
		log.Printf("Port %d is in use, falling back to a dynamic external port\n", services.GlobalSettings.PreferredPort)
		listener, err = net.Listen("tcp", ":0")
		if err != nil {
			log.Fatal("Server failed to start:", err)
			os.Exit(1)
		}
	}
	services.ActivePort = listener.Addr().(*net.TCPAddr).Port

	// Append a timestamp query string to bust the WebView2 cache
	url := fmt.Sprintf("http://127.0.0.1:%d/?t=%d", services.ActivePort, time.Now().UnixNano())

	go func() {
		if err := http.Serve(listener, mux); err != nil {
			log.Fatal(err)
		}
	}()

	// 4. Launch Native Desktop Window using WebView2 (Edge Chromium, built into Windows)
	// Use a known DataPath so we can clear cache on startup
	webviewDataPath := filepath.Join("data", "webview_cache")

	// Delete old cache to ensure fresh embedded files are always loaded
	cachePath := filepath.Join(webviewDataPath, "EBWebView", "Default", "Cache")
	os.RemoveAll(cachePath)

	w := webview2.NewWithOptions(webview2.WebViewOptions{
		Debug:    true,
		DataPath: webviewDataPath,
	})
	defer w.Destroy()
	w.SetTitle("PowerCtrl - 장비 전원 제어 시스템")
	w.SetSize(1200, 800, webview2.HintNone)

	// ===== Direct Go-JS Bindings (bypass HTTP/cache entirely) =====

	// Bind: goGetSettings — JS can call this to get current settings from Go memory
	w.Bind("goGetSettings", func() map[string]interface{} {
		return map[string]interface{}{
			"preferredPort":    services.GlobalSettings.PreferredPort,
			"activePort":       services.ActivePort,
			"broadcastIp":      services.GlobalSettings.BroadcastIP,
			"schedulerEnabled": services.GlobalSettings.SchedulerEnabled,
		}
	})

	// Bind: goSaveSettings — JS calls this to save settings directly into Go
	w.Bind("goSaveSettings", func(port int, ip string, scheduler bool) string {
		needsRestart := services.GlobalSettings.PreferredPort != port

		services.GlobalSettings.PreferredPort = port
		services.GlobalSettings.BroadcastIP = ip
		services.GlobalSettings.SchedulerEnabled = scheduler
		services.IsSchedulerEnabled = scheduler

		if err := services.SaveSettings(); err != nil {
			return "error:" + err.Error()
		}

		if needsRestart {
			return "restart"
		}
		return "ok"
	})

	// Init: Inject JS on every page load to override settings functions
	// This runs BEFORE page scripts, so we use 'load' event to override AFTER app.js
	w.Init(`
		window.addEventListener('load', function() {
			// Override fetchSettings — read from Go directly
			window.fetchSettings = async function() {
				try {
					var data = await goGetSettings();
					var p = document.getElementById('settingsApiPort');
					var i = document.getElementById('settingsBroadcastIp');
					var t = document.getElementById('globalSchedulerToggle');
					if (p) p.value = data.preferredPort || 8080;
					if (i) i.value = data.broadcastIp || '192.168.1.255';
					if (t) t.checked = data.schedulerEnabled;
				} catch(e) { console.error('fetchSettings error:', e); }
			};

			// Override saveSettings — save to Go directly
			window.saveSettings = async function() {
				var p = document.getElementById('settingsApiPort');
				var i = document.getElementById('settingsBroadcastIp');
				var t = document.getElementById('globalSchedulerToggle');
				if (!p || !i) {
					alert('설정 입력 필드를 찾을 수 없습니다.');
					return;
				}
				try {
					var result = await goSaveSettings(
						parseInt(p.value) || 8080,
						i.value.trim() || '192.168.1.255',
						t ? t.checked : true
					);
					if (result === 'restart') {
						alert('설정이 저장되었습니다.\n포트 번호가 변경되었으므로 프로그램을 껐다 켜야 적용됩니다.');
					} else if (result === 'ok') {
						alert('환경 설정이 저장되었습니다.');
					} else {
						alert('저장 실패: ' + result);
					}
				} catch(e) {
					alert('설정 저장 오류: ' + e);
				}
			};

			// Override toggleGlobalScheduler
			window.toggleGlobalScheduler = async function(enabled) {
				await window.saveSettings();
			};

			// Override resetSettings
			window.resetSettings = function() {
				if (confirm('설정값을 기본값으로 되돌리시겠습니까?\n(저장 버튼을 눌러야 적용됩니다)')) {
					var p = document.getElementById('settingsApiPort');
					var i = document.getElementById('settingsBroadcastIp');
					var t = document.getElementById('globalSchedulerToggle');
					if (p) p.value = '8080';
					if (i) i.value = '192.168.1.255';
					if (t) t.checked = true;
				}
			};

			// Auto-load settings into the UI
			window.fetchSettings();
		});
	`)

	w.Navigate(url)

	// 5. Start Background Device Status Monitor
	go func() {
		for {
			devices, err := database.GetAllDevices()
			if err == nil {
				for _, d := range devices {
					isReachable := services.CheckDeviceStatus(d.IP, d.Type)
					if d.IsOn != isReachable {
						// State changed, update DB
						database.ToggleDevicePower(d.ID, isReachable)
					}
				}
			}
			time.Sleep(10 * time.Second) // Check every 10 seconds
		}
	}()

	// 6. Start Schedule Automation Service
	services.StartScheduler()

	w.Run()
}
