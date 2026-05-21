package services

import (
	"errors"
	"fmt"
	"net/http"
	"os/exec"
	"runtime"
	"syscall"
	"time"
)

// ShutdownPC sends a remote shutdown command to a Windows PC via its IP address.
// Note: The caller must have administrative privileges or appropriate remote RPC access
// configured on the target PC for this command to succeed.
func ShutdownPC(ip string) error {
	if ip == "" {
		return errors.New("IP address is empty")
	}

	// First try via our custom lightweight PowerControl Client Agent (Port 9999)
	client := http.Client{Timeout: 2 * time.Second}
	resp, err := client.Get(fmt.Sprintf("http://%s:9999/shutdown", ip))
	if err == nil {
		resp.Body.Close()
		if resp.StatusCode == http.StatusOK {
			return nil // Success gracefully handled via agent
		}
	}

	// Fallback to traditional Windows RPC remote shutdown command
	if runtime.GOOS == "windows" {
		target := fmt.Sprintf(`\\%s`, ip)
		cmd := exec.Command("shutdown", "/m", target, "/s", "/f", "/t", "0")
		cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: 0x08000000} // CREATE_NO_WINDOW
		err := cmd.Run()
		if err != nil {
			return fmt.Errorf("shutdown command failed: %v", err)
		}
		return nil
	}

	return errors.New("remote shutdown is only supported on Windows server host")
}
