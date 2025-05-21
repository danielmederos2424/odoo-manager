# Build Instructions for Odoo Manager

This document provides detailed instructions for building the Odoo Manager application for different platforms.

## Prerequisites

Before building, make sure you have the following installed:

- Node.js (v18 or later)
- npm (v9 or later)
- Git
- For icon generation:
  - ImageMagick (`convert` command)
  - On macOS: `iconutil` (comes with macOS)

## Development Setup

```bash
# Clone the repository
git clone https://github.com/danielmederos2424/odoo-manager.git
cd odoo-manager

# Install dependencies
npm install

# Start the development server
npm run dev
```

## Build Configuration

The build configuration is defined in the `build` section of `package.json`. This configuration uses [electron-builder](https://www.electron.build/) to create distribution packages for multiple platforms.

## Preparing Icons

Icons are needed for the various platforms. The `build/generate-icons.sh` script can help generate the required formats from a high-resolution source image.

```bash
# Make the script executable if it's not already
chmod +x build/generate-icons.sh

# Generate icons from a source PNG (should be at least 1024x1024)
./build/generate-icons.sh path/to/your/high-res-icon.png
```

This will create:
- `build/icon.icns` - macOS app icon
- `build/icon.ico` - Windows app icon
- `build/icons/` - Directory with various sized PNGs for Linux

## Building Installers

### For All Platforms

```bash
npm run build:all
```

This runs `electron-builder -mwl` which creates installers for macOS, Windows, and Linux.

### For Specific Platforms

```bash
# Build for macOS only
npm run build:mac

# Build for Windows only
npm run build:win

# Build for Linux only (directly on the host)
npm run build:linux

# Build for Linux using Docker (recommended for cross-platform builds)
npm run build:linux-docker
```

## Build Output

The build output will be in the `release` directory:

- **macOS**:
  - `release/Odoo Manager-{version}.dmg` - Disk image installer
  - `release/Odoo Manager-{version}-mac.zip` - Zipped application

- **Windows**:
  - `release/Odoo Manager Setup {version}.exe` - NSIS installer
  - `release/Odoo Manager {version}.exe` - Portable executable

- **Linux**:
  - `release/odoo-manager_{version}_amd64.deb` - Debian package
  - `release/odoo-manager-{version}.AppImage` - AppImage executable
  - `release/odoo-manager-{version}.x86_64.rpm` - RPM package
  - `release/odoo-manager-{version}.pacman` - Arch/Manjaro package

## Platform-Specific Considerations

### macOS

- Building for macOS requires a macOS system
- The build is not signed or notarized (this is acceptable for internal distribution)

### Windows

- Building for Windows on non-Windows platforms requires Wine installed
- The build is not signed (users may see security warnings)

### Linux

- The application will be built for the amd64 architecture by default
- For other architectures, you'll need to modify the build configuration
- Building RPM and Pacman packages directly on macOS or Windows may fail
- Use the Docker-based build script (`npm run build:linux-docker`) for the most reliable cross-platform Linux builds
- This script handles all Linux targets (AppImage, DEB, RPM, Pacman) using a container with the appropriate build tools

## Manual Release Process

To create a new release:

1. Build packages for each desired platform
2. Manually upload the resulting installers to your preferred distribution method
3. For GitHub, create a new release and upload the installer files
4. Users can download and install the new version manually

## Troubleshooting

### Common Issues:

1. **Missing dependencies for icon conversion**
   - Install ImageMagick for icon conversion: `brew install imagemagick` (macOS) or equivalent for your OS

2. **Cross-platform build errors**
   - For Windows builds on macOS/Linux: Install Wine (`brew install --cask wine-stable` on macOS)
   - For Linux builds on Windows: Consider using WSL or a Docker container

3. **Memory issues during build**
   - Increase Node.js memory limit: `NODE_OPTIONS=--max_old_space_size=4096 npm run build`

4. **Linux packaging errors on non-Linux platforms**
   - Missing `rpmbuild` for RPM packages
   - Missing `makepkg` for Pacman packages
   - Solution: Use the Docker-based build script (`npm run build:linux-docker`), which has all necessary tools pre-installed