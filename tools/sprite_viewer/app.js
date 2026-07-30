/**
 * MovieCreator - Sprite Viewer Application
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const dropZone = document.getElementById('drop-zone');
  const dropPrompt = document.getElementById('drop-prompt');
  const viewport = document.getElementById('viewport');
  const fileInput = document.getElementById('file-input');
  const animCanvas = document.getElementById('anim-canvas');
  const ctx = animCanvas.getContext('2d');

  const btnPlayPause = document.getElementById('btn-play-pause');
  const btnPrevFrame = document.getElementById('btn-prev-frame');
  const btnNextFrame = document.getElementById('btn-next-frame');
  const frameCounter = document.getElementById('frame-counter');
  const fpsSlider = document.getElementById('fps-slider');
  const fpsVal = document.getElementById('fps-val');
  const infoCard = document.getElementById('info-card');
  const framesGrid = document.getElementById('frames-grid');
  const btnOpenForSprite = document.getElementById('btn-open-forsprite');

  // Application State
  let spriteImage = null;
  let framesData = []; // Array of { name, x, y, w, h }
  let currentFrameIndex = 0;
  let isPlaying = false;
  let fps = 15;
  let lastFrameTime = 0;
  let animTimer = null;

  // Open forSprite folder button
  if (btnOpenForSprite) {
    btnOpenForSprite.addEventListener('click', async () => {
      try {
        await fetch('/api/open-folder?target=forSprite', { method: 'POST' });
      } catch (e) { console.error(e); }
    });
  }

  // --- Drag & Drop Handlers ---
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
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) processFiles(files);
  });

  fileInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) processFiles(files);
  });

  async function processFiles(files) {
    let imgFile = files.find(f => f.type.startsWith('image/') || f.name.endsWith('.png'));
    let metaFile = files.find(f => f.name.endsWith('.json') || f.name.endsWith('.plist'));

    if (!imgFile && !metaFile) {
      alert('PNG画像または.json / .plist メタデータファイルをドロップしてください。');
      return;
    }

    if (imgFile) {
      const url = URL.createObjectURL(imgFile);
      spriteImage = new Image();
      spriteImage.onload = () => {
        if (metaFile) {
          parseMetaFile(metaFile);
        } else {
          // Meta file not provided -> Auto Grid Split (e.g. 4x4)
          autoGridSplit(spriteImage.width, spriteImage.height);
        }
      };
      spriteImage.src = url;
    } else if (metaFile) {
      alert('スプライトシートPNG画像も一緒にドロップしてください。');
    }
  }

  function parseMetaFile(metaFile) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      if (metaFile.name.endsWith('.json')) {
        try {
          const json = JSON.parse(content);
          parseJsonMeta(json);
        } catch (err) {
          alert(`JSONパース失敗: ${err.message}`);
        }
      } else if (metaFile.name.endsWith('.plist')) {
        parsePlistMeta(content);
      }
      initAnimation();
    };
    reader.readAsText(metaFile);
  }

  function parseJsonMeta(data) {
    framesData = [];
    if (data.frames) {
      // Support Hash format or Array format
      if (Array.isArray(data.frames)) {
        data.frames.forEach(f => {
          framesData.push({
            name: f.filename || 'frame',
            x: f.frame.x, y: f.frame.y, w: f.frame.w, h: f.frame.h
          });
        });
      } else {
        Object.keys(data.frames).forEach(key => {
          const f = data.frames[key];
          const frameObj = f.frame || f;
          framesData.push({
            name: key,
            x: frameObj.x, y: frameObj.y, w: frameObj.w, h: frameObj.h
          });
        });
      }
    }
  }

  function parsePlistMeta(xmlText) {
    framesData = [];
    // Extract <key>frame_xxx.png</key> <dict>...<string>{{x,y},{w,h}}</string>...
    const dictRegex = /<key>([^<]+)<\/key>\s*<dict>[\s\S]*?<key>frame<\/key>\s*<string>\{\{(\d+),(\d+)\},\{(\d+),(\d+)\}\}<\/string>/g;
    let match;
    while ((match = dictRegex.exec(xmlText)) !== null) {
      framesData.push({
        name: match[1],
        x: parseInt(match[2], 10),
        y: parseInt(match[3], 10),
        w: parseInt(match[4], 10),
        h: parseInt(match[5], 10)
      });
    }

    if (framesData.length === 0) {
      autoGridSplit(spriteImage.width, spriteImage.height);
    }
  }

  function autoGridSplit(imgW, imgH) {
    framesData = [];
    // Default to square aspect ratio grid or 4x4
    const cols = Math.ceil(Math.sqrt(16));
    const rows = cols;
    const w = Math.floor(imgW / cols);
    const h = Math.floor(imgH / rows);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        framesData.push({
          name: `frame_${r * cols + c}`,
          x: c * w, y: r * h, w, h
        });
      }
    }
  }

  function initAnimation() {
    if (!spriteImage || framesData.length === 0) return;

    dropPrompt.classList.add('hidden');
    viewport.classList.remove('hidden');

    currentFrameIndex = 0;
    updateInfoCard();
    renderFramesGrid();
    renderCurrentFrame();
    play();
  }

  function updateInfoCard() {
    if (!spriteImage) return;
    infoCard.innerHTML = `
      <strong>画像サイズ:</strong> ${spriteImage.width} x ${spriteImage.height} px<br>
      <strong>フレーム数:</strong> ${framesData.length} コマ<br>
      <strong>コマ解像度:</strong> ${framesData[0] ? `${framesData[0].w} x ${framesData[0].h} px` : 'N/A'}
    `;
  }

  function renderCurrentFrame() {
    if (!spriteImage || framesData.length === 0) return;
    const frame = framesData[currentFrameIndex];
    if (!frame) return;

    animCanvas.width = frame.w;
    animCanvas.height = frame.h;

    ctx.clearRect(0, 0, frame.w, frame.h);
    ctx.drawImage(
      spriteImage,
      frame.x, frame.y, frame.w, frame.h,
      0, 0, frame.w, frame.h
    );

    frameCounter.textContent = `Frame: ${currentFrameIndex + 1} / ${framesData.length}`;

    // Highlight active in grid
    document.querySelectorAll('.frame-item').forEach((el, idx) => {
      el.classList.toggle('active', idx === currentFrameIndex);
    });
  }

  function renderFramesGrid() {
    framesGrid.innerHTML = '';
    if (!spriteImage || framesData.length === 0) return;

    framesData.forEach((f, idx) => {
      const item = document.createElement('div');
      item.className = `frame-item ${idx === currentFrameIndex ? 'active' : ''}`;

      // Offscreen crop canvas for thumbnail
      const canvas = document.createElement('canvas');
      canvas.width = f.w;
      canvas.height = f.h;
      const cCtx = canvas.getContext('2d');
      cCtx.drawImage(spriteImage, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);

      const img = document.createElement('img');
      img.src = canvas.toDataURL();

      const numLabel = document.createElement('span');
      numLabel.className = 'frame-num';
      numLabel.textContent = idx + 1;

      item.appendChild(img);
      item.appendChild(numLabel);

      item.addEventListener('click', () => {
        pause();
        currentFrameIndex = idx;
        renderCurrentFrame();
      });

      framesGrid.appendChild(item);
    });
  }

  // --- Animation Controls ---
  function play() {
    isPlaying = true;
    btnPlayPause.textContent = '⏸ Pause';
    lastFrameTime = performance.now();
    loopAnimation();
  }

  function pause() {
    isPlaying = false;
    btnPlayPause.textContent = '▶ Play';
    if (animTimer) cancelAnimationFrame(animTimer);
  }

  function loopAnimation() {
    if (!isPlaying) return;
    const now = performance.now();
    const interval = 1000 / fps;

    if (now - lastFrameTime >= interval) {
      currentFrameIndex = (currentFrameIndex + 1) % framesData.length;
      renderCurrentFrame();
      lastFrameTime = now;
    }

    animTimer = requestAnimationFrame(loopAnimation);
  }

  btnPlayPause.addEventListener('click', () => {
    if (isPlaying) pause();
    else play();
  });

  btnPrevFrame.addEventListener('click', () => {
    pause();
    currentFrameIndex = (currentFrameIndex - 1 + framesData.length) % framesData.length;
    renderCurrentFrame();
  });

  btnNextFrame.addEventListener('click', () => {
    pause();
    currentFrameIndex = (currentFrameIndex + 1) % framesData.length;
    renderCurrentFrame();
  });

  fpsSlider.addEventListener('input', () => {
    fps = parseInt(fpsSlider.value, 10) || 15;
    fpsVal.textContent = fps;
  });

  // Background toggle
  document.querySelectorAll('.btn-bg').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.btn-bg').forEach(b => b.classList.remove('active'));
      const targetBtn = e.target.closest('.btn-bg');
      targetBtn.classList.add('active');
      const bg = targetBtn.dataset.bg;
      viewport.className = `viewport-container ${bg}-bg`;
    });
  });
});
