# Icon Files for Platform Builds

This directory contains the icon files needed for building installers for different platforms.

## Required Files

1. **macOS**: 
   - `icon.icns` - macOS app icon (can be created from a 1024x1024 PNG using `iconutil`)

2. **Windows**:
   - `icon.ico` - Windows app icon

3. **Linux**:
   - For Linux AppImage and other formats, create PNG files with specific sizes in this format:
   - `/icons/16x16.png`
   - `/icons/32x32.png`
   - `/icons/48x48.png`
   - `/icons/64x64.png`
   - `/icons/128x128.png`
   - `/icons/256x256.png`
   - `/icons/512x512.png`

## Creating Icons from Source

You can use the SVG icon from `/public/favicon.svg` as the source for all platform icons.

### For macOS (.icns)

1. Create a directory structure:
   ```
   mkdir -p MyIcon.iconset
   ```

2. Generate PNG files at different sizes:
   ```
   sips -z 16 16 source.png --out MyIcon.iconset/icon_16x16.png
   sips -z 32 32 source.png --out MyIcon.iconset/icon_16x16@2x.png
   sips -z 32 32 source.png --out MyIcon.iconset/icon_32x32.png
   sips -z 64 64 source.png --out MyIcon.iconset/icon_32x32@2x.png
   sips -z 128 128 source.png --out MyIcon.iconset/icon_128x128.png
   sips -z 256 256 source.png --out MyIcon.iconset/icon_128x128@2x.png
   sips -z 256 256 source.png --out MyIcon.iconset/icon_256x256.png
   sips -z 512 512 source.png --out MyIcon.iconset/icon_256x256@2x.png
   sips -z 512 512 source.png --out MyIcon.iconset/icon_512x512.png
   sips -z 1024 1024 source.png --out MyIcon.iconset/icon_512x512@2x.png
   ```

3. Convert to .icns:
   ```
   iconutil -c icns MyIcon.iconset -o icon.icns
   ```

### For Windows (.ico)

Use an online converter or tools like ImageMagick to create a multi-sized .ico file from your source image.

Example with ImageMagick:
```
convert source.png -define icon:auto-resize=256,128,64,48,32,16 icon.ico
```

### For Linux

Create PNG files at required sizes and place them in the `/build/icons/` directory following the naming convention (e.g., `16x16.png`, `32x32.png`, etc.).

Example with ImageMagick:
```
mkdir -p icons
convert source.png -resize 16x16 icons/16x16.png
convert source.png -resize 32x32 icons/32x32.png
convert source.png -resize 48x48 icons/48x48.png
convert source.png -resize 64x64 icons/64x64.png
convert source.png -resize 128x128 icons/128x128.png
convert source.png -resize 256x256 icons/256x256.png
convert source.png -resize 512x512 icons/512x512.png
```