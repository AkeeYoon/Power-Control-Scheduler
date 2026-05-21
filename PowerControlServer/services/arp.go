package services

import (
	"bytes"
	"os/exec"
	"regexp"
	"strings"
)

// FindMacByIP executes the 'arp -a' command to look up the MAC address for a given IP.
func FindMacByIP(ip string) (string, error) {
	cmd := exec.Command("arp", "-a", ip)
	var out bytes.Buffer
	cmd.Stdout = &out
	err := cmd.Run()
	if err != nil {
		return "", err
	}

	// Output format typically:
	// Interface: 192.168.1.100 --- 0xb
	//   Internet Address      Physical Address      Type
	//   192.168.1.50          aa-bb-cc-dd-ee-ff     dynamic
	output := out.String()

	// Create a regex to find the physical address block
	// e.g. aa-bb-cc-dd-ee-ff or aa:bb:cc:dd:ee:ff
	re := regexp.MustCompile(`([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})`)
	match := re.FindString(output)
	if match != "" {
		// Normalize to standard MAC format with colons and uppercase
		match = strings.ReplaceAll(match, "-", ":")
		return strings.ToUpper(match), nil
	}

	return "", nil
}
