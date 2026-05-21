package services

import (
	"net"
	"net/http"
	"os/exec"
	"runtime"
	"strings"
	"syscall"
	"time"
)

// CheckDeviceStatus returns true if the device is reachable on the network.
// Since ICMP (ping) requires raw sockets/admin privileges on Windows,
// we use a TCP connection attempt to common ports for a quick network check.
func CheckDeviceStatus(ip string, deviceType string) bool {
	if ip == "" {
		return false
	}

	if deviceType == "projector" {
		isOn, err := QueryPJLinkPower(ip, "")
		if err == nil {
			return isOn
		}
		// Fallback to TCP ping if PJLink fails but projector is somewhat online
		address := net.JoinHostPort(ip, "4352")
		conn, err := net.DialTimeout("tcp", address, 1*time.Second)
		if err == nil {
			conn.Close()
			return false // Port is open, but PJLink failed to reply ON -> Assume OFF/Standby
		}
		return false
	}

	// First try to check via our custom lightweight PowerControl Client Agent (Port 9999)
	client := http.Client{Timeout: 500 * time.Millisecond}
	resp, err := client.Get("http://" + ip + ":9999/ping")
	if err == nil {
		resp.Body.Close()
		if resp.StatusCode == http.StatusOK {
			return true
		}
	}

	// For PCs, fallback to check common Windows ports that might be open: 135 (RPC), 139 (NetBIOS), 445 (SMB), 3389 (RDP)
	ports := []string{"135", "139", "445", "3389"}
	for _, port := range ports {
		address := net.JoinHostPort(ip, port)
		conn, err := net.DialTimeout("tcp", address, 300*time.Millisecond)
		if err == nil {
			conn.Close()
			return true // Port is open, PC is definitely on
		}
	}

	// Fallback: Using ICMP Ping if TCP ports are filtered or closed.
	// HideWindow is crucial so the cmd window doesn't blink every 10 secs.
	if runtime.GOOS == "windows" {
		cmd := exec.Command("ping", "-n", "1", "-w", "500", ip)
		cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
		
		output, err := cmd.CombinedOutput()
		if err != nil {
			return false
		}
		
		// In Windows, if the router returns "Destination host unreachable", the exit code is still 0.
		// A valid reply always contains "TTL=" (case-insensitive).
		outStr := string(output)
		if strings.Contains(strings.ToUpper(outStr), "TTL=") {
			return true
		}
		return false
	}

	return false
}
