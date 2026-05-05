#!/bin/bash
# Quick health check for Coolify services
# Usage: ./check_health.sh

set -e

echo "Coolify Health Check"
echo "======================="
echo ""

# Check if coolify is installed
if ! command -v coolify &> /dev/null; then
    echo "ERROR: Coolify CLI not found"
    echo "  Run: scripts/install_coolify_cli.sh"
    exit 1
fi

echo "Coolify CLI: $(coolify version 2>&1)"
echo ""

# Check context configuration
echo "Configured Contexts:"
coolify context list
echo ""

# Verify connection (capture output once)
echo "Connection Status:"
VERIFY_OUTPUT=$(coolify context verify 2>&1) || true

if echo "$VERIFY_OUTPUT" | grep -q "successful"; then
    echo "$VERIFY_OUTPUT"
    echo ""

    # Show resources
    echo "Resources:"
    coolify resource list
    echo ""

    # Show servers
    echo "Servers:"
    coolify server list
    echo ""

    echo "Health check complete!"
else
    echo "ERROR: Connection failed"
    echo "$VERIFY_OUTPUT"
    echo "  Check your API token and context configuration"
    exit 1
fi
