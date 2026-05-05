#!/bin/bash
# Install Coolify CLI to user's local bin directory
# Usage: ./install_coolify_cli.sh [version]

set -e

VERSION="${1:-1.4.0}"
INSTALL_DIR="$HOME/.local/bin"
PLATFORM=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

# Map architecture names
case "$ARCH" in
    x86_64)
        ARCH="amd64"
        ;;
    aarch64|arm64)
        ARCH="arm64"
        ;;
esac

echo "Installing Coolify CLI v${VERSION}"
echo "  Platform: ${PLATFORM}/${ARCH}"
echo "  Install directory: ${INSTALL_DIR}"
echo ""

# Create install directory if it doesn't exist
mkdir -p "${INSTALL_DIR}"

# Download URL
URL="https://github.com/coollabsio/coolify-cli/releases/download/${VERSION}/coolify-cli_${VERSION}_${PLATFORM}_${ARCH}.tar.gz"

echo "Downloading from: ${URL}"
curl -fL "${URL}" -o /tmp/coolify-cli.tar.gz

echo "Extracting..."
tar -xzf /tmp/coolify-cli.tar.gz -C /tmp

echo "Installing to ${INSTALL_DIR}/coolify"
mv /tmp/coolify "${INSTALL_DIR}/coolify"
chmod +x "${INSTALL_DIR}/coolify"

# Cleanup
rm -f /tmp/coolify-cli.tar.gz

echo ""
echo "Coolify CLI v${VERSION} installed successfully!"
echo ""
echo "Next steps:"
echo "1. Make sure ${INSTALL_DIR} is in your PATH"
echo "2. Get API token from your Coolify dashboard at /security/api-tokens"
echo "3. Configure context: coolify context add <name> <url> <token>"
echo ""
echo "Run 'coolify --help' to see available commands"
