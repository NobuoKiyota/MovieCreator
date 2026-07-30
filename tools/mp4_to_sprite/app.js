/**
 * MP4 to SpriteSheet Studio - Core Application Script
 * Fixed Crop Box Offset Alignment (Preventing Top Cut-off) & Frame Padding Option.
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const dropZone = document.getElementById('drop-zone');
  const dropPrompt = document.getElementById('drop-prompt');
  const fileInput = document.getElementById('file-input');
  const videoContainer = document.getElementById('video-container');
  const videoWrapper = document.getElementById('video-wrapper');
  const video = document.getElementById('video-player');
  const cropCanvas = document.getElementById('crop-canvas');
  const cropRectEl = document.getElementById('crop-rect');
  const cropDimensionsEl = document.getElementById('crop-dimensions');
  
  const videoInfoEl = document.getElementById('video-info');
  const videoControls = document.getElementById('video-controls');
  const btnPlay = document.getElementById('btn-play');
  const btnPrevFrame = document.getElementById('btn-prev-frame');
  const btnNextFrame = document.getElementById('btn-next-frame');
  const timeDisplay = document.getElementById('time-display');
  const seekBar = document.getElementById('seek-bar');
  const rangeHighlight = document.getElementById('range-highlight');
  
  const btnSetIn = document.getElementById('btn-set-in');
  const btnSetOut = document.getElementById('btn-set-out');
  const btnResetCrop = document.getElementById('btn-reset-crop');
  
  // Advanced Range Controls
  const inFrameInput = document.getElementById('in-frame');
  const inSecInput = document.getElementById('in-sec');
  const outFrameInput = document.getElementById('out-frame');
  const outSecInput = document.getElementById('out-sec');
  const fpsInput = document.getElementById('fps-input');
  const colsInput = document.getElementById('cols-input');
  const paddingInput = document.getElementById('padding-input');

  // Keying Controls
  const thresholdRange = document.getElementById('threshold-range');
  const thresholdVal = document.getElementById('threshold-val');
  const softnessRange = document.getElementById('softness-range');
  const softnessVal = document.getElementById('softness-val');

  // Color & Sharpen Controls
  const brightnessRange = document.getElementById('brightness-range');
  const brightnessVal = document.getElementById('brightness-val');
  const contrastRange = document.getElementById('contrast-range');
  const contrastVal = document.getElementById('contrast-val');
  const saturationRange = document.getElementById('saturation-range');
  const saturationVal = document.getElementById('saturation-val');
  const sharpenRange = document.getElementById('sharpen-range');
  const sharpenVal = document.getElementById('sharpen-val');
  const hueRange = document.getElementById('hue-range');
  const hueVal = document.getElementById('hue-val');
  const btnResetColor = document.getElementById('btn-reset-color');

  // Preview & Export Elements
  const previewWrapper = document.getElementById('preview-wrapper');
  const previewCanvas = document.getElementById('preview-canvas');
  const previewCtx = previewCanvas.getContext('2d', { willReadFrequently: true });
  
  const btnGenerate = document.getElementById('btn-generate');
  const resultSection = document.getElementById('result-section');
  const resultInfoEl = document.getElementById('result-info');
  const resultSheetImg = document.getElementById('result-sheet-img');
  
  const btnDlPng = document.getElementById('btn-dl-png');
  const btnDlPlist = document.getElementById('btn-dl-plist');
  const btnDlJson = document.getElementById('btn-dl-json');
  const btnDlZip = document.getElementById('btn-dl-zip');

  // Application State
  let videoFile = null;
  let videoDuration = 0;
  let nativeFps = 30;
  let totalFrames = 0;
  let inTime = 0;
  let outTime = 0;
  
  // Crop Box Drag & Resize State
  let cropState = null; // { displayX, displayY, displayW, displayH, realX, realY, realW, realH }
  let activeInteraction = null; // null | 'create' | 'move' | 'nw' | 'ne' | 'sw' | 'se'
  let dragStartPos = { x: 0, y: 0 };
  let initialCropState = null;
  
  // Generated Result Cache
  let generatedResult = {
    pngDataUrl: null,
    plistText: null,
    jsonText: null,
    frames: [],
    filenameBase: 'sprite_sheet'
  };

  // --- API Helper for file:// protocol fallback ---
  function getApiUrl(endpoint) {
    if (window.location.protocol === 'file:') {
      return `http://localhost:5173${endpoint}`;
    }
    return endpoint;
  }

  // --- Open forSprite Folder & Viewer ---
  const btnOpenForSprite = document.getElementById('btn-open-forsprite');
  if (btnOpenForSprite) {
    btnOpenForSprite.addEventListener('click', async () => {
      try {
        await fetch(getApiUrl('/api/open-folder?target=forSprite'), { method: 'POST' });
      } catch (err) {
        console.error('Failed to open forSprite folder:', err);
      }
    });
  }

  const btnOpenViewerTool = document.getElementById('btn-open-viewer-tool');
  if (btnOpenViewerTool) {
    btnOpenViewerTool.addEventListener('click', async () => {
      try {
        await fetch(getApiUrl('/api/open-sprite-viewer'), { method: 'POST' });
      } catch (err) {
        console.error('Failed to open Sprite Viewer:', err);
      }
    });
  }

  // --- Hierarchy Sidebar Logic ---
  const hierarchyProjectListEl = document.getElementById('hierarchy-project-list');
  const btnRefreshHierarchyEl = document.getElementById('btn-refresh-hierarchy');

  if (btnRefreshHierarchyEl) {
    btnRefreshHierarchyEl.addEventListener('click', refreshForSpriteHierarchy);
  }

  async function refreshForSpriteHierarchy() {
    if (!hierarchyProjectListEl) return;
    try {
      const res = await fetch(getApiUrl('/api/forsprite-files'));
      const data = await res.json();
      if (data.success && data.projects) {
        renderHierarchyList(data.projects, data.standalonePngs, false);
        return;
      }
    } catch (err) {
      console.warn('API server offline, falling back to LocalStorage:', err);
    }

    // LocalStorage Fallback (開発サーバー非稼働時)
    try {
      const localStore = JSON.parse(localStorage.getItem('moviecreator_forsprite_projects') || '{}');
      const localProjects = Object.keys(localStore).map(base => {
        const item = localStore[base];
        return {
          base,
          isLocal: true,
          config: item.config,
          pngFile: item.pngDataUrl ? `${base}.png` : null,
          plistFile: item.plistText ? `${base}.plist` : null,
          jsonFile: item.jsonText ? `${base}.json` : null
        };
      });
      renderHierarchyList(localProjects, [], true);
    } catch (e) {
      hierarchyProjectListEl.innerHTML = `<div style="font-size:0.8rem; color:#64748b; text-align:center; padding:1rem 0;">保存プロジェクトがありません</div>`;
    }
  }

  function renderHierarchyList(projects, standalonePngs, isOffline = false) {
    hierarchyProjectListEl.innerHTML = '';

    if (projects.length === 0 && (!standalonePngs || standalonePngs.length === 0)) {
      hierarchyProjectListEl.innerHTML = `<div style="font-size:0.8rem; color:#64748b; text-align:center; padding:1rem 0;">保存プロジェクトがありません</div>`;
      return;
    }

    if (isOffline) {
      const offlineNotice = document.createElement('div');
      offlineNotice.style.cssText = 'font-size:0.7rem; color:#f59e0b; padding:0.2rem 0.4rem; background:rgba(245,158,11,0.1); border-radius:4px; margin-bottom:0.4rem;';
      offlineNotice.textContent = '⚡ ブラウザローカル保存から表示中';
      hierarchyProjectListEl.appendChild(offlineNotice);
    }

    projects.forEach(proj => {
      const card = document.createElement('div');
      card.className = 'hierarchy-item';
      card.style.cssText = `
        background: rgba(30, 27, 55, 0.6);
        border: 1px solid rgba(168, 85, 247, 0.2);
        border-radius: 8px;
        padding: 0.5rem 0.6rem;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
      `;
      card.innerHTML = `
        <div style="font-weight: 600; font-size: 0.82rem; color: #f3f4f6; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">📄 ${proj.base}</div>
        <div style="font-size: 0.7rem; color: #94a3b8; display: flex; gap: 0.3rem;">
          ${proj.pngFile ? '<span style="color:#10b981;">PNG</span>' : ''}
          ${proj.plistFile ? '<span style="color:#06b6d4;">PLIST</span>' : ''}
          ${proj.jsonFile ? '<span style="color:#a855f7;">JSON</span>' : ''}
        </div>
      `;

      card.addEventListener('mouseenter', () => { card.style.background = 'rgba(168, 85, 247, 0.25)'; });
      card.addEventListener('mouseleave', () => { card.style.background = 'rgba(30, 27, 55, 0.6)'; });

      card.addEventListener('click', async () => {
        try {
          if (proj.isLocal && proj.config) {
            applyProjectConfig(proj.config);
            alert(`✅ ローカル保持設定を復元しました: ${proj.base}`);
          } else {
            const res = await fetch(getApiUrl(`/api/load-forsprite-file?file=${encodeURIComponent(proj.configFile)}`));
            const cfg = await res.json();
            applyProjectConfig(cfg);
            alert(`✅ プロジェクト設定を復元しました: ${proj.base}`);
          }
        } catch (err) {
          alert(`設定の読み込みに失敗しました: ${err.message}`);
        }
      });

      hierarchyProjectListEl.appendChild(card);
    });
  }

  refreshForSpriteHierarchy();

  // --- Save / Load & Ctrl+S Shortcut ---
  const btnSaveCtrlS = document.getElementById('btn-save-project-ctrls');
  const btnLoadConfig = document.getElementById('btn-load-config-file');
  const configFileInput = document.getElementById('config-file-input');

  async function saveSpriteProject() {
    const config = {
      filenameBase: generatedResult.filenameBase || 'sprite_sheet',
      inTime,
      outTime,
      nativeFps,
      targetFps: parseInt(fpsInput.value, 10) || 15,
      cols: parseInt(colsInput.value, 10) || 0,
      padding: parseInt(paddingInput.value, 10) || 0,
      cropState: cropState ? { ...cropState } : null,
      keying: {
        threshold: parseInt(thresholdRange.value, 10),
        softness: parseInt(softnessRange.value, 10)
      },
      filters: {
        brightness: parseInt(brightnessRange.value, 10),
        contrast: parseInt(contrastRange.value, 10),
        saturation: parseInt(saturationRange.value, 10),
        sharpen: parseFloat(sharpenRange.value),
        hue: parseInt(hueRange.value, 10)
      },
      savedAt: new Date().toISOString()
    };

    const payload = {
      filenameBase: config.filenameBase,
      config,
      pngDataUrl: generatedResult.pngDataUrl,
      plistText: generatedResult.plistText,
      jsonText: generatedResult.jsonText
    };

    // Save to LocalStorage cache (Offline fallback)
    try {
      const localStore = JSON.parse(localStorage.getItem('moviecreator_forsprite_projects') || '{}');
      localStore[config.filenameBase] = payload;
      localStorage.setItem('moviecreator_forsprite_projects', JSON.stringify(localStore));
    } catch (e) {
      console.warn('Failed to save to localStorage:', e);
    }

    try {
      if (btnSaveCtrlS) btnSaveCtrlS.textContent = '⏳ 保存中...';
      const res = await fetch(getApiUrl('/api/save-sprite-project'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        alert(`✅ 保存完了!\n保存先: forSprite/\n保存ファイル:\n • ${data.savedFiles.join('\n • ')}`);
        refreshForSpriteHierarchy();
      } else {
        alert(`❌ 保存エラー: ${data.error}`);
      }
    } catch (err) {
      console.warn('API save offline, saved to LocalStorage cache:', err);
      alert(`✅ ローカル保存完了 (ブラウザ記憶領域に保存されました)`);
      refreshForSpriteHierarchy();
    } finally {
      if (btnSaveCtrlS) btnSaveCtrlS.textContent = '💾 保存 (Ctrl+S)';
    }
  }

  if (btnSaveCtrlS) {
    btnSaveCtrlS.addEventListener('click', saveSpriteProject);
  }

  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      saveSpriteProject();
    }
  });

  if (btnLoadConfig && configFileInput) {
    btnLoadConfig.addEventListener('click', () => configFileInput.click());
    configFileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = (evt) => {
          try {
            const config = JSON.parse(evt.target.result);
            applyProjectConfig(config);
            alert(`✅ 設定を読み込みました: ${file.name}`);
          } catch (err) {
            alert(`設定ファイルの読み込みに失敗しました: ${err.message}`);
          }
        };
        reader.readAsText(file);
      }
    });
  }

  function applyProjectConfig(cfg) {
    if (!cfg) return;
    if (cfg.filenameBase) generatedResult.filenameBase = cfg.filenameBase;
    if (typeof cfg.inTime === 'number') inTime = cfg.inTime;
    if (typeof cfg.outTime === 'number') outTime = cfg.outTime;
    if (typeof cfg.targetFps === 'number') fpsInput.value = cfg.targetFps;
    if (typeof cfg.cols === 'number') colsInput.value = cfg.cols;
    if (typeof cfg.padding === 'number') paddingInput.value = cfg.padding;

    if (cfg.keying) {
      if (typeof cfg.keying.threshold === 'number') {
        thresholdRange.value = cfg.keying.threshold;
        thresholdVal.textContent = cfg.keying.threshold;
      }
      if (typeof cfg.keying.softness === 'number') {
        softnessRange.value = cfg.keying.softness;
        softnessVal.textContent = cfg.keying.softness;
      }
    }

    if (cfg.filters) {
      if (typeof cfg.filters.brightness === 'number') {
        brightnessRange.value = cfg.filters.brightness;
        brightnessVal.textContent = `${cfg.filters.brightness}%`;
      }
      if (typeof cfg.filters.contrast === 'number') {
        contrastRange.value = cfg.filters.contrast;
        contrastVal.textContent = `${cfg.filters.contrast}%`;
      }
      if (typeof cfg.filters.saturation === 'number') {
        saturationRange.value = cfg.filters.saturation;
        saturationVal.textContent = `${cfg.filters.saturation}%`;
      }
      if (typeof cfg.filters.sharpen === 'number') {
        sharpenRange.value = cfg.filters.sharpen;
        sharpenVal.textContent = cfg.filters.sharpen;
      }
      if (typeof cfg.filters.hue === 'number') {
        hueRange.value = cfg.filters.hue;
        hueVal.textContent = `${cfg.filters.hue}°`;
      }
    }

    if (cfg.cropState) {
      cropState = { ...cfg.cropState };
      renderCropRect();
    }

    updateRangeInputs();
    updateTimelineHighlight();
    updatePreview();
  }

  // --- Tab Switching ---
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      e.target.classList.add('active');
      const tabId = e.target.dataset.tab;
      document.getElementById(tabId).classList.add('active');
    });
  });

  // --- 1. File Load & Video Init ---
  ['dragenter', 'dragover'].forEach(evt => {
    dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropZone.classList.add('drag-over');
    });
  });

  ['dragleave', 'drop'].forEach(evt => {
    dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
    });
  });

  dropZone.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type.startsWith('video/')) {
      loadVideoFile(files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      loadVideoFile(e.target.files[0]);
    }
  });

  function loadVideoFile(file) {
    videoFile = file;
    const url = URL.createObjectURL(file);
    video.src = url;
    
    const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || 'video';
    generatedResult.filenameBase = `${baseName}_sprite`;
    
    dropPrompt.classList.add('hidden');
    videoContainer.classList.remove('hidden');
    videoControls.classList.remove('hidden');
    btnGenerate.disabled = false;
    
    videoInfoEl.textContent = `${file.name} (${(file.size / (1024 * 1024)).toFixed(1)} MB)`;
  }

  video.addEventListener('loadedmetadata', () => {
    videoDuration = video.duration;
    nativeFps = 30; 
    totalFrames = Math.round(videoDuration * nativeFps);
    
    inTime = 0;
    outTime = videoDuration;
    
    updateRangeInputs();
    updateTimeDisplay();
    updateTimelineHighlight();
    setupOverlayCanvas();
    resetCrop();
    updatePreview();
  });

  // --- 2. Video Controls & Frame Seeking ---
  btnPlay.addEventListener('click', () => {
    if (video.paused) {
      video.play();
      btnPlay.textContent = '⏸';
    } else {
      video.pause();
      btnPlay.textContent = '▶';
    }
  });

  btnPrevFrame.addEventListener('click', () => {
    video.pause();
    btnPlay.textContent = '▶';
    stepFrame(-1);
  });

  btnNextFrame.addEventListener('click', () => {
    video.pause();
    btnPlay.textContent = '▶';
    stepFrame(1);
  });

  function stepFrame(deltaFrames) {
    const currentFrame = Math.round(video.currentTime * nativeFps);
    const targetFrame = Math.max(0, Math.min(totalFrames, currentFrame + deltaFrames));
    video.currentTime = targetFrame / nativeFps;
  }

  video.addEventListener('timeupdate', () => {
    if (!seekBar.dataset.dragging) {
      seekBar.value = (video.currentTime / videoDuration) * 100;
      updateTimeDisplay();
      updatePreview();
    }
  });

  seekBar.addEventListener('input', () => {
    seekBar.dataset.dragging = 'true';
    const targetTime = (seekBar.value / 100) * videoDuration;
    video.currentTime = targetTime;
    updateTimeDisplay();
    updatePreview();
  });

  seekBar.addEventListener('change', () => {
    delete seekBar.dataset.dragging;
  });

  btnSetIn.addEventListener('click', () => {
    inTime = video.currentTime;
    if (inTime >= outTime) outTime = Math.min(videoDuration, inTime + 1.0);
    updateRangeInputs();
    updateTimelineHighlight();
  });

  btnSetOut.addEventListener('click', () => {
    outTime = video.currentTime;
    if (outTime <= inTime) inTime = Math.max(0, outTime - 1.0);
    updateRangeInputs();
    updateTimelineHighlight();
  });

  inFrameInput.addEventListener('change', () => {
    const frame = Math.max(0, Math.min(totalFrames, parseInt(inFrameInput.value, 10) || 0));
    inTime = frame / nativeFps;
    updateRangeInputs();
    updateTimelineHighlight();
  });

  inSecInput.addEventListener('change', () => {
    inTime = Math.max(0, Math.min(videoDuration, parseFloat(inSecInput.value) || 0));
    updateRangeInputs();
    updateTimelineHighlight();
  });

  outFrameInput.addEventListener('change', () => {
    const frame = Math.max(0, Math.min(totalFrames, parseInt(outFrameInput.value, 10) || totalFrames));
    outTime = frame / nativeFps;
    updateRangeInputs();
    updateTimelineHighlight();
  });

  outSecInput.addEventListener('change', () => {
    outTime = Math.max(0, Math.min(videoDuration, parseFloat(outSecInput.value) || videoDuration));
    updateRangeInputs();
    updateTimelineHighlight();
  });

  function updateRangeInputs() {
    const inFrame = Math.round(inTime * nativeFps);
    const outFrame = Math.round(outTime * nativeFps);
    
    inFrameInput.value = inFrame;
    inSecInput.value = inTime.toFixed(2);
    outFrameInput.value = outFrame;
    outSecInput.value = outTime.toFixed(2);
  }

  function updateTimeDisplay() {
    const currentFrame = Math.round(video.currentTime * nativeFps);
    timeDisplay.textContent = `${formatTime(video.currentTime)} (F: ${currentFrame} / ${totalFrames})`;
  }

  function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 100);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
  }

  function updateTimelineHighlight() {
    const leftPct = (inTime / videoDuration) * 100;
    const rightPct = 100 - (outTime / videoDuration) * 100;
    rangeHighlight.style.left = `${leftPct}%`;
    rangeHighlight.style.right = `${rightPct}%`;
  }

  // --- 3. Crop Box Resizing & Dragging Logic (100% Video Matched) ---
  function setupOverlayCanvas() {
    cropCanvas.width = video.clientWidth;
    cropCanvas.height = video.clientHeight;
  }

  window.addEventListener('resize', () => {
    if (video.videoWidth) {
      setupOverlayCanvas();
      syncCropDisplayFromReal();
      renderCropRect();
    }
  });

  // Mouse Down on Canvas
  cropCanvas.addEventListener('mousedown', (e) => {
    const rect = cropCanvas.getBoundingClientRect();
    const startX = e.clientX - rect.left;
    const startY = e.clientY - rect.top;
    
    activeInteraction = 'create';
    dragStartPos = { x: startX, y: startY };
    
    cropState = {
      displayX: startX,
      displayY: startY,
      displayW: 0,
      displayH: 0
    };
    renderCropRect();
  });

  // Mouse Down on Crop Rect or Handles
  cropRectEl.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    const handleType = e.target.dataset.handle;
    
    if (handleType) {
      activeInteraction = handleType;
    } else {
      activeInteraction = 'move';
    }
    
    dragStartPos = { x: e.clientX, y: e.clientY };
    initialCropState = { ...cropState };
  });

  window.addEventListener('mousemove', (e) => {
    if (!activeInteraction) return;
    const rect = cropCanvas.getBoundingClientRect();
    
    if (activeInteraction === 'create') {
      const currentX = Math.max(0, Math.min(cropCanvas.width, e.clientX - rect.left));
      const currentY = Math.max(0, Math.min(cropCanvas.height, e.clientY - rect.top));
      
      const x = Math.min(dragStartPos.x, currentX);
      const y = Math.min(dragStartPos.y, currentY);
      const w = Math.abs(currentX - dragStartPos.x);
      const h = Math.abs(currentY - dragStartPos.y);
      
      cropState = { displayX: x, displayY: y, displayW: w, displayH: h };
    } 
    else if (activeInteraction === 'move') {
      const dx = e.clientX - dragStartPos.x;
      const dy = e.clientY - dragStartPos.y;
      
      let newX = initialCropState.displayX + dx;
      let newY = initialCropState.displayY + dy;
      
      newX = Math.max(0, Math.min(cropCanvas.width - initialCropState.displayW, newX));
      newY = Math.max(0, Math.min(cropCanvas.height - initialCropState.displayH, newY));
      
      cropState.displayX = newX;
      cropState.displayY = newY;
    }
    else {
      const dx = e.clientX - dragStartPos.x;
      const dy = e.clientY - dragStartPos.y;
      let { displayX: x, displayY: y, displayW: w, displayH: h } = initialCropState;
      
      if (activeInteraction.includes('e')) w = Math.max(10, Math.min(cropCanvas.width - x, initialCropState.displayW + dx));
      if (activeInteraction.includes('s')) h = Math.max(10, Math.min(cropCanvas.height - y, initialCropState.displayH + dy));
      if (activeInteraction.includes('w')) {
        const possibleW = initialCropState.displayW - dx;
        if (possibleW > 10) {
          x = initialCropState.displayX + dx;
          w = possibleW;
        }
      }
      if (activeInteraction.includes('n')) {
        const possibleH = initialCropState.displayH - dy;
        if (possibleH > 10) {
          y = initialCropState.displayY + dy;
          h = possibleH;
        }
      }
      
      cropState = { displayX: x, displayY: y, displayW: w, displayH: h };
    }

    calculateVideoCropPixels();
    renderCropRect();
    updatePreview();
  });

  window.addEventListener('mouseup', () => {
    if (activeInteraction) {
      activeInteraction = null;
      document.body.style.cursor = 'default';
      if (!cropState || cropState.displayW < 10 || cropState.displayH < 10) {
        resetCrop();
      }
      updatePreview();
    }
  });

  btnResetCrop.addEventListener('click', () => {
    resetCrop();
    updatePreview();
  });

  // Mouse Wheel Zoom on Canvas
  cropCanvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (!cropState || !cropState.displayW || !cropState.displayH) return;

    const factor = e.deltaY < 0 ? 0.92 : 1.08;

    let newW = Math.round(cropState.displayW * factor);
    let newH = Math.round(cropState.displayH * factor);

    newW = Math.max(10, Math.min(newW, cropCanvas.width));
    newH = Math.max(10, Math.min(newH, cropCanvas.height));

    const centerX = cropState.displayX + cropState.displayW / 2;
    const centerY = cropState.displayY + cropState.displayH / 2;

    let newX = Math.round(centerX - newW / 2);
    let newY = Math.round(centerY - newH / 2);

    newX = Math.max(0, Math.min(newX, cropCanvas.width - newW));
    newY = Math.max(0, Math.min(newY, cropCanvas.height - newH));

    cropState.displayX = newX;
    cropState.displayY = newY;
    cropState.displayW = newW;
    cropState.displayH = newH;

    calculateVideoCropPixels();
    renderCropRect();
    updatePreview();
  }, { passive: false });

  function resetCrop() {
    cropState = null;
    cropRectEl.classList.add('hidden');
  }

  function calculateVideoCropPixels() {
    if (!cropState || !video.videoWidth) return;
    const scaleX = video.videoWidth / cropCanvas.width;
    const scaleY = video.videoHeight / cropCanvas.height;
    
    cropState.realX = Math.round(cropState.displayX * scaleX);
    cropState.realY = Math.round(cropState.displayY * scaleY);
    cropState.realW = Math.round(cropState.displayW * scaleX);
    cropState.realH = Math.round(cropState.displayH * scaleY);
  }

  function syncCropDisplayFromReal() {
    if (!cropState || !cropState.realW || !video.videoWidth) return;
    const scaleX = cropCanvas.width / video.videoWidth;
    const scaleY = cropCanvas.height / video.videoHeight;
    
    cropState.displayX = cropState.realX * scaleX;
    cropState.displayY = cropState.realY * scaleY;
    cropState.displayW = cropState.realW * scaleX;
    cropState.displayH = cropState.realH * scaleY;
  }

  function renderCropRect() {
    if (!cropState || cropState.displayW < 5 || cropState.displayH < 5) {
      cropRectEl.classList.add('hidden');
      return;
    }
    cropRectEl.classList.remove('hidden');
    cropRectEl.style.left = `${cropState.displayX}px`;
    cropRectEl.style.top = `${cropState.displayY}px`;
    cropRectEl.style.width = `${cropState.displayW}px`;
    cropRectEl.style.height = `${cropState.displayH}px`;
    
    if (cropState.realW && cropState.realH) {
      cropDimensionsEl.textContent = `${cropState.realW} x ${cropState.realH} px`;
    } else {
      cropDimensionsEl.textContent = `${Math.round(cropState.displayW)} x ${Math.round(cropState.displayH)}`;
    }
  }

  // --- 4. Chroma Key, Color Filters & Live Preview ---
  thresholdRange.addEventListener('input', () => {
    thresholdVal.textContent = thresholdRange.value;
    updatePreview();
  });

  softnessRange.addEventListener('input', () => {
    softnessVal.textContent = softnessRange.value;
    updatePreview();
  });

  brightnessRange.addEventListener('input', () => {
    brightnessVal.textContent = `${brightnessRange.value}%`;
    updatePreview();
  });

  contrastRange.addEventListener('input', () => {
    contrastVal.textContent = `${contrastRange.value}%`;
    updatePreview();
  });

  saturationRange.addEventListener('input', () => {
    saturationVal.textContent = `${saturationRange.value}%`;
    updatePreview();
  });

  sharpenRange.addEventListener('input', () => {
    sharpenVal.textContent = sharpenRange.value;
    updatePreview();
  });

  hueRange.addEventListener('input', () => {
    hueVal.textContent = `${hueRange.value}°`;
    updatePreview();
  });

  btnResetColor.addEventListener('click', () => {
    brightnessRange.value = 100; brightnessVal.textContent = '100%';
    contrastRange.value = 100; contrastVal.textContent = '100%';
    saturationRange.value = 100; saturationVal.textContent = '100%';
    sharpenRange.value = 0; sharpenVal.textContent = '0';
    hueRange.value = 0; hueVal.textContent = '0°';
    updatePreview();
  });

  document.querySelectorAll('.btn-bg').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.btn-bg').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      const bgType = e.target.dataset.bg;
      previewWrapper.className = `canvas-preview-wrapper ${bgType}-bg`;
      if (bgType === 'black') previewWrapper.style.backgroundColor = '#000';
      else if (bgType === 'white') previewWrapper.style.backgroundColor = '#fff';
      else previewWrapper.style.backgroundColor = '';
    });
  });

  function getCropSourceParams() {
    if (cropState && cropState.realW > 0 && cropState.realH > 0) {
      return {
        sx: Math.max(0, cropState.realX),
        sy: Math.max(0, cropState.realY),
        sw: Math.min(video.videoWidth - cropState.realX, cropState.realW),
        sh: Math.min(video.videoHeight - cropState.realY, cropState.realH)
      };
    }
    return {
      sx: 0,
      sy: 0,
      sw: video.videoWidth || 640,
      sh: video.videoHeight || 360
    };
  }

  function updatePreview() {
    if (!video.videoWidth) return;
    const { sx, sy, sw, sh } = getCropSourceParams();
    
    previewCanvas.width = sw;
    previewCanvas.height = sh;
    
    const brightness = brightnessRange.value;
    const contrast = contrastRange.value;
    const saturation = saturationRange.value;
    const hue = hueRange.value;
    
    previewCtx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) hue-rotate(${hue}deg)`;
    previewCtx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);
    previewCtx.filter = 'none';
    
    const sharpenAmount = parseFloat(sharpenRange.value);
    if (sharpenAmount > 0) {
      applySharpenFilter(previewCtx, sw, sh, sharpenAmount);
    }

    const threshold = parseInt(thresholdRange.value, 10);
    const softness = parseInt(softnessRange.value, 10);
    applyBlackChromaKey(previewCtx, sw, sh, threshold, softness);
  }

  function applySharpenFilter(ctx, w, h, amount) {
    const imgData = ctx.getImageData(0, 0, w, h);
    const src = imgData.data;
    const output = ctx.createImageData(w, h);
    const dst = output.data;
    
    const a = amount * 0.25;
    const kCenter = 1 + 4 * a;
    const kEdge = -a;

    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = (y * w + x) * 4;
        
        for (let c = 0; c < 3; c++) {
          const val = src[i + c] * kCenter +
            (src[((y - 1) * w + x) * 4 + c] +
             src[((y + 1) * w + x) * 4 + c] +
             src[(y * w + (x - 1)) * 4 + c] +
             src[(y * w + (x + 1)) * 4 + c]) * kEdge;
          
          dst[i + c] = Math.min(255, Math.max(0, val));
        }
        dst[i + 3] = src[i + 3];
      }
    }
    
    ctx.putImageData(output, 0, 0);
  }

  function applyBlackChromaKey(ctx, width, height, threshold, softness) {
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    const soft = Math.max(1, softness);
    
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      const maxVal = Math.max(r, g, b);
      
      let alpha = (maxVal - threshold) / soft;
      alpha = Math.min(1.0, Math.max(0.0, alpha));
      
      data[i + 3] = Math.round(alpha * 255);
      
      if (alpha > 0.01) {
        const factor = 1.0 / Math.max(alpha, 0.3);
        data[i] = Math.min(255, Math.round(r * factor));
        data[i + 1] = Math.min(255, Math.round(g * factor));
        data[i + 2] = Math.min(255, Math.round(b * factor));
      }
    }
    
    ctx.putImageData(imgData, 0, 0);
  }

  // --- 5. Sprite Sheet Generation Pipeline (with Padding Support) ---
  btnGenerate.addEventListener('click', async () => {
    if (!video.videoWidth) return;
    
    btnGenerate.disabled = true;
    btnGenerate.textContent = '⏳ 生成中... (全フレーム抽出＆アトラス生成中)';
    
    try {
      await generateSpriteSheet();
    } catch (err) {
      console.error(err);
      alert(`エラーが発生しました: ${err.message}`);
    } finally {
      btnGenerate.disabled = false;
      btnGenerate.textContent = '✨ スプライトシートを生成する';
    }
  });

  async function generateSpriteSheet() {
    const targetFps = parseInt(fpsInput.value, 10) || 15;
    const threshold = parseInt(thresholdRange.value, 10);
    const softness = parseInt(softnessRange.value, 10);
    let requestedCols = parseInt(colsInput.value, 10) || 0;
    const padding = parseInt(paddingInput.value, 10) || 0;
    
    const startTime = Math.min(inTime, outTime);
    const endTime = Math.max(inTime, outTime);
    const duration = endTime - startTime;
    
    if (duration <= 0) {
      throw new Error('抽出範囲が0秒以下です。IN点とOUT点を確認してください。');
    }

    const { sx, sy, sw, sh } = getCropSourceParams();
    const frameInterval = 1.0 / targetFps;
    
    const framesData = [];
    const wasPaused = video.paused;
    video.pause();

    // Iterate through time steps and capture frames
    for (let t = startTime; t <= endTime + 0.001; t += frameInterval) {
      video.currentTime = t;
      await new Promise(resolve => {
        const onSeeked = () => {
          video.removeEventListener('seeked', onSeeked);
          resolve();
        };
        video.addEventListener('seeked', onSeeked);
      });

      // Frame Canvas with Padding margin
      const frameCanvas = document.createElement('canvas');
      const cellW = sw + padding * 2;
      const cellH = sh + padding * 2;
      frameCanvas.width = cellW;
      frameCanvas.height = cellH;
      
      const fCtx = frameCanvas.getContext('2d', { willReadFrequently: true });
      
      const brightness = brightnessRange.value;
      const contrast = contrastRange.value;
      const saturation = saturationRange.value;
      const hue = hueRange.value;
      
      fCtx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) hue-rotate(${hue}deg)`;
      fCtx.drawImage(video, sx, sy, sw, sh, padding, padding, sw, sh);
      fCtx.filter = 'none';

      const sharpenAmount = parseFloat(sharpenRange.value);
      if (sharpenAmount > 0) {
        applySharpenFilter(fCtx, cellW, cellH, sharpenAmount);
      }
      
      applyBlackChromaKey(fCtx, cellW, cellH, threshold, softness);
      
      framesData.push(frameCanvas);
    }

    if (wasPaused) video.pause();

    const numFrames = framesData.length;
    if (numFrames === 0) throw new Error('抽出フレームがありません。');

    // Grid Dimensions
    let cols = requestedCols;
    if (cols <= 0) {
      cols = Math.ceil(Math.sqrt(numFrames));
    }
    const rows = Math.ceil(numFrames / cols);

    const cellWidth = sw + padding * 2;
    const cellHeight = sh + padding * 2;

    const sheetWidth = cols * cellWidth;
    const sheetHeight = rows * cellHeight;

    // Final Sprite Sheet Canvas
    const sheetCanvas = document.createElement('canvas');
    sheetCanvas.width = sheetWidth;
    sheetCanvas.height = sheetHeight;
    const sheetCtx = sheetCanvas.getContext('2d');

    const framesMeta = [];

    framesData.forEach((fCanvas, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const posX = col * cellWidth;
      const posY = row * cellHeight;
      
      sheetCtx.drawImage(fCanvas, posX, posY);

      const frameName = `frame_${String(idx).padStart(3, '0')}.png`;
      framesMeta.push({
        name: frameName,
        x: posX,
        y: posY,
        w: cellWidth,
        h: cellHeight,
        canvas: fCanvas
      });
    });

    const pngDataUrl = sheetCanvas.toDataURL('image/png');
    
    const plistText = generatePlistString(generatedResult.filenameBase + '.png', sheetWidth, sheetHeight, framesMeta);
    const jsonText = generateJsonString(generatedResult.filenameBase + '.png', sheetWidth, sheetHeight, framesMeta);

    generatedResult.pngDataUrl = pngDataUrl;
    generatedResult.plistText = plistText;
    generatedResult.jsonText = jsonText;
    generatedResult.frames = framesMeta;

    resultSheetImg.src = pngDataUrl;
    resultInfoEl.textContent = `${numFrames} Frames | ${cols}x${rows} Grid | ${sheetWidth}x${sheetHeight} px`;
    resultSection.classList.remove('hidden');
    resultSection.scrollIntoView({ behavior: 'smooth' });
  }

  // --- Meta Generators ---
  function generatePlistString(pngName, sheetW, sheetH, framesMeta) {
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n`;
    xml += `<plist version="1.0">\n`;
    xml += `  <dict>\n`;
    xml += `    <key>frames</key>\n`;
    xml += `    <dict>\n`;

    framesMeta.forEach(f => {
      xml += `      <key>${f.name}</key>\n`;
      xml += `      <dict>\n`;
      xml += `        <key>frame</key>\n`;
      xml += `        <string>{{${f.x},${f.y}},{${f.w},${f.h}}}</string>\n`;
      xml += `        <key>offset</key>\n`;
      xml += `        <string>{0,0}</string>\n`;
      xml += `        <key>rotated</key>\n`;
      xml += `        <false/>\n`;
      xml += `        <key>sourceColorRect</key>\n`;
      xml += `        <string>{{0,0},{${f.w},${f.h}}}</string>\n`;
      xml += `        <key>sourceSize</key>\n`;
      xml += `        <string>{${f.w},${f.h}}</string>\n`;
      xml += `      </dict>\n`;
    });

    xml += `    </dict>\n`;
    xml += `    <key>metadata</key>\n`;
    xml += `    <dict>\n`;
    xml += `      <key>format</key>\n`;
    xml += `      <integer>2</integer>\n`;
    xml += `      <key>realTextureFileName</key>\n`;
    xml += `      <string>${pngName}</string>\n`;
    xml += `      <key>size</key>\n`;
    xml += `      <string>{${sheetW},${sheetH}}</string>\n`;
    xml += `      <key>textureFileName</key>\n`;
    xml += `      <string>${pngName}</string>\n`;
    xml += `    </dict>\n`;
    xml += `  </dict>\n`;
    xml += `</plist>`;
    return xml;
  }

  function generateJsonString(pngName, sheetW, sheetH, framesMeta) {
    const data = {
      frames: {},
      meta: {
        app: "MP4 to SpriteSheet Studio Pro",
        version: "1.2",
        image: pngName,
        size: { w: sheetW, h: sheetH },
        scale: "1"
      }
    };

    framesMeta.forEach(f => {
      data.frames[f.name] = {
        frame: { x: f.x, y: f.y, w: f.w, h: f.h },
        rotated: false,
        trimmed: false,
        spriteSourceSize: { x: 0, y: 0, w: f.w, h: f.h },
        sourceSize: { w: f.w, h: f.h }
      };
    });

    return JSON.stringify(data, null, 2);
  }

  // --- Download Handlers ---
  btnDlPng.addEventListener('click', () => {
    if (!generatedResult.pngDataUrl) return;
    downloadFile(generatedResult.pngDataUrl, `${generatedResult.filenameBase}.png`);
  });

  btnDlPlist.addEventListener('click', () => {
    if (!generatedResult.plistText) return;
    const blob = new Blob([generatedResult.plistText], { type: 'text/xml' });
    downloadFile(URL.createObjectURL(blob), `${generatedResult.filenameBase}.plist`);
  });

  btnDlJson.addEventListener('click', () => {
    if (!generatedResult.jsonText) return;
    const blob = new Blob([generatedResult.jsonText], { type: 'application/json' });
    downloadFile(URL.createObjectURL(blob), `${generatedResult.filenameBase}.json`);
  });

  btnDlZip.addEventListener('click', async () => {
    if (!generatedResult.frames || generatedResult.frames.length === 0) return;
    if (typeof JSZip === 'undefined') {
      alert('JSZipライブラリが読み込まれていません。');
      return;
    }

    btnDlZip.disabled = true;
    btnDlZip.textContent = '📦 ZIP生成中...';

    try {
      const zip = new JSZip();
      const folder = zip.folder('frames');

      for (const f of generatedResult.frames) {
        const dataUrl = f.canvas.toDataURL('image/png');
        const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
        folder.file(f.name, base64Data, { base64: true });
      }

      const content = await zip.generateAsync({ type: 'blob' });
      downloadFile(URL.createObjectURL(content), `${generatedResult.filenameBase}_frames.zip`);
    } catch (e) {
      console.error(e);
      alert('ZIP保存中にエラーが発生しました。');
    } finally {
      btnDlZip.disabled = false;
      btnDlZip.textContent = '📦 連番PNG一括保存 (.zip)';
    }
  });

  function downloadFile(url, fileName) {
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
});
