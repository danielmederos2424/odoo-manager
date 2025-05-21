#!/bin/bash
# This script helps generate the required icon formats for all platforms

# Check if source icon is provided
if [ "$#" -ne 1 ]; then
    echo "Usage: $0 <source_icon>"
    echo "Source icon should be a high-resolution PNG or SVG file"
    exit 1
fi

SOURCE_ICON=$1
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMP_DIR="${SCRIPT_DIR}/temp"
mkdir -p "${TEMP_DIR}"

# Check if source icon exists
if [ ! -f "$SOURCE_ICON" ]; then
    echo "Source icon file not found: $SOURCE_ICON"
    exit 1
fi

# Check dependencies
check_command() {
    if ! command -v $1 &> /dev/null; then
        echo "$1 is required but not installed. Please install it first."
        exit 1
    fi
}

# Check for ImageMagick - prefer magick but fall back to convert
if command -v magick &> /dev/null; then
    CONVERT_CMD="magick"
    echo "Using ImageMagick v7 (magick command)"
else
    check_command "convert"
    CONVERT_CMD="convert"
    echo "Using ImageMagick v6 (convert command)"
fi

check_command "sips"     # macOS image processing tool

# Handle SVG input by converting to PNG first
TEMP_PNG="${TEMP_DIR}/temp_source.png"
FILE_EXT="${SOURCE_ICON##*.}"
FILE_EXT_LOWER=$(echo "$FILE_EXT" | tr '[:upper:]' '[:lower:]')

if [ "$FILE_EXT_LOWER" = "svg" ]; then
    echo "Converting SVG to PNG..."
    ${CONVERT_CMD} "${SOURCE_ICON}" -resize 1024x1024 "${TEMP_PNG}"
    SOURCE_ICON="${TEMP_PNG}"
fi

echo "Generating icon files for all platforms..."

# Create macOS .icns file
echo "Generating macOS icon..."
mkdir -p "${SCRIPT_DIR}/MyIcon.iconset"
sips -z 16 16 "${SOURCE_ICON}" --out "${SCRIPT_DIR}/MyIcon.iconset/icon_16x16.png"
sips -z 32 32 "${SOURCE_ICON}" --out "${SCRIPT_DIR}/MyIcon.iconset/icon_16x16@2x.png"
sips -z 32 32 "${SOURCE_ICON}" --out "${SCRIPT_DIR}/MyIcon.iconset/icon_32x32.png"
sips -z 64 64 "${SOURCE_ICON}" --out "${SCRIPT_DIR}/MyIcon.iconset/icon_32x32@2x.png"
sips -z 128 128 "${SOURCE_ICON}" --out "${SCRIPT_DIR}/MyIcon.iconset/icon_128x128.png"
sips -z 256 256 "${SOURCE_ICON}" --out "${SCRIPT_DIR}/MyIcon.iconset/icon_128x128@2x.png"
sips -z 256 256 "${SOURCE_ICON}" --out "${SCRIPT_DIR}/MyIcon.iconset/icon_256x256.png"
sips -z 512 512 "${SOURCE_ICON}" --out "${SCRIPT_DIR}/MyIcon.iconset/icon_256x256@2x.png"
sips -z 512 512 "${SOURCE_ICON}" --out "${SCRIPT_DIR}/MyIcon.iconset/icon_512x512.png"
sips -z 1024 1024 "${SOURCE_ICON}" --out "${SCRIPT_DIR}/MyIcon.iconset/icon_512x512@2x.png"
iconutil -c icns "${SCRIPT_DIR}/MyIcon.iconset" -o "${SCRIPT_DIR}/icon.icns"
rm -rf "${SCRIPT_DIR}/MyIcon.iconset"

# Create Windows .ico file
echo "Generating Windows icon..."
${CONVERT_CMD} "${SOURCE_ICON}" -define icon:auto-resize=256,128,64,48,32,16 "${SCRIPT_DIR}/icon.ico"

# Create Linux PNG files with various sizes
echo "Generating Linux icons..."
mkdir -p "${SCRIPT_DIR}/icons"
${CONVERT_CMD} "${SOURCE_ICON}" -resize 16x16 "${SCRIPT_DIR}/icons/16x16.png"
${CONVERT_CMD} "${SOURCE_ICON}" -resize 32x32 "${SCRIPT_DIR}/icons/32x32.png"
${CONVERT_CMD} "${SOURCE_ICON}" -resize 48x48 "${SCRIPT_DIR}/icons/48x48.png"
${CONVERT_CMD} "${SOURCE_ICON}" -resize 64x64 "${SCRIPT_DIR}/icons/64x64.png"
${CONVERT_CMD} "${SOURCE_ICON}" -resize 128x128 "${SCRIPT_DIR}/icons/128x128.png"
${CONVERT_CMD} "${SOURCE_ICON}" -resize 256x256 "${SCRIPT_DIR}/icons/256x256.png"
${CONVERT_CMD} "${SOURCE_ICON}" -resize 512x512 "${SCRIPT_DIR}/icons/512x512.png"
${CONVERT_CMD} "${SOURCE_ICON}" -resize 1024x1024 "${SCRIPT_DIR}/icons/1024x1024.png"

# Clean up temporary files
rm -rf "${TEMP_DIR}"

echo "All icon formats have been generated successfully!"
echo "- macOS: ${SCRIPT_DIR}/icon.icns"
echo "- Windows: ${SCRIPT_DIR}/icon.ico"
echo "- Linux: ${SCRIPT_DIR}/icons/ directory with PNG files"