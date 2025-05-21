# Release Process Guide

This document outlines the process for creating and publishing releases of the Odoo Manager application.

## Release Preparation

1. **Update Version Number**
   - Update the version number in `package.json` following semantic versioning principles
   - Ensure the changelog is updated with all notable changes since the last release

2. **Test the Application**
   - Run the application and ensure all features are working correctly
   - Test the manual update check functionality
   - Test on multiple platforms if possible (Windows, macOS, Linux)

## Building Release Installers

### Prerequisites

- Required tools:
  - Node.js and npm
  - Wine (if building Windows packages on macOS/Linux)
  - Icon files in the appropriate formats (see icon generation script)

### Building Installers for All Platforms

```bash
# Clean previous build artifacts
rm -rf dist dist-electron release

# Build for all platforms
npm run build:all

# Build for specific platforms
npm run build:mac
npm run build:win
npm run build:linux
```

## Manual Release Process

1. Build installers for all desired platforms 
2. Create a GitHub release manually:
   - Tag the release with the version number: e.g., `v1.2.0`
   - Title the release with the version: e.g., "Odoo Manager v1.2.0"
   - Include release notes from the changelog
   - Upload all installer files from the `release` directory

## Release Notes Format

When writing release notes, follow this format:

```markdown
## What's New
- Feature: Added new feature X
- Feature: Improved Y functionality

## Improvements
- Improved performance when loading large instances
- Enhanced UI for container logs view

## Bug Fixes
- Fixed issue with instance creation
- Resolved problem with database connections

## Technical Updates
- Updated dependencies
- Improved error handling
```

## Release Distribution

Since the application uses manual updates, ensure:

1. The GitHub release includes all artifacts for each platform
2. The download URLs follow a consistent pattern that matches what the application expects
3. The release body/description contains proper markdown-formatted release notes

## Post-Release

1. Verify the release was published correctly on GitHub
2. Test manual update functionality by checking for updates in the application
3. Monitor for any issues reported by users
4. Begin the next development cycle

## Troubleshooting

### Common Build Issues

1. **Icon generation problems**
   - Verify ImageMagick is installed: `convert --version`
   - Ensure the source icon is high resolution (at least 1024x1024px)

2. **Cross-platform build errors**
   - For Windows builds on macOS/Linux: Verify Wine is installed correctly
   - For Linux builds on Windows: Consider using WSL or a Docker container

3. **Release artifact naming**
   - Ensure release artifacts follow the expected naming convention for manual updates

## Icon Generation Reference

Remember to generate proper icons for each platform before building installers:

```bash
# From the project root directory
cd build
./generate-icons.sh /path/to/source/high-res-icon.png
```