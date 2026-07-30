# MovieCreator Project Guidelines & Integrated Tools

## Integrated Sub-tools

### MP4 to SpriteSheet Studio (`tools/mp4_to_sprite/`)
- **Overview**: Converts MP4 video segments into transparent PNG sprite sheets, Cocos Creator `.plist`, and Unity `.json` metadata with automatic black background chroma keying, crop box resizing, frame-based range selection, and color/sharpen filters.
- **Launch Script**: `Z:\MovieCreator\open_sprite_studio.bat`
- **Web App**: `tools/mp4_to_sprite/index.html`
- **CLI Script**: `tools/mp4_to_sprite/mp4_to_sprite.py`
- **Integration Spec**: Detailed JavaScript functions and algorithms are documented in `tools/mp4_to_sprite/INTEGRATION_GUIDE.md`. When requested to embed sprite generation into MovieCreator engine (`src/engine/`), reuse functions from `tools/mp4_to_sprite/app.js`.
