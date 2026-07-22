/**
 * Controls.js - Refactored to Unity-style Hierarchy & Inspector Panel.
 * Left/Middle: Preview & Render Canvas
 * Right Upper: Layers Hierarchy List (Simple rows: reorder, delete, visibility, active toggle)
 * Right Lower: Inspector Panel (Detailed parameter tuning & LFO settings for the ACTIVE layer only)
 */
import { FX_PARAM_RANGES } from '../engine/fxParamRanges.js';
import { MOTION_TEMPLATES } from '../engine/motionTemplates.js';
import { hexToHsl } from '../engine/Generators.js';
import {
  forceFxOff,
  randomizeRotation,
  randomizeScale,
  randomizeGlowIntensity,
  randomizeFeedbackDecay,
  randomizeFeedbackRotate,
  randomizeRotateX
} from './fxRandomizerRules.js';

export class Controls {
  constructor(layerManager, mainApp) {
    this.layerManager = layerManager;
    this.mainApp = mainApp;
    
    // Cached DOM elements
    this.layersListEl = document.getElementById('layers-list');
    this.btnAddLayerEl = document.getElementById('btn-add-layer');
    this.layerSelectorContainerEl = document.getElementById('layer-selector-container');
    this.layerTypeSelectEl = document.getElementById('layer-type-select');
    this.btnConfirmAddLayerEl = document.getElementById('btn-confirm-add-layer');
    
    // Inspector elements
    this.inspectorLayerNameEl = document.getElementById('inspector-layer-name');
    this.inspectorContentEl = document.getElementById('inspector-content');

    // Transport controls
    this.layerStatusBadgeEl = document.getElementById('layer-status-badge');
    this.layerStatusTypeEl = document.getElementById('layer-status-type');
    this.layerStatusCountsEl = document.getElementById('layer-status-counts');
    this.btnPlayPauseEl = document.getElementById('btn-play-pause');
    this.btnRewindStartEl = document.getElementById('btn-rewind-start');
    this.btnExportEl = document.getElementById('btn-export');
    this.exportDurationEl = document.getElementById('export-duration');
    this.exportBgEl = document.getElementById('export-bg');
    this.exportProResEl = document.getElementById('export-prores');
    this.exportResolutionEl = document.getElementById('export-resolution');
    this.exportFpsEl = document.getElementById('export-fps');
    this.masterFadeOutEl = document.getElementById('master-fade-out');

    // Project Save/Load elements (API based)
    this.currentProjectFile = null;
    this.projectSelectEl = document.getElementById('project-select');
    this.btnApiLoadProjectEl = document.getElementById('btn-api-load-project');
    this.btnApiSaveProjectEl = document.getElementById('btn-api-save-project');
    this.btnApiSaveProjectQuickEl = document.getElementById('btn-api-save-project-quick');
    this.btnProjectNewEl = document.getElementById('btn-project-new');

    // Timeline / Keyframe elements
    this.timelinePanelEl = document.getElementById('timeline-panel');
    this.timelineActiveParamEl = document.getElementById('timeline-active-param');
    this.keyPreciseFrameEl = document.getElementById('key-precise-frame');
    this.keyPreciseValueEl = document.getElementById('key-precise-value');
    this.btnKeyPreciseDeleteEl = document.getElementById('btn-key-precise-delete');
    this.keyPreciseEasingEl = document.getElementById('key-precise-easing');
    this.btnKeyClearAllEl = document.getElementById('btn-key-clear-all');
    this.btnKeyCopyEl = document.getElementById('btn-key-copy');
    this.btnKeyPasteEl = document.getElementById('btn-key-paste');
    this.timelineSnapSelectEl = document.getElementById('timeline-snap-select');
    this.timelineSnapValueSelectEl = document.getElementById('timeline-snap-value-select');
    this.timelineTemplateSelectEl = document.getElementById('timeline-template-select');
    this.btnKeySaveTemplateEl = document.getElementById('btn-key-save-template');
    this.btnTemplateExportEl = document.getElementById('btn-template-export');
    this.btnTemplateImportEl = document.getElementById('btn-template-import');
    this.templateImportFileEl = document.getElementById('template-import-file');
    this.timelineCanvas = document.getElementById('timeline-canvas');
    this.activeTimelineParam = null;
    this.selectedKeyframeIndex = -1;
    this.isDraggingKeyframe = false;
    this.isTimelineSeeking = false;

    // Keyframe copy buffers
    this.copiedKeyframes = null;
    this.copiedSingleValue = null;

    // Local Import/Export elements
    this.btnLocalExportProjectEl = document.getElementById('btn-local-export-project');
    this.btnLocalImportProjectEl = document.getElementById('btn-local-import-project');
    this.inputLocalImportProjectEl = document.getElementById('input-local-import-project');

    // Layer Export/Import elements (API based)
    this.presetSelectEl = document.getElementById('preset-select');
    this.btnApiImportLayerEl = document.getElementById('btn-api-import-layer');
    this.btnApiExportLayerEl = document.getElementById('btn-api-export-layer-inspector');

    // Floating Inspector elements
    this.btnDetachInspectorEl = document.getElementById('btn-detach-inspector');
    this.isDetached = false;
    this.popupWindow = null;
    this.originalInspectorContentEl = this.inspectorContentEl;
    this.originalInspectorLayerNameEl = this.inspectorLayerNameEl;

    // UI state
    this.activeLayerId = null; // Currently selected layer ID in Inspector
    this.expandedMods = new Set();  // Holds 'layerId-paramName' for expanded LFO sub-panels

    // Common FX Configs supporting LFO modulation.
    // min/max come from the shared FX_PARAM_RANGES table (see LayerManager.js `initModulations`
    // for the modulation-bounds counterpart) so the two never drift apart; label/step/type stay
    // here since they're UI-only concerns.
    const R = FX_PARAM_RANGES;
    this.fxConfigs = {
      positionX:           { name: 'positionX',           label: 'Position X',     ...R.positionX,           step: 0.01,  type: 'range' },
      positionY:           { name: 'positionY',           label: 'Position Y',     ...R.positionY,           step: 0.01,  type: 'range' },
      rotation:            { name: 'rotation',            label: 'Rotation',       ...R.rotation,            step: 1,     type: 'range' },
      scale:               { name: 'scale',               label: 'Scale',          ...R.scale,               step: 0.05,  type: 'range' },
      strobe:              { name: 'strobe',              label: 'Strobe Speed',   ...R.strobe,              step: 0.5,   type: 'range' },
      glowIntensity:       { name: 'glowIntensity',       label: 'Neon Glow',      ...R.glowIntensity,       step: 1,     type: 'range' },
      feedbackDecay:       { name: 'feedbackDecay',       label: 'Motion Trails',  ...R.feedbackDecay,       step: 0.01,  type: 'range' },
      feedbackRotate:      { name: 'feedbackRotate',      label: 'Trail Spin',     ...R.feedbackRotate,      step: 0.001, type: 'range' },
      distortionIntensity: { name: 'distortionIntensity', label: 'Noise Warp',     ...R.distortionIntensity, step: 1,     type: 'range' },
      kaleidoscope:        { name: 'kaleidoscopeSegment', label: 'Kaleidoscope',   ...R.kaleidoscopeSegment, step: 1,     type: 'range' },
      mirrorMode:          { name: 'mirrorMode',          label: 'Mirror Mode',    ...R.mirrorMode,          step: 1,     type: 'range' },
      chromatic:           { name: 'chromaticOffset',     label: 'Chromatic Aberr',...R.chromaticOffset,     step: 0.5,   type: 'range' },
      hueRotate:           { name: 'hueRotate',           label: 'Hue Rotate',     ...R.hueRotate,           step: 1,     type: 'range' },
      rotateX:             { name: 'rotateX',             label: 'Rotate X',       ...R.rotateX,             step: 1,     type: 'range' },
      rotateY:             { name: 'rotateY',             label: 'Rotate Y',       ...R.rotateY,             step: 1,     type: 'range' },
      rotateZ:             { name: 'rotateZ',             label: 'Rotate Z',       ...R.rotateZ,             step: 1,     type: 'range' },
      translateZ:          { name: 'translateZ',          label: 'Depth (Z)',      ...R.translateZ,          step: 5,     type: 'range' }
    };
    this.activeDocument = document;

    // Good-attraction randomizer tuning (see randomizeLayer / showLearningStatsDialog)
    this.GOOD_ATTRACTION_MAX_WEIGHT = 0.35;
    this.GOOD_ATTRACTION_CONFIDENCE_SAMPLES = 5;

    // feedbackDecay values above this start compounding into runaway feedback loops (see randomizeLayer)
    this.FEEDBACK_DECAY_HARD_CAP = 0.92;

    // Odds that an eligible (non-low-Move) generator parameter gets a random motion template
    // during Random LFO, instead of plain LFO/static handling - see randomizeLayer.
    this.RANDOM_TEMPLATE_CHANCE = 0.3;

    // Batch generator defaults
    this.batchCount = 10;
    this.batchThreshold = 90;
    this.moveScores = {};
  }

  // Per (layerType, paramName) "Move" score (0-5) from the opinion sheet's Score/Move/Comment
  // matrix - how effective animating that parameter was judged to be. Used by randomizeLayer to
  // skip Random LFO/keyframe templates on parameters known to look worse when animated.
  async loadMoveScores() {
    try {
      const res = await fetch('/data/move_scores.json');
      if (res.ok) {
        this.moveScores = await res.json();
        console.log("[Motion Presets] Loaded Move-score matrix successfully.");
      }
    } catch (e) {
      console.warn("[Motion Presets] Failed to load Move-score JSON, using defaults:", e.message);
      this.moveScores = {};
    }
  }

  updateTemplateDropdown() {
    if (!this.timelineTemplateSelectEl) return;
    
    this.timelineTemplateSelectEl.innerHTML = '<option value="">Template</option>';
    
    // 1. Built-in Templates: Group by Point count (e.g. "2P", "3P", etc.)
    const groups = {};
    
    for (let key in MOTION_TEMPLATES) {
      // Determine group (e.g. "2P", "3P")
      const match = key.match(/^(\d+P)_/);
      const groupKey = match ? match[1] : "Other";
      
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      
      // Determine strength suffix and clean name
      let cleanName = key.replace(/^\d+P_/, '');
      let strength = "1.0";
      if (cleanName.endsWith('_Half')) {
        cleanName = cleanName.replace('_Half', '');
        strength = "0.5";
      } else if (cleanName.endsWith('_Quarter')) {
        cleanName = cleanName.replace('_Quarter', '');
        strength = "0.25";
      }
      
      // Improve readability of cleanName (e.g., "LinearUp" -> "Linear Up", "SineLFO_2.5x" -> "Sine LFO 2.5x")
      // Insert space before capital letters, but avoid splitting consecutive uppercase or trailing numbers/x
      let readableName = cleanName
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2') // e.g. "SineLFO" -> "Sine LFO"
        .replace(/([a-z\d])([A-Z])/g, '$1 $2')      // e.g. "LinearUp" -> "Linear Up"
        .replace(/_/g, ' ')                        // e.g. "SineLFO_2.5x" -> "Sine LFO 2.5x"
        .trim();
      
      groups[groupKey].push({
        key: key,
        displayName: `${readableName} (${strength})`,
        sortKey: `${cleanName.toLowerCase()}_${strength === "1.0" ? "a" : strength === "0.5" ? "b" : "c"}`
      });
    }
    
    // Create optgroups sorted by point count
    const sortedGroupKeys = Object.keys(groups).sort((a, b) => {
      const numA = parseInt(a) || 999;
      const numB = parseInt(b) || 999;
      return numA - numB;
    });
    
    sortedGroupKeys.forEach(groupKey => {
      const optgroup = this.createElement('optgroup');
      optgroup.label = `${groupKey.replace('P', '-Point')} Curves`;
      
      // Sort items within group by base name, then by strength (Full -> Half -> Quarter)
      const items = groups[groupKey];
      items.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
      
      items.forEach(item => {
        const opt = this.createElement('option');
        opt.value = "builtin:" + item.key;
        opt.textContent = item.displayName;
        optgroup.appendChild(opt);
      });
      
      this.timelineTemplateSelectEl.appendChild(optgroup);
    });
    
    // 2. Custom Templates
    let customs = {};
    try {
      const data = localStorage.getItem('motion_templates_custom');
      if (data) customs = JSON.parse(data);
    } catch (e) {
      console.warn("Failed to parse custom motion templates from localStorage", e);
    }
    
    const customKeys = Object.keys(customs);
    if (customKeys.length > 0) {
      const customGroup = this.createElement('optgroup');
      customGroup.label = "Custom Shapes";
      customKeys.forEach(key => {
        const opt = this.createElement('option');
        opt.value = "custom:" + key;
        opt.textContent = key;
        customGroup.appendChild(opt);
      });
      this.timelineTemplateSelectEl.appendChild(customGroup);
    }
  }

  createElement(tagName) {
    return (this.activeDocument || document).createElement(tagName);
  }

  init() {
    this.loadMoveScores();
    this.updateTemplateDropdown();
    // 1. Layer add toggling
    this.btnAddLayerEl.addEventListener('click', (e) => {
      e.stopPropagation();
      this.layerSelectorContainerEl.classList.toggle('hidden');
    });

    document.addEventListener('click', () => {
      this.layerSelectorContainerEl.classList.add('hidden');
    });

    this.layerSelectorContainerEl.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    // 2. Add layer confirmation
    this.btnConfirmAddLayerEl.addEventListener('click', () => {
      const type = this.layerTypeSelectEl.value;
      const newLayer = this.layerManager.addLayer(type);
      
      this.activeLayerId = newLayer.id; // Automatically focus/inspect new layer
      this.layerSelectorContainerEl.classList.add('hidden');
      this.rebuildLayersList();
      this.rebuildInspector();

      // Auto-start playback to showcase movement presets immediately
      if (!this.mainApp.isPlaying) {
        this.mainApp.play();
      } else {
        this.mainApp.renderSingleFrame();
      }
    });

    // 3. Play/Pause
    this.btnPlayPauseEl.addEventListener('click', () => {
      if (this.mainApp.isPlaying) {
        this.mainApp.pause();
      } else {
        this.mainApp.play();
      }
    });

    // 3b. Rewind to start
    if (this.btnRewindStartEl) {
      this.btnRewindStartEl.addEventListener('click', () => {
        this.mainApp.rewindToStart();
      });
    }

    // 4. Export Video
    this.btnExportEl.addEventListener('click', () => {
      const resVal = this.exportResolutionEl ? this.exportResolutionEl.value : '1080p';
      let w = 1920, h = 1080;
      if (resVal === '720p') { w = 1280; h = 720; }
      else if (resVal === '4K') { w = 3840; h = 2160; }

      const fpsVal = this.exportFpsEl ? parseInt(this.exportFpsEl.value, 10) : 60;

      const options = {
        duration: parseFloat(this.exportDurationEl.value) || 10,
        fps: fpsVal,
        width: w,
        height: h,
        bgMode: this.exportBgEl.value,
        fadeOutDuration: parseFloat(this.masterFadeOutEl.value) || 0,
        alsoExportProRes: !!(this.exportProResEl && this.exportProResEl.checked),
        filename: this.buildExportFilename()
      };
      this.mainApp.exportVideo(options);
    });

    // 5. API Project Save/Load Events
    if (this.btnApiSaveProjectEl) {
      this.btnApiSaveProjectEl.addEventListener('click', () => {
        this.apiSaveProject();
      });
    }

    if (this.btnApiSaveProjectQuickEl) {
      this.btnApiSaveProjectQuickEl.addEventListener('click', () => {
        this.apiSaveProjectQuick();
      });
    }

    if (this.btnApiLoadProjectEl) {
      this.btnApiLoadProjectEl.addEventListener('click', () => {
        this.apiLoadProject();
      });
    }

    if (this.projectSelectEl) {
      this.projectSelectEl.addEventListener('change', () => {
        if (this.isRefreshingFiles) return;
        this.currentProjectFile = this.projectSelectEl.value || null;
      });
    }

    if (this.btnProjectNewEl) {
      this.btnProjectNewEl.addEventListener('click', () => {
        this.apiNewProject();
      });
    }

    // Local Import/Export Events
    if (this.btnLocalExportProjectEl) {
      this.btnLocalExportProjectEl.addEventListener('click', () => {
        this.localExportProject();
      });
    }

    if (this.btnLocalImportProjectEl && this.inputLocalImportProjectEl) {
      this.btnLocalImportProjectEl.addEventListener('click', () => {
        this.inputLocalImportProjectEl.click();
      });
      this.inputLocalImportProjectEl.addEventListener('change', (e) => {
        this.localImportProject(e);
      });
    }

    // 6. API Layer Export/Import Events
    if (this.btnApiExportLayerEl) {
      this.btnApiExportLayerEl.addEventListener('click', () => {
        this.apiExportLayer();
      });
    }

    if (this.btnApiImportLayerEl) {
      this.btnApiImportLayerEl.addEventListener('click', () => {
        this.apiImportLayer();
      });
    }

    // 7. Floating Inspector Detach Event
    if (this.btnDetachInspectorEl) {
      this.btnDetachInspectorEl.addEventListener('click', () => {
        this.toggleInspectorDetach();
      });
    }

    // Initial load of workspace directory files (runs regardless of button availability)
    this.refreshFileList();

    // Auto-select the first layer if available, and build UI
    if (this.layerManager.layers.length > 0) {
      this.activeLayerId = this.layerManager.layers[0].id;
    }
    // Load past evaluation scores history
    this.scoreData = [];
    fetch('/api/scores')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          this.scoreData = data;
          // Header badge was built with an empty scoreData at initial rebuildInspector() time
          // (this fetch hadn't resolved yet), so refresh it now that real counts are in.
          const activeLayer = this.layerManager.layers.find(l => l.id === this.activeLayerId);
          this.updateHeaderLayerStatus(activeLayer || null);
        }
      })
      .catch(err => console.error('Failed to load score history:', err));

    this.rebuildLayersList();
    this.rebuildInspector();
    this.initTimeline();
  }

  getParamConfig(layer, paramName) {
    if (!layer) return null;
    if (this.fxConfigs[paramName]) return this.fxConfigs[paramName];
    return layer.generator.getParameterConfig().find(c => c.name === paramName) || null;
  }

  getMousePos(canvas, e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }

  initTimeline() {
    if (!this.timelineCanvas) return;

    this.boundGlobalKeyDown = this.handleGlobalKeyDown.bind(this);

    // Window resize binding
    window.addEventListener('resize', () => {
      this.drawTimeline();
    });

    // Precise input fields events
    this.keyPreciseFrameEl.addEventListener('input', () => {
      const activeLayer = this.layerManager.layers.find(l => l.id === this.activeLayerId);
      if (!activeLayer || !this.activeTimelineParam) return;
      const mod = activeLayer.modulations[this.activeTimelineParam];
      if (mod && this.selectedKeyframeIndex !== -1) {
        const duration = parseFloat(this.exportDurationEl.value) || 10;
        const maxFrames = duration * 60;
        const kf = mod.keyframes[this.selectedKeyframeIndex];
        kf.frame = Math.max(0, Math.min(maxFrames, parseInt(this.keyPreciseFrameEl.value) || 0));
        mod.keyframes.sort((a, b) => a.frame - b.frame);
        this.selectedKeyframeIndex = mod.keyframes.findIndex(k => k === kf);
        this.mainApp.renderSingleFrame();
        this.drawTimeline();
      }
    });

    this.keyPreciseValueEl.addEventListener('input', () => {
      const activeLayer = this.layerManager.layers.find(l => l.id === this.activeLayerId);
      if (!activeLayer || !this.activeTimelineParam) return;
      const mod = activeLayer.modulations[this.activeTimelineParam];
      const config = this.getParamConfig(activeLayer, this.activeTimelineParam);
      if (mod && config && this.selectedKeyframeIndex !== -1) {
        const kf = mod.keyframes[this.selectedKeyframeIndex];
        kf.value = Math.max(config.min, Math.min(config.max, parseFloat(this.keyPreciseValueEl.value) || 0));
        this.mainApp.renderSingleFrame();
        this.drawTimeline();
      }
    });

    this.keyPreciseEasingEl.addEventListener('change', () => {
      const activeLayer = this.layerManager.layers.find(l => l.id === this.activeLayerId);
      if (!activeLayer || !this.activeTimelineParam) return;
      const mod = activeLayer.modulations[this.activeTimelineParam];
      if (mod && this.selectedKeyframeIndex !== -1) {
        const kf = mod.keyframes[this.selectedKeyframeIndex];
        kf.easing = this.keyPreciseEasingEl.value;
        this.mainApp.renderSingleFrame();
        this.drawTimeline();
      }
    });

    // Delete keyframe event
    this.btnKeyPreciseDeleteEl.addEventListener('click', () => {
      const activeLayer = this.layerManager.layers.find(l => l.id === this.activeLayerId);
      if (!activeLayer || !this.activeTimelineParam) return;
      const mod = activeLayer.modulations[this.activeTimelineParam];
      if (mod && this.selectedKeyframeIndex !== -1) {
        mod.keyframes.splice(this.selectedKeyframeIndex, 1);
        this.selectedKeyframeIndex = -1;
        this.keyPreciseFrameEl.value = '';
        this.keyPreciseFrameEl.disabled = true;
        this.keyPreciseValueEl.value = '';
        this.keyPreciseValueEl.disabled = true;
        this.keyPreciseEasingEl.value = 'linear';
        this.keyPreciseEasingEl.disabled = true;
        this.btnKeyPreciseDeleteEl.disabled = true;
        this.mainApp.renderSingleFrame();
        this.drawTimeline();
      }
    });

    // Clear All keyframes event
    this.btnKeyClearAllEl.addEventListener('click', () => {
      const activeLayer = this.layerManager.layers.find(l => l.id === this.activeLayerId);
      if (!activeLayer || !this.activeTimelineParam) return;
      const mod = activeLayer.modulations[this.activeTimelineParam];
      if (mod) {
        mod.keyframes = [];
        this.selectedKeyframeIndex = -1;
        this.keyPreciseFrameEl.value = '';
        this.keyPreciseFrameEl.disabled = true;
        this.keyPreciseValueEl.value = '';
        this.keyPreciseValueEl.disabled = true;
        this.keyPreciseEasingEl.value = 'linear';
        this.keyPreciseEasingEl.disabled = true;
        this.btnKeyPreciseDeleteEl.disabled = true;
        this.mainApp.renderSingleFrame();
        this.drawTimeline();
      }
    });

    // Copy keyframes event
    this.btnKeyCopyEl.addEventListener('click', () => {
      const activeLayer = this.layerManager.layers.find(l => l.id === this.activeLayerId);
      if (!activeLayer || !this.activeTimelineParam) return;
      const mod = activeLayer.modulations[this.activeTimelineParam];
      if (mod && mod.keyframes) {
        // Deep copy keyframes
        this.copiedKeyframes = mod.keyframes.map(kf => ({
          frame: kf.frame,
          value: kf.value,
          easing: kf.easing || 'linear'
        }));
        this.btnKeyPasteEl.disabled = false;
      }
    });

    // Paste keyframes event
    this.btnKeyPasteEl.addEventListener('click', () => {
      if (!this.copiedKeyframes) return;
      const activeLayer = this.layerManager.layers.find(l => l.id === this.activeLayerId);
      if (!activeLayer || !this.activeTimelineParam) return;
      const mod = activeLayer.modulations[this.activeTimelineParam];
      const config = this.getParamConfig(activeLayer, this.activeTimelineParam);
      if (mod && config) {
        // Overwrite and clamp values to new parameter range
        mod.keyframes = this.copiedKeyframes.map(kf => ({
          frame: kf.frame,
          value: Math.max(config.min, Math.min(config.max, kf.value)),
          easing: kf.easing || 'linear'
        }));
        mod.keyframes.sort((a, b) => a.frame - b.frame);
        
        // Reset selection
        this.selectedKeyframeIndex = -1;
        this.keyPreciseFrameEl.value = '';
        this.keyPreciseFrameEl.disabled = true;
        this.keyPreciseValueEl.value = '';
        this.keyPreciseValueEl.disabled = true;
        this.keyPreciseEasingEl.value = 'linear';
        this.keyPreciseEasingEl.disabled = true;
        this.btnKeyPreciseDeleteEl.disabled = true;
        
        this.mainApp.renderSingleFrame();
        this.drawTimeline();
      }
    });

    // Apply template event
    if (this.timelineTemplateSelectEl) {
      this.timelineTemplateSelectEl.addEventListener('change', (e) => {
        const val = e.target.value;
        if (!val) return;
        
        const activeLayer = this.layerManager.layers.find(l => l.id === this.activeLayerId);
        if (!activeLayer || !this.activeTimelineParam) return;
        const mod = activeLayer.modulations[this.activeTimelineParam];
        const config = this.getParamConfig(activeLayer, this.activeTimelineParam);
        
        if (mod && config) {
          const parts = val.split(':');
          const type = parts[0];
          const key = parts[1];
          
          let templateKfs = null;
          if (type === 'builtin') {
            templateKfs = MOTION_TEMPLATES[key];
          } else if (type === 'custom') {
            try {
              const data = localStorage.getItem('motion_templates_custom');
              if (data) {
                const customs = JSON.parse(data);
                templateKfs = customs[key];
              }
            } catch (err) {
              console.error("Failed to read custom template", err);
            }
          }
          
          if (templateKfs) {
            const durationVal = parseFloat(this.exportDurationEl.value) || 10;
            
            // Set modulation to keyframe mode
            mod.keyframeEnabled = true;
            mod.enabled = false;
            
            if (type === 'builtin') {
              this.applyMotionTemplate(mod, key, config.min, config.max, durationVal);
            } else if (type === 'custom') {
              const maxFrames = durationVal * 60;
              mod.keyframes = templateKfs.map(pt => ({
                frame: Math.round(pt.time * maxFrames),
                value: config.min + (config.max - config.min) * pt.value,
                easing: pt.easing || 'linear'
              }));
              mod.keyframes.sort((a, b) => a.frame - b.frame);
            }
            
            this.selectedKeyframeIndex = -1;
            this.keyPreciseFrameEl.value = '';
            this.keyPreciseFrameEl.disabled = true;
            this.keyPreciseValueEl.value = '';
            this.keyPreciseValueEl.disabled = true;
            this.keyPreciseEasingEl.value = 'linear';
            this.keyPreciseEasingEl.disabled = true;
            this.btnKeyPreciseDeleteEl.disabled = true;
            
            this.mainApp.renderSingleFrame();
            this.drawTimeline();
          }
        }
        
        e.target.value = "";
      });
    }

    // Save as template event
    if (this.btnKeySaveTemplateEl) {
      this.btnKeySaveTemplateEl.addEventListener('click', () => {
        const activeLayer = this.layerManager.layers.find(l => l.id === this.activeLayerId);
        if (!activeLayer || !this.activeTimelineParam) return;
        const mod = activeLayer.modulations[this.activeTimelineParam];
        const config = this.getParamConfig(activeLayer, this.activeTimelineParam);
        
        if (!mod || !mod.keyframes || mod.keyframes.length === 0) {
          alert("No keyframes found to save as a template!");
          return;
        }
        
        const name = prompt("Enter a name for the motion template:");
        if (!name) return;
        
        const trimmedName = name.trim();
        if (!trimmedName) return;
        
        const durationVal = parseFloat(this.exportDurationEl.value) || 10;
        const maxFrames = durationVal * 60;
        const range = config.max - config.min;
        
        const normalized = mod.keyframes.map(kf => {
          const time = maxFrames > 0 ? (kf.frame / maxFrames) : 0;
          const valNorm = range > 0 ? ((kf.value - config.min) / range) : 0;
          return {
            time: parseFloat(time.toFixed(4)),
            value: parseFloat(valNorm.toFixed(4)),
            easing: kf.easing || 'linear'
          };
        });
        
        let customs = {};
        try {
          const data = localStorage.getItem('motion_templates_custom');
          if (data) customs = JSON.parse(data);
        } catch (err) {}
        
        customs[trimmedName] = normalized;
        localStorage.setItem('motion_templates_custom', JSON.stringify(customs));
        
        this.updateTemplateDropdown();
        alert(`Template "${trimmedName}" saved successfully!`);
      });
    }

    // Export templates event
    if (this.btnTemplateExportEl) {
      this.btnTemplateExportEl.addEventListener('click', () => {
        let customs = {};
        try {
          const data = localStorage.getItem('motion_templates_custom');
          if (data) customs = JSON.parse(data);
        } catch (err) {}
        
        if (Object.keys(customs).length === 0) {
          alert("No custom templates to export!");
          return;
        }
        
        const jsonStr = JSON.stringify(customs, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = this.createElement('a');
        a.href = url;
        a.download = "motion_templates_custom.json";
        a.click();
        URL.revokeObjectURL(url);
      });
    }

    // Import templates triggering
    if (this.btnTemplateImportEl && this.templateImportFileEl) {
      this.btnTemplateImportEl.addEventListener('click', () => {
        this.templateImportFileEl.click();
      });
      
      this.templateImportFileEl.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const imported = JSON.parse(event.target.result);
            if (typeof imported !== 'object' || Array.isArray(imported)) {
              throw new Error("Invalid format. Expected JSON object of templates.");
            }
            
            let customs = {};
            try {
              const data = localStorage.getItem('motion_templates_custom');
              if (data) customs = JSON.parse(data);
            } catch (err) {}
            
            Object.assign(customs, imported);
            localStorage.setItem('motion_templates_custom', JSON.stringify(customs));
            
            this.updateTemplateDropdown();
            alert("Custom templates imported successfully!");
          } catch (err) {
            alert("Failed to import templates: " + err.message);
          }
        };
        reader.readAsText(file);
        e.target.value = "";
      });
    }

    // Canvas mousedown event
    this.timelineCanvas.addEventListener('mousedown', (e) => {
      const activeLayer = this.layerManager.layers.find(l => l.id === this.activeLayerId);
      if (!activeLayer || !this.activeTimelineParam) return;
      const mod = activeLayer.modulations[this.activeTimelineParam];
      const config = this.getParamConfig(activeLayer, this.activeTimelineParam);
      if (!mod || !config) return;

      const pos = this.getMousePos(this.timelineCanvas, e);
      const W = this.timelineCanvas.width;
      const H = this.timelineCanvas.height;
      const leftMargin = 50, rightMargin = 20, topMargin = 20, bottomMargin = 20;
      const graphWidth = W - leftMargin - rightMargin;
      const graphHeight = H - topMargin - bottomMargin;
      const duration = parseFloat(this.exportDurationEl.value) || 10;
      const maxFrames = duration * 60;

      // 1. Check if clicking near a keyframe point FIRST - a keyframe at value=1.0 (the top of
      // the graph's Y range) draws exactly on the topMargin boundary line, so checking the ruler
      // (seek) zone first would swallow most of that keyframe's hit circle and make it nearly
      // impossible to grab. Keyframe-grabbing takes priority over ruler-seeking wherever the two
      // overlap; seeking still works everywhere else in the ruler zone.
      let clickedIdx = -1;
      for (let i = 0; i < mod.keyframes.length; i++) {
        const kf = mod.keyframes[i];
        const kfX = leftMargin + (kf.frame / maxFrames) * graphWidth;
        const kfY = topMargin + (1 - (kf.value - config.min) / (config.max - config.min)) * graphHeight;
        const dist = Math.hypot(pos.x - kfX, pos.y - kfY);
        if (dist <= 8) {
          clickedIdx = i;
          break;
        }
      }

      // 2. Not on a keyframe - check if clicking on the ruler (top margin) for seek operation
      if (clickedIdx === -1 && pos.y <= topMargin) {
        this.isTimelineSeeking = true;
        const f = Math.max(0, Math.min(maxFrames, Math.round(((pos.x - leftMargin) / graphWidth) * maxFrames)));
        this.mainApp.accumulatedTime = (f / 60) * 1000;
        this.mainApp.renderSingleFrame();
        this.drawTimeline();
        return;
      }

      if (clickedIdx !== -1) {
        this.selectedKeyframeIndex = clickedIdx;
        this.isDraggingKeyframe = true;
        
        // Populate precise edit UI
        const kf = mod.keyframes[clickedIdx];
        this.keyPreciseFrameEl.value = kf.frame;
        this.keyPreciseFrameEl.disabled = false;
        this.keyPreciseValueEl.value = kf.value.toFixed(4);
        this.keyPreciseValueEl.disabled = false;
        this.keyPreciseEasingEl.value = kf.easing || 'linear';
        this.keyPreciseEasingEl.disabled = false;
        this.btnKeyPreciseDeleteEl.disabled = false;
      } else {
        // Clear selection
        this.selectedKeyframeIndex = -1;
        this.keyPreciseFrameEl.value = '';
        this.keyPreciseFrameEl.disabled = true;
        this.keyPreciseValueEl.value = '';
        this.keyPreciseValueEl.disabled = true;
        this.keyPreciseEasingEl.value = 'linear';
        this.keyPreciseEasingEl.disabled = true;
        this.btnKeyPreciseDeleteEl.disabled = true;
      }

      this.drawTimeline();
    });

    // Window mousemove / mouseup to keep drag & seek working smoothly off-canvas
    window.addEventListener('mousemove', (e) => {
      if (!this.isDraggingKeyframe && !this.isTimelineSeeking) return;

      const activeLayer = this.layerManager.layers.find(l => l.id === this.activeLayerId);
      if (!activeLayer || !this.activeTimelineParam) return;
      const mod = activeLayer.modulations[this.activeTimelineParam];
      const config = this.getParamConfig(activeLayer, this.activeTimelineParam);
      if (!mod || !config) return;

      const pos = this.getMousePos(this.timelineCanvas, e);
      const W = this.timelineCanvas.width;
      const H = this.timelineCanvas.height;
      const leftMargin = 50, rightMargin = 20, topMargin = 20, bottomMargin = 20;
      const graphWidth = W - leftMargin - rightMargin;
      const graphHeight = H - topMargin - bottomMargin;
      const duration = parseFloat(this.exportDurationEl.value) || 10;
      const maxFrames = duration * 60;

      if (this.isTimelineSeeking) {
        const f = Math.max(0, Math.min(maxFrames, Math.round(((pos.x - leftMargin) / graphWidth) * maxFrames)));
        this.mainApp.accumulatedTime = (f / 60) * 1000;
        this.mainApp.renderSingleFrame();
        this.drawTimeline();
      } else if (this.isDraggingKeyframe && this.selectedKeyframeIndex !== -1) {
        const kf = mod.keyframes[this.selectedKeyframeIndex];
        
        // Calculate new values based on mouse position
        let newFrame = Math.max(0, Math.min(maxFrames, Math.round(((pos.x - leftMargin) / graphWidth) * maxFrames)));
        
        // Snap feature
        const snapVal = this.timelineSnapSelectEl ? this.timelineSnapSelectEl.value : 'off';
        if (snapVal !== 'off') {
          const snap = parseInt(snapVal, 10);
          newFrame = Math.round(newFrame / snap) * snap;
          newFrame = Math.max(0, Math.min(maxFrames, newFrame));
        }

        let newVal = Math.max(config.min, Math.min(config.max, config.min + (1 - (pos.y - topMargin) / graphHeight) * (config.max - config.min)));

        // Value-axis snap (vertical) - mirrors the frame-axis snap above, but as a percent of
        // the parameter's own range since ranges vary wildly (0-1 opacity vs 0-1000 radius).
        const snapValuePct = this.timelineSnapValueSelectEl ? this.timelineSnapValueSelectEl.value : 'off';
        if (snapValuePct !== 'off') {
          const step = (config.max - config.min) * (parseFloat(snapValuePct) / 100);
          if (step > 0) {
            newVal = config.min + Math.round((newVal - config.min) / step) * step;
            newVal = Math.max(config.min, Math.min(config.max, newVal));
          }
        }

        kf.frame = newFrame;
        kf.value = newVal;

        // Update precise edit inputs in real time
        this.keyPreciseFrameEl.value = newFrame;
        this.keyPreciseValueEl.value = newVal.toFixed(4);
        this.keyPreciseEasingEl.value = kf.easing || 'linear';

        this.mainApp.renderSingleFrame();
        this.drawTimeline();
      }
    });

    window.addEventListener('mouseup', () => {
      if (this.isDraggingKeyframe) {
        // Sort keyframes by frame ascending on drag finish
        const activeLayer = this.layerManager.layers.find(l => l.id === this.activeLayerId);
        if (activeLayer && this.activeTimelineParam) {
          const mod = activeLayer.modulations[this.activeTimelineParam];
          if (mod && this.selectedKeyframeIndex !== -1) {
            const currentKf = mod.keyframes[this.selectedKeyframeIndex];
            mod.keyframes.sort((a, b) => a.frame - b.frame);
            this.selectedKeyframeIndex = mod.keyframes.findIndex(k => k === currentKf);
          }
        }
        this.isDraggingKeyframe = false;
        this.drawTimeline();
      }
      this.isTimelineSeeking = false;
    });

    // Double click to add keyframe
    this.timelineCanvas.addEventListener('dblclick', (e) => {
      const activeLayer = this.layerManager.layers.find(l => l.id === this.activeLayerId);
      if (!activeLayer || !this.activeTimelineParam) return;
      const mod = activeLayer.modulations[this.activeTimelineParam];
      const config = this.getParamConfig(activeLayer, this.activeTimelineParam);
      if (!mod || !config) return;

      const pos = this.getMousePos(this.timelineCanvas, e);
      const W = this.timelineCanvas.width;
      const H = this.timelineCanvas.height;
      const leftMargin = 50, rightMargin = 20, topMargin = 20, bottomMargin = 20;
      const graphWidth = W - leftMargin - rightMargin;
      const graphHeight = H - topMargin - bottomMargin;
      
      // Do not add keyframes if clicking in ruler area
      if (pos.y <= topMargin) return;

      const duration = parseFloat(this.exportDurationEl.value) || 10;
      const maxFrames = duration * 60;

      let newFrame = Math.max(0, Math.min(maxFrames, Math.round(((pos.x - leftMargin) / graphWidth) * maxFrames)));
      
      // Snap feature
      const snapVal = this.timelineSnapSelectEl ? this.timelineSnapSelectEl.value : 'off';
      if (snapVal !== 'off') {
        const snap = parseInt(snapVal, 10);
        newFrame = Math.round(newFrame / snap) * snap;
        newFrame = Math.max(0, Math.min(maxFrames, newFrame));
      }

      let newVal = Math.max(config.min, Math.min(config.max, config.min + (1 - (pos.y - topMargin) / graphHeight) * (config.max - config.min)));

      // Value-axis snap (vertical) - see the matching drag-handler comment above.
      const snapValuePctDbl = this.timelineSnapValueSelectEl ? this.timelineSnapValueSelectEl.value : 'off';
      if (snapValuePctDbl !== 'off') {
        const step = (config.max - config.min) * (parseFloat(snapValuePctDbl) / 100);
        if (step > 0) {
          newVal = config.min + Math.round((newVal - config.min) / step) * step;
          newVal = Math.max(config.min, Math.min(config.max, newVal));
        }
      }

      // Add and sort
      const newKf = { frame: newFrame, value: newVal, easing: 'linear' };
      mod.keyframes.push(newKf);
      mod.keyframes.sort((a, b) => a.frame - b.frame);
      
      this.selectedKeyframeIndex = mod.keyframes.findIndex(k => k === newKf);

      // Populate precise edit UI
      this.keyPreciseFrameEl.value = newFrame;
      this.keyPreciseFrameEl.disabled = false;
      this.keyPreciseValueEl.value = newVal.toFixed(4);
      this.keyPreciseValueEl.disabled = false;
      this.keyPreciseEasingEl.value = 'linear';
      this.keyPreciseEasingEl.disabled = false;
      this.btnKeyPreciseDeleteEl.disabled = false;

      this.mainApp.renderSingleFrame();
      this.drawTimeline();
    });

    // Keydown listener for delete and copy/paste shortcuts
    window.addEventListener('keydown', this.boundGlobalKeyDown);
  }

  handleGlobalKeyDown(e) {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT')) return;

    // Space key: play/pause toggle
    if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
      if (this.mainApp.isPlaying) {
        this.mainApp.pause();
      } else {
        this.mainApp.play();
      }
      return;
    }

    // Numpad ".": rewind to start
    if (e.code === 'NumpadDecimal') {
      e.preventDefault();
      this.mainApp.rewindToStart();
      return;
    }

    const activeLayer = this.layerManager.layers.find(l => l.id === this.activeLayerId);
    if (!activeLayer || !this.activeTimelineParam) return;
    const mod = activeLayer.modulations[this.activeTimelineParam];
    if (!mod) return;

    if (!mod.keyframes) {
      mod.keyframes = [];
    }

    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (this.selectedKeyframeIndex !== -1) {
        mod.keyframes.splice(this.selectedKeyframeIndex, 1);
        this.selectedKeyframeIndex = -1;
        this.keyPreciseFrameEl.value = '';
        this.keyPreciseFrameEl.disabled = true;
        this.keyPreciseValueEl.value = '';
        this.keyPreciseValueEl.disabled = true;
        this.keyPreciseEasingEl.value = 'linear';
        this.keyPreciseEasingEl.disabled = true;
        this.btnKeyPreciseDeleteEl.disabled = true;
        this.mainApp.renderSingleFrame();
        this.drawTimeline();
      }
    } else if (e.ctrlKey && (e.key === 'c' || e.key === 'C')) {
      if (this.selectedKeyframeIndex !== -1) {
        e.preventDefault(); // Prevent default copy behavior if necessary
        const kf = mod.keyframes[this.selectedKeyframeIndex];
        this.copiedSingleValue = {
          value: kf.value,
          easing: kf.easing || 'linear'
        };
      }
    } else if (e.ctrlKey && (e.key === 'v' || e.key === 'V')) {
      if (this.copiedSingleValue !== null) {
        e.preventDefault();
        const duration = parseFloat(this.exportDurationEl.value) || 10;
        const maxFrames = duration * 60;
        const currentFrame = (this.mainApp.accumulatedTime / 1000) * 60;
        let targetFrame = Math.max(0, Math.min(maxFrames, Math.round(currentFrame)));

        // Snap feature
        const snapVal = this.timelineSnapSelectEl ? this.timelineSnapSelectEl.value : 'off';
        if (snapVal !== 'off') {
          const snap = parseInt(snapVal, 10);
          targetFrame = Math.round(targetFrame / snap) * snap;
          targetFrame = Math.max(0, Math.min(maxFrames, targetFrame));
        }

        // Check if there is an existing keyframe at this frame
        const existingKf = mod.keyframes.find(kf => kf.frame === targetFrame);
        if (existingKf) {
          existingKf.value = this.copiedSingleValue.value;
          existingKf.easing = this.copiedSingleValue.easing;
          this.selectedKeyframeIndex = mod.keyframes.findIndex(k => k === existingKf);
        } else {
          const newKf = {
            frame: targetFrame,
            value: this.copiedSingleValue.value,
            easing: this.copiedSingleValue.easing
          };
          mod.keyframes.push(newKf);
          mod.keyframes.sort((a, b) => a.frame - b.frame);
          this.selectedKeyframeIndex = mod.keyframes.findIndex(k => k === newKf);
        }

        // Populate precise edit UI
        const kf = mod.keyframes[this.selectedKeyframeIndex];
        this.keyPreciseFrameEl.value = kf.frame;
        this.keyPreciseFrameEl.disabled = false;
        this.keyPreciseValueEl.value = kf.value.toFixed(4);
        this.keyPreciseValueEl.disabled = false;
        this.keyPreciseEasingEl.value = kf.easing || 'linear';
        this.keyPreciseEasingEl.disabled = false;
        this.btnKeyPreciseDeleteEl.disabled = false;

        this.mainApp.renderSingleFrame();
        this.drawTimeline();
      }
    }
  }

  drawTimeline() {
    if (!this.timelineCanvas) return;
    const ctx = this.timelineCanvas.getContext('2d');
    
    // Fit canvas resolution to actual client container size
    const W = this.timelineCanvas.clientWidth;
    const H = this.timelineCanvas.clientHeight;
    this.timelineCanvas.width = W;
    this.timelineCanvas.height = H;

    ctx.clearRect(0, 0, W, H);

    const activeLayer = this.layerManager.layers.find(l => l.id === this.activeLayerId);
    if (!activeLayer || !this.activeTimelineParam) {
      // Disable keyframe editor tools
      this.keyPreciseFrameEl.disabled = true;
      this.keyPreciseValueEl.disabled = true;
      this.keyPreciseEasingEl.disabled = true;
      this.btnKeyPreciseDeleteEl.disabled = true;
      this.btnKeyClearAllEl.disabled = true;
      this.btnKeyCopyEl.disabled = true;
      this.btnKeyPasteEl.disabled = true;
      this.timelineSnapSelectEl.disabled = true;
      if (this.timelineSnapValueSelectEl) this.timelineSnapValueSelectEl.disabled = true;
      if (this.timelineTemplateSelectEl) this.timelineTemplateSelectEl.disabled = true;
      if (this.btnKeySaveTemplateEl) this.btnKeySaveTemplateEl.disabled = true;

      // Draw placeholder with seek ruler showing current position
      const duration = parseFloat(this.exportDurationEl.value) || 10;
      const maxFrames = duration * 60;
      const leftMargin = 50, rightMargin = 20, topMargin = 20, bottomMargin = 20;
      const graphWidth = W - leftMargin - rightMargin;

      // Empty state text
      ctx.fillStyle = '#9ca3af';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Select a parameter and click 🔑 to edit its keyframes timeline', W / 2, H / 2 + 8);
      this.timelineActiveParamEl.textContent = 'Select a parameter to animate';

      // Draw second marks on empty ruler
      ctx.fillStyle = 'rgba(15, 15, 26, 0.95)';
      ctx.fillRect(0, 0, W, topMargin);
      for (let f = 0; f <= maxFrames; f += 60) {
        const x = leftMargin + (f / maxFrames) * graphWidth;
        ctx.strokeStyle = 'rgba(124, 58, 237, 0.15)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, topMargin);
        ctx.lineTo(x, H - bottomMargin);
        ctx.stroke();
        ctx.fillStyle = '#4b5563';
        ctx.font = '9px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(`${f / 60}s`, x, topMargin - 4);
      }

      // Playhead on empty timeline
      const currentFrame = (this.mainApp.accumulatedTime / 1000) * 60;
      if (currentFrame >= 0 && currentFrame <= maxFrames) {
        const x = leftMargin + (currentFrame / maxFrames) * graphWidth;
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1.5;
        ctx.shadowBlur = 4;
        ctx.shadowColor = '#ef4444';
        ctx.beginPath();
        ctx.moveTo(x, topMargin);
        ctx.lineTo(x, H - bottomMargin);
        ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.beginPath();
        ctx.moveTo(x - 6, 2);
        ctx.lineTo(x + 6, 2);
        ctx.lineTo(x, topMargin - 2);
        ctx.closePath();
        ctx.fillStyle = '#ef4444';
        ctx.shadowBlur = 6;
        ctx.shadowColor = '#ef4444';
        ctx.fill();
        ctx.shadowBlur = 0;

        const tcSec = Math.floor(this.mainApp.accumulatedTime / 1000);
        const tcMs  = Math.floor(this.mainApp.accumulatedTime) % 1000;
        const tcLabel = `${String(tcSec).padStart(2,'0')}.${String(tcMs).padStart(3,'0')}`;
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = '#fca5a5';
        const labelX = Math.max(leftMargin + 22, Math.min(W - rightMargin - 22, x));
        ctx.fillText(tcLabel, labelX, 3);
      }
      return;
    }

    const mod = activeLayer.modulations[this.activeTimelineParam];
    const config = this.getParamConfig(activeLayer, this.activeTimelineParam);
    if (!mod || !config) return;

    if (!mod.keyframes) {
      mod.keyframes = [];
    }

    // Enable keyframe tools
    this.btnKeyClearAllEl.disabled = false;
    this.btnKeyCopyEl.disabled = false;
    this.btnKeyPasteEl.disabled = !this.copiedKeyframes;
    this.timelineSnapSelectEl.disabled = false;
    if (this.timelineSnapValueSelectEl) this.timelineSnapValueSelectEl.disabled = false;
    if (this.timelineTemplateSelectEl) this.timelineTemplateSelectEl.disabled = false;
    if (this.btnKeySaveTemplateEl) this.btnKeySaveTemplateEl.disabled = false;

    // Sync precise input disabled states based on keyframe selection
    if (this.selectedKeyframeIndex !== -1 && mod.keyframes[this.selectedKeyframeIndex]) {
      const kf = mod.keyframes[this.selectedKeyframeIndex];
      this.keyPreciseFrameEl.disabled = false;
      this.keyPreciseValueEl.disabled = false;
      this.keyPreciseEasingEl.disabled = false;
      this.keyPreciseEasingEl.value = kf.easing || 'linear';
      this.btnKeyPreciseDeleteEl.disabled = false;
    } else {
      this.keyPreciseFrameEl.disabled = true;
      this.keyPreciseValueEl.disabled = true;
      this.keyPreciseEasingEl.disabled = true;
      this.btnKeyPreciseDeleteEl.disabled = true;
    }

    this.timelineActiveParamEl.textContent = `${activeLayer.name} : ${config.label} (Min: ${config.min}, Max: ${config.max})`;

    const leftMargin = 50, rightMargin = 20, topMargin = 20, bottomMargin = 20;
    const graphWidth = W - leftMargin - rightMargin;
    const graphHeight = H - topMargin - bottomMargin;
    const duration = parseFloat(this.exportDurationEl.value) || 10;
    const maxFrames = duration * 60;

    // 1. Draw Grid Lines
    ctx.strokeStyle = 'rgba(124, 58, 237, 0.1)';
    ctx.lineWidth = 1;
    
    // Vertical frame lines (every 60 frames = 1 sec)
    for (let f = 0; f <= maxFrames; f += 60) {
      const x = leftMargin + (f / maxFrames) * graphWidth;
      ctx.beginPath();
      ctx.moveTo(x, topMargin);
      ctx.lineTo(x, H - bottomMargin);
      ctx.stroke();

      // Label under grid
      ctx.fillStyle = '#4b5563';
      ctx.font = '0.65rem monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${f}f`, x, H - 5);
    }

    // Horizontal value lines (5 subdivisions)
    for (let i = 0; i <= 4; i++) {
      const val = config.min + (i / 4) * (config.max - config.min);
      const y = topMargin + (1 - i / 4) * graphHeight;
      ctx.beginPath();
      ctx.moveTo(leftMargin, y);
      ctx.lineTo(W - rightMargin, y);
      ctx.stroke();

      // Label on the left
      ctx.fillStyle = '#6b7280';
      ctx.font = '0.65rem monospace';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(val.toFixed(2), leftMargin - 5, y);
    }

    // 2. Draw Ruler Ruler Background
    ctx.fillStyle = 'rgba(15, 15, 26, 0.9)';
    ctx.fillRect(leftMargin, 0, graphWidth, topMargin);
    ctx.strokeStyle = 'rgba(124, 58, 237, 0.3)';
    ctx.beginPath();
    ctx.moveTo(leftMargin, topMargin);
    ctx.lineTo(W - rightMargin, topMargin);
    ctx.stroke();

    // Draw Ruler Tick Marks
    ctx.fillStyle = '#9ca3af';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    for (let f = 0; f <= maxFrames; f += 10) {
      const x = leftMargin + (f / maxFrames) * graphWidth;
      ctx.beginPath();
      ctx.moveTo(x, topMargin);
      if (f % 60 === 0) {
        ctx.lineTo(x, topMargin - 8);
        ctx.fillText(`${f / 60}s`, x, topMargin - 10);
      } else {
        ctx.lineTo(x, topMargin - 4);
      }
      ctx.strokeStyle = 'rgba(156, 163, 175, 0.4)';
      ctx.stroke();
    }

    // 3. Draw Interpolation Line / Path (with easing curve support)
    if (mod.keyframes.length > 0) {
      ctx.beginPath();
      
      // Draw first flat line from 0 to first keyframe frame
      if (mod.keyframes[0].frame > 0) {
        const firstKf = mod.keyframes[0];
        const y = topMargin + (1 - (firstKf.value - config.min) / (config.max - config.min)) * graphHeight;
        ctx.moveTo(leftMargin, y);
        ctx.lineTo(leftMargin + (firstKf.frame / maxFrames) * graphWidth, y);
      } else {
        const firstKf = mod.keyframes[0];
        const y = topMargin + (1 - (firstKf.value - config.min) / (config.max - config.min)) * graphHeight;
        ctx.moveTo(leftMargin, y);
      }

      for (let i = 0; i < mod.keyframes.length - 1; i++) {
        const kfA = mod.keyframes[i];
        const kfB = mod.keyframes[i + 1];
        const xA = leftMargin + (kfA.frame / maxFrames) * graphWidth;
        const yA = topMargin + (1 - (kfA.value - config.min) / (config.max - config.min)) * graphHeight;
        const xB = leftMargin + (kfB.frame / maxFrames) * graphWidth;
        const yB = topMargin + (1 - (kfB.value - config.min) / (config.max - config.min)) * graphHeight;

        const easing = kfA.easing || 'linear';
        const frameDiff = kfB.frame - kfA.frame;

        if (frameDiff <= 0) {
          ctx.lineTo(xB, yB);
        } else {
          // Subdivide to render smooth curves
          const stepSize = Math.max(1, Math.floor(frameDiff / 30));
          for (let f = kfA.frame; f <= kfB.frame; f += stepSize) {
            const t = (f - kfA.frame) / frameDiff;
            let tPrime = t;
            if (easing === 'step') {
              tPrime = t < 1.0 ? 0.0 : 1.0;
            } else if (easing === 'ease-in') {
              tPrime = t * t;
            } else if (easing === 'ease-out') {
              tPrime = t * (2.0 - t);
            } else if (easing === 'ease-in-out') {
              tPrime = t < 0.5 ? 2.0 * t * t : -1.0 + (4.0 - 2.0 * t) * t;
            }
            const val = kfA.value + (kfB.value - kfA.value) * tPrime;
            const x = leftMargin + (f / maxFrames) * graphWidth;
            const y = topMargin + (1 - (val - config.min) / (config.max - config.min)) * graphHeight;
            ctx.lineTo(x, y);
          }
          ctx.lineTo(xB, yB);
        }
      }

      // Draw last flat line from last keyframe frame to end of duration
      const lastKf = mod.keyframes[mod.keyframes.length - 1];
      if (lastKf.frame < maxFrames) {
        const y = topMargin + (1 - (lastKf.value - config.min) / (config.max - config.min)) * graphHeight;
        ctx.lineTo(leftMargin + graphWidth, y);
      }

      ctx.strokeStyle = '#c084fc';
      ctx.lineWidth = 2;
      ctx.shadowBlur = 4;
      ctx.shadowColor = '#c084fc';
      ctx.stroke();
      ctx.shadowBlur = 0; // reset
    }

    // 4. Draw Keyframe Dots
    for (let i = 0; i < mod.keyframes.length; i++) {
      const kf = mod.keyframes[i];
      const x = leftMargin + (kf.frame / maxFrames) * graphWidth;
      const y = topMargin + (1 - (kf.value - config.min) / (config.max - config.min)) * graphHeight;

      const isSelected = (i === this.selectedKeyframeIndex);
      
      ctx.beginPath();
      ctx.arc(x, y, isSelected ? 6 : 4, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? '#fbbf24' : '#a855f7';
      ctx.shadowBlur = isSelected ? 10 : 4;
      ctx.shadowColor = isSelected ? '#fbbf24' : '#a855f7';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.stroke();
      ctx.shadowBlur = 0; // reset
    }

    // 5. Draw Current Position (Red Playback Seek Line + ▼ marker)
    const currentFrame = (this.mainApp.accumulatedTime / 1000) * 60;
    if (currentFrame >= 0 && currentFrame <= maxFrames) {
      const x = leftMargin + (currentFrame / maxFrames) * graphWidth;
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1.5;
      ctx.shadowBlur = 4;
      ctx.shadowColor = '#ef4444';
      
      // Vertical line through graph area
      ctx.beginPath();
      ctx.moveTo(x, topMargin);
      ctx.lineTo(x, H - bottomMargin);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // ▼ downward triangle marker at top of ruler
      ctx.beginPath();
      ctx.moveTo(x - 6, 2);
      ctx.lineTo(x + 6, 2);
      ctx.lineTo(x, topMargin - 2);
      ctx.closePath();
      ctx.fillStyle = '#ef4444';
      ctx.shadowBlur = 6;
      ctx.shadowColor = '#ef4444';
      ctx.fill();
      ctx.shadowBlur = 0;

      // Timecode label just below the ▼ marker (in ruler band)
      const tcSec = Math.floor(this.mainApp.accumulatedTime / 1000);
      const tcMs  = Math.floor(this.mainApp.accumulatedTime) % 1000;
      const tcLabel = `${String(tcSec).padStart(2,'0')}.${String(tcMs).padStart(3,'0')}`;
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#fca5a5';
      ctx.shadowBlur = 0;
      // Keep label inside canvas bounds
      const labelX = Math.max(leftMargin + 22, Math.min(W - rightMargin - 22, x));
      ctx.fillText(tcLabel, labelX, topMargin + 2);
    }
  }

  updatePlayPauseButton(isPlaying) {
    const icon = this.btnPlayPauseEl.querySelector('.btn-icon');
    const text = this.btnPlayPauseEl.querySelector('.btn-text');
    if (isPlaying) {
      icon.textContent = '⏸';
      text.textContent = 'Pause';
      this.btnPlayPauseEl.classList.add('btn-secondary');
      this.btnPlayPauseEl.classList.remove('btn-primary');
    } else {
      icon.textContent = '▶';
      text.textContent = 'Play';
      this.btnPlayPauseEl.classList.add('btn-primary');
      this.btnPlayPauseEl.classList.remove('btn-secondary');
    }
  }

  /**
   * Refreshes the currently inspected UI values during real-time rendering.
   * Runs inside requestAnimationFrame.
   */
  updateUIValues() {
    if (!this.activeLayerId) return;
    const activeLayer = this.layerManager.layers.find(l => l.id === this.activeLayerId);
    if (!activeLayer) return;

    // 1. Update Generator dynamic parameter sliders
    const modConfigs = activeLayer.generator.getParameterConfig();
    modConfigs.forEach(config => {
      if (config.type !== 'range') return;
      this.updateSliderUI(config.name, activeLayer.generator.params[config.name]);
    });

    // 2. Update FX modulation sliders (now covers all FX including Trails/Spin/Warp)
    for (let fxName in this.fxConfigs) {
      this.updateSliderUI(fxName, activeLayer.effects[fxName]);
    }

    // 3. Update timeline playhead position
    this.drawTimeline();
  }

  updateSliderUI(paramName, currentVal) {
    const fieldWrapper = this.inspectorContentEl.querySelector(`.layer-field-wrapper[data-param="${paramName}"]`);
    if (!fieldWrapper) return;
    
    const slider = fieldWrapper.querySelector('.param-slider');
    const valDisplay = fieldWrapper.querySelector('.val-display');
    
    if (slider && valDisplay && document.activeElement !== slider) {
      slider.value = currentVal;
      valDisplay.textContent = currentVal % 1 === 0 ? currentVal.toString() : currentVal.toFixed(4);
    }
  }

  /**
   * Builds the export filename base (no extension): the front-most visible layer's name plus
   * a timestamp, e.g. "Dot Design07 (Imported)_20260721_184230". "Front-most" matches what the
   * Layers panel shows at the top of the list - the last entry in layerManager.layers (layers
   * are composited/rendered in array order, so the last one draws on top). Falls back to
   * "MovieCreator" if there are no visible layers.
   */
  buildExportFilename() {
    const visibleLayers = this.layerManager.layers.filter(l => l.visible);
    const topLayer = visibleLayers[visibleLayers.length - 1];
    const presetPart = topLayer ? topLayer.name : 'MovieCreator';

    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const datePart = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

    return `${presetPart}_${datePart}`;
  }

  /**
   * Rebuilds the upper Layers Hierarchy list.
   */
  rebuildLayersList() {
    this.layersListEl.innerHTML = '';
    
    if (this.layerManager.layers.length === 0) {
      this.layersListEl.innerHTML = `
        <div class="empty-state" style="padding: 1.5rem; text-align: center; font-size: 0.8rem; color: var(--color-text-muted);">
          No layers added.
        </div>
      `;
      this.activeLayerId = null;
      return;
    }

    // Render layers in reverse order (top is rendered last/on top of composite stack)
    const reversedLayers = [...this.layerManager.layers].reverse();

    reversedLayers.forEach((layer) => {
      const row = document.createElement('div');
      row.className = `layer-item-simple ${layer.id === this.activeLayerId ? 'active' : ''}`;
      row.dataset.id = layer.id;

      const eyeIcon = layer.visible ? '👁' : '👁‍🗨';
      const visibleClass = layer.visible ? '' : 'hidden-state';

      row.innerHTML = `
        <div class="layer-simple-drag" draggable="true" title="Drag to reorder">☰</div>
        <button class="btn-layer-simple-eye ${visibleClass}" title="Toggle Visibility">${eyeIcon}</button>
        <span class="layer-simple-title layer-name-text">${layer.name}</span>
        <span class="layer-simple-badge">${layer.type.split('-')[0]}</span>
        <button class="btn-layer-simple-delete" title="Delete Layer">🗑</button>
      `;

      // Click row to SELECT and inspect parameters
      row.addEventListener('click', (e) => {
        if (e.target.closest('.btn-layer-simple-eye') || e.target.closest('.btn-layer-simple-delete') || e.target.classList.contains('layer-simple-drag')) {
          return;
        }
        this.activeLayerId = layer.id;
        this.rebuildLayersList();
        this.rebuildInspector();
      });

      // Visibility Toggle
      const btnEye = row.querySelector('.btn-layer-simple-eye');
      btnEye.addEventListener('click', (e) => {
        e.stopPropagation();
        layer.visible = !layer.visible;
        this.rebuildLayersList();
        this.mainApp.renderSingleFrame();
      });

      // Delete Layer
      const btnDelete = row.querySelector('.btn-layer-simple-delete');
      btnDelete.addEventListener('click', (e) => {
        e.stopPropagation();
        this.layerManager.removeLayer(layer.id);
        
        // If deleted active layer, focus another one
        if (this.activeLayerId === layer.id) {
          this.activeLayerId = this.layerManager.layers.length > 0 ? this.layerManager.layers[0].id : null;
        }
        this.rebuildLayersList();
        this.rebuildInspector();
        this.mainApp.renderSingleFrame();
      });

      // Drag-to-reorder: grab only from the ☰ handle (native HTML5 drag), drop on any other row
      // to move this layer there. Was previously dead UI - the handle had cursor:grab styling and
      // the row-click handler already excluded it, but no drag events were ever wired up and
      // LayerManager.reorderLayers() sat unused. Indices are translated back to the real
      // (non-reversed) layer array, since this list renders top-of-stack first.
      const dragHandle = row.querySelector('.layer-simple-drag');
      dragHandle.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', String(layer.id));
        e.dataTransfer.effectAllowed = 'move';
        row.classList.add('dragging');
      });
      dragHandle.addEventListener('dragend', () => {
        row.classList.remove('dragging');
      });

      row.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        row.classList.add('drag-over');
      });
      row.addEventListener('dragleave', () => {
        row.classList.remove('drag-over');
      });
      row.addEventListener('drop', (e) => {
        e.preventDefault();
        row.classList.remove('drag-over');
        const draggedId = parseInt(e.dataTransfer.getData('text/plain'), 10);
        if (!draggedId || draggedId === layer.id) return;

        const layers = this.layerManager.layers;
        const oldIndex = layers.findIndex(l => l.id === draggedId);
        const newIndex = layers.findIndex(l => l.id === layer.id);
        if (oldIndex === -1 || newIndex === -1) return;

        this.layerManager.reorderLayers(oldIndex, newIndex);
        this.rebuildLayersList();
        this.mainApp.renderSingleFrame();
      });

      this.layersListEl.appendChild(row);
    });
  }

  /**
   * Updates the small teacher-data summary badge shown left of the Play button, so the
   * evaluation counts for whichever layer is currently active are always at a glance -
   * same underlying counts as showLearningStatsDialog's per-layer-type section, just
   * always-visible instead of buried behind the 📊 button.
   */
  updateHeaderLayerStatus(layer) {
    if (!this.layerStatusBadgeEl) return;
    if (!layer) {
      this.layerStatusBadgeEl.style.display = 'none';
      return;
    }

    const layerData = (this.scoreData || []).filter(e => e.layerType === layer.type);
    const total = layerData.length;
    const good = layerData.filter(e => e.score === 'good').length;
    const bad = layerData.filter(e => e.score === 'bad').length;

    this.layerStatusTypeEl.innerHTML = `<strong>${layer.type}</strong>`;
    this.layerStatusCountsEl.textContent = `👍${good} / 👎${bad} (${total}件)`;
    this.layerStatusBadgeEl.title = `Layer Type: ${layer.type}\nこのレイヤータイプの評価数: ${total}回 (👍 ${good} / 👎 ${bad})`;
    this.layerStatusBadgeEl.style.display = 'flex';
  }

  /**
   * Rebuilds the Inspector details panel for the active layer.
   */
  rebuildInspector() {
    // Auto-restore dock if popup window was closed externally
    if (this.isDetached && (!this.popupWindow || this.popupWindow.closed)) {
      this.attachInspector();
    }

    this.inspectorContentEl.innerHTML = '';

    if (!this.activeLayerId) {
      this.inspectorLayerNameEl.value = 'No Selected Layer';
      this.inspectorLayerNameEl.disabled = true;
      this.inspectorContentEl.innerHTML = `
        <div class="inspector-empty">
          <p style="font-size: 1.5rem;">🔍</p>
          <p>Select a layer to adjust parameters</p>
        </div>
      `;
      this.updateHeaderLayerStatus(null);
      return;
    }

    const layer = this.layerManager.layers.find(l => l.id === this.activeLayerId);
    if (!layer) {
      this.activeLayerId = null;
      this.rebuildInspector();
      return;
    }

    this.updateHeaderLayerStatus(layer);

    this.inspectorLayerNameEl.value = layer.name;
    this.inspectorLayerNameEl.disabled = false;
    this.inspectorLayerNameEl.oninput = (e) => {
      layer.name = e.target.value;
      const rowText = this.layersListEl.querySelector(`.layer-item-simple[data-id="${layer.id}"] .layer-name-text`);
      if (rowText) {
        rowText.textContent = layer.name;
      }
    };

    // 1. Create top level settings (Spread & Randomizer)
    const randomizerHeader = this.createElement('div');
    randomizerHeader.style.padding = '0.5rem 0.25rem 1rem 0.25rem';
    randomizerHeader.style.borderBottom = '1px solid var(--border-color)';
    randomizerHeader.style.display = 'flex';
    randomizerHeader.style.alignItems = 'center';
    randomizerHeader.style.justifyContent = 'space-between';
    randomizerHeader.style.gap = '0.75rem';

    const currentSpread = layer.randomSpread !== undefined ? layer.randomSpread : 50;
    const hasPatternParams = !!(layer.generator.getPatternParamNames && layer.generator.getPatternParamNames().length > 0);
    randomizerHeader.innerHTML = `
      <div style="display: flex; align-items: center; gap: 0.5rem; flex: 1;">
        <span style="font-size: 0.75rem; color: var(--color-text-muted); font-weight: 600; white-space: nowrap;">LFO Spread</span>
        <input type="range" class="random-spread-slider" min="10" max="100" step="5" value="${currentSpread}" style="flex: 1; height: 4px;">
        <span class="spread-val-display" style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--color-accent); width: 35px; text-align: right;">${currentSpread}%</span>
      </div>
      <button class="btn btn-secondary btn-small btn-randomize" style="padding: 0.25rem 0.65rem; font-size: 0.75rem;">🎲 Random LFO</button>
      ${hasPatternParams ? `<button class="btn btn-secondary btn-small btn-randomize-pattern" title="Reroll only the pattern shape - color/size/speed/etc. stay as-is" style="padding: 0.25rem 0.65rem; font-size: 0.75rem;">🔀 Pattern</button>` : ''}
      <div style="display: flex; gap: 0.25rem;">
        <button class="btn btn-secondary btn-small btn-reset-layer" title="Reset parameters & FX to defaults" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; min-width: 28px;">↺</button>
        <button class="btn btn-secondary btn-small btn-score-stats" title="View Learning Progress & Stats" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; min-width: 28px;">📊</button>
        <button class="btn btn-secondary btn-small btn-opinion-sheet" title="Edit Score/Move Tendencies (Opinion Sheet)" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; min-width: 28px;">📝</button>
        <button class="btn btn-secondary btn-small btn-score-rate" title="Rate this generation (1-10 + comment)" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">⭐ Rate</button>
      </div>
    `;

    const spreadSlider = randomizerHeader.querySelector('.random-spread-slider');
    const spreadDisplay = randomizerHeader.querySelector('.spread-val-display');
    const btnRandom = randomizerHeader.querySelector('.btn-randomize');
    const btnRandomPattern = randomizerHeader.querySelector('.btn-randomize-pattern');
    const btnResetLayer = randomizerHeader.querySelector('.btn-reset-layer');
    const btnRate = randomizerHeader.querySelector('.btn-score-rate');
    const btnStats = randomizerHeader.querySelector('.btn-score-stats');
    const btnOpinionSheet = randomizerHeader.querySelector('.btn-opinion-sheet');

    btnResetLayer.addEventListener('click', async () => {
      const ok = await this.showConfirmDialog(
        'Reset Layer',
        `"${layer.name}" のパラメータ・共通FX・モーションを全てデフォルトに戻します。元に戻せません。続行しますか？`
      );
      if (!ok) return;
      layer.resetToDefaults();
      this.rebuildInspector();
      this.mainApp.renderSingleFrame();
      this.showToast('↺ Layer reset to defaults', 'success');
    });

    spreadSlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      spreadDisplay.textContent = `${val}%`;
      layer.randomSpread = val;
    });

    btnRandom.addEventListener('click', () => {
      this.randomizeLayer(layer, layer.randomSpread);
      this.rebuildInspector(); // Redraw UI fields to reflect values
      this.mainApp.renderSingleFrame();
    });

    if (btnRandomPattern) {
      btnRandomPattern.addEventListener('click', () => {
        this.randomizePatternOnly(layer);
        this.rebuildInspector();
        this.mainApp.renderSingleFrame();
      });
    }

    btnRate.addEventListener('click', async () => {
      const result = await this.showRatingDialog(layer);
      if (result) {
        this.rateLayer(layer, result.rating, result.comment, result.reasons, result.paramFlags, btnRate);
      }
    });

    btnStats.addEventListener('click', () => {
      this.showLearningStatsDialog(layer.type);
    });

    btnOpinionSheet.addEventListener('click', () => {
      this.showOpinionSheetEditor(layer);
    });

    this.inspectorContentEl.appendChild(randomizerHeader);

    // 1-A-2. Batch Export Control Header
    const batchHeader = this.createElement('div');
    batchHeader.className = 'batch-export-header';
    batchHeader.style.padding = '0.5rem 0.25rem 0.5rem 0.25rem';
    batchHeader.style.borderBottom = '1px solid var(--border-color)';
    batchHeader.style.display = 'flex';
    batchHeader.style.flexDirection = 'column';
    batchHeader.style.gap = '0.5rem';
    batchHeader.style.marginBottom = '0.5rem';

    batchHeader.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <span style="font-size: 0.75rem; font-weight: bold; color: var(--color-text-dim); text-transform: uppercase; letter-spacing: 0.05em;">Batch Generator</span>
      </div>
      <div style="display: flex; align-items: center; gap: 0.5rem; justify-content: space-between;">
        <div style="display: flex; align-items: center; gap: 0.25rem;">
          <span style="font-size: 0.7rem; color: var(--color-text-dim);">Count:</span>
          <input type="number" class="batch-count" value="${this.batchCount}" min="1" max="50" style="width: 45px; background: rgba(0,0,0,0.3); border: 1px solid var(--border-color); color: white; font-size: 0.75rem; padding: 0.1rem 0.25rem; border-radius: 3px; text-align: center;">
        </div>
        <div style="display: flex; align-items: center; gap: 0.25rem;">
          <span style="font-size: 0.7rem; color: var(--color-text-dim);">Filter:</span>
          <input type="number" class="batch-threshold" value="${this.batchThreshold}" min="50" max="99" style="width: 40px; background: rgba(0,0,0,0.3); border: 1px solid var(--border-color); color: white; font-size: 0.75rem; padding: 0.1rem 0.25rem; border-radius: 3px; text-align: center;">
          <span style="font-size: 0.7rem; color: var(--color-text-dim);">%</span>
        </div>
        <button class="btn btn-accent btn-small btn-batch-export" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; flex: 1;">🎬 Batch Generator...</button>
      </div>
    `;

    const btnBatchExport = batchHeader.querySelector('.btn-batch-export');
    const batchCountInput = batchHeader.querySelector('.batch-count');
    const batchThresholdInput = batchHeader.querySelector('.batch-threshold');

    batchCountInput.addEventListener('input', (e) => {
      this.batchCount = parseInt(e.target.value, 10) || 10;
    });

    batchThresholdInput.addEventListener('input', (e) => {
      this.batchThreshold = parseInt(e.target.value, 10) || 90;
    });

    btnBatchExport.addEventListener('click', async () => {
      await this.showBatchGeneratorWizard(layer);
    });

    this.inspectorContentEl.appendChild(batchHeader);

    // 1-B. Motion Preset Selection Row
    const presetRow = this.createElement('div');
    presetRow.style.padding = '0rem 0.25rem 1rem 0.25rem';
    presetRow.style.borderBottom = '1px solid var(--border-color)';
    presetRow.style.display = 'flex';
    presetRow.style.alignItems = 'center';
    presetRow.style.justifyContent = 'space-between';
    presetRow.style.gap = '0.75rem';
    presetRow.style.marginBottom = '0.5rem';

    const savedPreset = layer.currentPresetName || 'static-none';

    presetRow.innerHTML = `
      <span style="font-size: 0.75rem; color: var(--color-text-muted); font-weight: 600; white-space: nowrap;">Motion Preset</span>
      <select class="motion-preset-select" style="flex: 1; padding: 0.3rem 0.5rem; font-size: 0.8rem; height: 30px; border-radius: 4px; background: var(--bg-control); border: 1px solid var(--border-color); color: var(--color-text);">
        <option value="static-none" ${savedPreset === 'static-none' ? 'selected' : ''}>Static (No LFO)</option>
        <option value="slow-evolution" ${savedPreset === 'slow-evolution' ? 'selected' : ''}>Slow Evolution (緩やかな形変)</option>
        <option value="pulsing-heart" ${savedPreset === 'pulsing-heart' ? 'selected' : ''}>Pulsing Heart (脈動パルス)</option>
        <option value="cosmic-spin" ${savedPreset === 'cosmic-spin' ? 'selected' : ''}>Cosmic Spin (宇宙的回転)</option>
        <option value="hyper-strobe" ${savedPreset === 'hyper-strobe' ? 'selected' : ''}>Hyper Strobe (高速明滅)</option>
        <option value="growing-spiral" ${savedPreset === 'growing-spiral' ? 'selected' : ''}>Growing Spiral (螺旋巨大化)</option>
        <option value="glitch-chaos" ${savedPreset === 'glitch-chaos' ? 'selected' : ''}>Glitch Chaos (グリッチカオス)</option>
      </select>
      <button class="btn btn-secondary btn-small btn-clear-automation" title="Clear all LFO/KeyFrame/Randomizer flags for this layer (keeps current values)" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; white-space: nowrap;">🧹 Clear All</button>
    `;

    presetRow.querySelector('select').addEventListener('change', (e) => {
      layer.applyPreset(e.target.value);
      this.rebuildInspector(); // Dynamic redrawing to show automation toggles
      this.mainApp.renderSingleFrame();
    });

    presetRow.querySelector('.btn-clear-automation').addEventListener('click', async () => {
      const ok = await this.showConfirmDialog(
        'Clear All Automation',
        `"${layer.name}" の全パラメータのLFO・KeyFrame・Randomizer(🎲)を解除します(現在の数値はそのまま維持されます)。続行しますか？`
      );
      if (!ok) return;
      layer.clearAllAutomation();
      this.rebuildInspector();
      this.mainApp.renderSingleFrame();
      this.showToast('🧹 LFO/KeyFrame/Randomizer cleared', 'success');
    });

    this.inspectorContentEl.appendChild(presetRow);

    // 2. Composite Settings Section
    const blendSection = this.createElement('div');
    blendSection.className = 'param-section';
    blendSection.innerHTML = `<h4 style="font-size: 0.75rem; text-transform: uppercase; color: var(--color-primary); margin-bottom: 0.75rem;">Layer Compositing</h4>`;

    // Opacity
    const opacityField = this.createSliderField(
      'opacity', 'Opacity', 0, 1, 0.05, layer.opacity,
      (val) => { 
        layer.opacity = parseFloat(val); 
        this.mainApp.renderSingleFrame();
      }
    );
    blendSection.appendChild(opacityField);

    // Blend mode
    const blendField = this.createElement('div');
    blendField.className = 'layer-field';
    blendField.innerHTML = `
      <label style="font-size: 0.8rem; font-weight:600; color:var(--color-text-muted);">Blend Mode</label>
      <div style="grid-column: span 2;">
        <select class="blend-select" style="width: 100%; padding: 0.35rem 0.75rem; font-size:0.8rem;">
          <option value="source-over" ${layer.blendMode === 'source-over' ? 'selected' : ''}>Normal</option>
          <option value="lighter" ${layer.blendMode === 'lighter' ? 'selected' : ''}>Add (加算発光)</option>
          <option value="screen" ${layer.blendMode === 'screen' ? 'selected' : ''}>Screen</option>
          <option value="multiply" ${layer.blendMode === 'multiply' ? 'selected' : ''}>Multiply</option>
          <option value="difference" ${layer.blendMode === 'difference' ? 'selected' : ''}>Difference</option>
          <option value="exclusion" ${layer.blendMode === 'exclusion' ? 'selected' : ''}>Exclusion</option>
          <option value="overlay" ${layer.blendMode === 'overlay' ? 'selected' : ''}>Overlay</option>
          <option value="soft-light" ${layer.blendMode === 'soft-light' ? 'selected' : ''}>Soft Light</option>
          <option value="hard-light" ${layer.blendMode === 'hard-light' ? 'selected' : ''}>Hard Light</option>
          <option value="color-dodge" ${layer.blendMode === 'color-dodge' ? 'selected' : ''}>Color Dodge</option>
          <option value="color-burn" ${layer.blendMode === 'color-burn' ? 'selected' : ''}>Color Burn</option>
          <option value="darken" ${layer.blendMode === 'darken' ? 'selected' : ''}>Darken</option>
          <option value="lighten" ${layer.blendMode === 'lighten' ? 'selected' : ''}>Lighten</option>
          <option value="hue" ${layer.blendMode === 'hue' ? 'selected' : ''}>Hue (色相のみ置換)</option>
          <option value="saturation" ${layer.blendMode === 'saturation' ? 'selected' : ''}>Saturation (彩度のみ置換)</option>
          <option value="color" ${layer.blendMode === 'color' ? 'selected' : ''}>Color (色相+彩度を置換)</option>
          <option value="luminosity" ${layer.blendMode === 'luminosity' ? 'selected' : ''}>Luminosity (明度のみ置換)</option>
        </select>
      </div>
    `;
    blendField.querySelector('select').addEventListener('change', (e) => {
      layer.blendMode = e.target.value;
      this.mainApp.renderSingleFrame();
    });
    blendSection.appendChild(blendField);
    this.inspectorContentEl.appendChild(blendSection);

    // 3. Generator Parameters Section
    const genSection = this.createElement('div');
    genSection.className = 'param-section-grid';
    genSection.innerHTML = `<h4 style="font-size: 0.75rem; text-transform: uppercase; color: var(--color-accent); margin-bottom: 0.75rem;">Generator Parameters</h4>`;

    const configs = layer.generator.getParameterConfig();
    configs.forEach(config => {
      const fieldWrapper = this.createModulatableField(layer, config, (val) => {
        layer.generator.params[config.name] = val;
      });
      genSection.appendChild(fieldWrapper);
    });
    this.inspectorContentEl.appendChild(genSection);

    // 4. Effects / Post-Process Section
    const fxSection = this.createElement('div');
    fxSection.className = 'param-section-grid';
    fxSection.innerHTML = `<h4 style="font-size: 0.75rem; text-transform: uppercase; color: #ff007f; margin-bottom: 0.75rem;">FX / Post-processing</h4>`;

    // Modulatable FX (rotation, scale, strobe, glowIntensity)
    for (let fxName in this.fxConfigs) {
      const config = this.fxConfigs[fxName];
      const fieldWrapper = this.createModulatableField(layer, config, (val) => {
        layer.effects[fxName] = val;
      }, true);
      fxSection.appendChild(fieldWrapper);
    }

    this.inspectorContentEl.appendChild(fxSection);
  }

  createModulatableField(layer, config, onValUpdate, isFx = false) {
    const fieldWrapper = this.createElement('div');
    fieldWrapper.className = 'layer-field-wrapper';
    fieldWrapper.dataset.param = config.name;

    if (config.type === 'range') {
      const mod = layer.modulations[config.name];
      const isModExpanded = this.expandedMods.has(`${layer.id}-${config.name}`);
      const modActiveGlow = mod.enabled ? 'style="color: var(--color-accent); text-shadow: 0 0 8px var(--color-accent);"' : '';
      const keyActiveGlow = mod.keyframeEnabled ? 'class="btn-keyframe-toggle active"' : 'class="btn-keyframe-toggle"';
      const showAddKey = mod.keyframeEnabled ? 'display: inline-block;' : 'display: none;';

      const mainField = this.createElement('div');
      mainField.className = 'layer-field';

      const currentVal = isFx ? layer.effects[config.name] : layer.generator.params[config.name];
      let displayVal = currentVal;
      if (typeof displayVal === 'number') {
        displayVal = displayVal % 1 === 0 ? displayVal.toString() : displayVal.toFixed(4);
      }

      // Spawn Jitter width is per-parameter (dragged directly on the knob button, DAW-style).
      // The badge itself always shows a fixed-width integer percentage (never more than 3
      // digits) so it can't push the row layout around; the actual ± amount in the parameter's
      // own units is available as a hover tooltip for anyone who wants the precise figure.
      const formatJitterPct = () => {
        const jw = mod.jitterWidth !== undefined ? mod.jitterWidth : 20;
        return `${Math.round(jw)}%`;
      };
      const formatJitterDetail = () => {
        const jw = mod.jitterWidth !== undefined ? mod.jitterWidth : 20;
        const half = (config.max - config.min) * (jw / 100) * 0.2;
        return `±${half % 1 === 0 ? half.toString() : half.toFixed(2)}`;
      };

      // Renders the toggle as a small rotary-knob indicator (ring + position dot, like a DAW
      // pot) instead of a static icon, so the current jitter width reads at a glance from the
      // dot's angle and color intensity rather than having to notice a number changing.
      const renderJitterKnob = () => {
        const jw = mod.jitterWidth !== undefined ? mod.jitterWidth : 20;
        const on = !!mod.spawnJitter;
        const thetaRad = (-135 + (jw / 100) * 270) * Math.PI / 180;
        const dotX = (9 + 6.2 * Math.sin(thetaRad)).toFixed(2);
        const dotY = (9 - 6.2 * Math.cos(thetaRad)).toFixed(2);
        const trackOpacity = on ? (0.35 + 0.45 * (jw / 100)).toFixed(2) : 0.25;
        const color = on ? '#f59e0b' : '#9ca3af';
        return `<svg width="18" height="18" viewBox="0 0 18 18" style="display: block;">
          <circle cx="9" cy="9" r="7" fill="none" stroke="${color}" stroke-width="1.4" stroke-opacity="${trackOpacity}"/>
          <circle cx="${dotX}" cy="${dotY}" r="1.7" fill="${color}"/>
        </svg>`;
      };

      mainField.innerHTML = `
        <div class="layer-field-header">
          <label>${config.label}</label>
          <span class="val-display">${displayVal}</span>
          <div style="display: flex; gap: 0.2rem; align-items: center;">
            <button class="btn-spawn-jitter-toggle" title="Click: toggle Spawn Jitter. Drag up/down: set jitter width.">${renderJitterKnob()}</button>
            <span class="jitter-width-badge" title="${formatJitterDetail()}" style="display: ${mod.spawnJitter ? 'inline' : 'none'}; color: #f59e0b;">${formatJitterPct()}</span>
            <button class="btn-modulation-toggle" ${modActiveGlow} title="Toggle LFO Automation">🧬</button>
            <button ${keyActiveGlow} title="Toggle Keyframe Timeline">🔑</button>
            <button class="btn-add-keyframe" style="${showAddKey} font-size: 0.65rem; padding: 0.1rem 0.25rem; line-height: 1;" title="Add Keyframe at Current Time">+ Key</button>
          </div>
        </div>
        <input type="range" class="param-slider" min="${config.min}" max="${config.max}" step="${config.step}" value="${currentVal}">
      `;

      const rangeInput = mainField.querySelector('.param-slider');
      const valDisplay = mainField.querySelector('.val-display');
      const btnModToggle = mainField.querySelector('.btn-modulation-toggle');
      const btnKeyframeToggle = mainField.querySelector('.btn-keyframe-toggle');
      const btnAddKeyframe = mainField.querySelector('.btn-add-keyframe');
      const btnSpawnJitterToggle = mainField.querySelector('.btn-spawn-jitter-toggle');
      const jitterWidthBadge = mainField.querySelector('.jitter-width-badge');

      rangeInput.addEventListener('input', (e) => {
        const v = parseFloat(e.target.value);
        valDisplay.textContent = v % 1 === 0 ? v.toString() : v.toFixed(4);
        onValUpdate(v);

        if (mod && !mod.enabled && !mod.keyframeEnabled) {
          mod.min = v;
          mod.max = v;
          mod.jitterBase = v;
        }
        this.mainApp.renderSingleFrame();
      });

      // Click toggles Spawn Jitter on/off; a vertical drag instead scrubs this parameter's own
      // jitter width (DAW-knob style), so there's no separate numeric input to add per parameter.
      let jitterDragStartY = null;
      let jitterDragStartWidth = null;
      let jitterDragMoved = false;

      const onJitterDragMove = (e) => {
        const dy = jitterDragStartY - e.clientY; // dragging up increases width
        if (Math.abs(dy) > 3) jitterDragMoved = true;
        if (!jitterDragMoved) return;

        mod.jitterWidth = Math.max(0, Math.min(100, Math.round(jitterDragStartWidth + dy * 0.5)));
        if (!mod.spawnJitter) mod.spawnJitter = true;

        btnSpawnJitterToggle.innerHTML = renderJitterKnob();
        jitterWidthBadge.style.display = 'inline';
        jitterWidthBadge.textContent = formatJitterPct();
        jitterWidthBadge.title = formatJitterDetail();

        layer.applySpawnJitterOne(config.name);
        this.mainApp.renderSingleFrame();
      };

      const onJitterDragEnd = () => {
        (this.activeDocument || document).removeEventListener('mousemove', onJitterDragMove);
        (this.activeDocument || document).removeEventListener('mouseup', onJitterDragEnd);

        if (!jitterDragMoved) {
          // Plain click (no drag): toggle on/off.
          mod.spawnJitter = !mod.spawnJitter;
          if (mod.spawnJitter) layer.applySpawnJitterOne(config.name);
        }
        this.rebuildInspector();
        this.mainApp.renderSingleFrame();
      };

      btnSpawnJitterToggle.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        e.preventDefault();
        jitterDragStartY = e.clientY;
        jitterDragStartWidth = mod.jitterWidth !== undefined ? mod.jitterWidth : 20;
        jitterDragMoved = false;
        (this.activeDocument || document).addEventListener('mousemove', onJitterDragMove);
        (this.activeDocument || document).addEventListener('mouseup', onJitterDragEnd);
      });

      btnModToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        mod.enabled = !mod.enabled;
        
        if (mod.enabled) {
          mod.keyframeEnabled = false; // LFO and keyframe are mutually exclusive
          if (this.activeTimelineParam === config.name) {
            this.activeTimelineParam = null;
            this.selectedKeyframeIndex = -1;
          }
        }
        
        const modKey = `${layer.id}-${config.name}`;
        if (mod.enabled) {
          this.expandedMods.add(modKey);
        } else {
          this.expandedMods.delete(modKey);
        }
        this.rebuildInspector(); // Redraw parameter structure
        this.drawTimeline();
        this.mainApp.renderSingleFrame();
      });

      btnKeyframeToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        mod.keyframeEnabled = !mod.keyframeEnabled;
        
        if (mod.keyframeEnabled) {
          mod.enabled = false; // LFO and keyframe are mutually exclusive
          const modKey = `${layer.id}-${config.name}`;
          this.expandedMods.delete(modKey);
          
          this.activeTimelineParam = config.name;
          this.selectedKeyframeIndex = -1;
        } else {
          if (this.activeTimelineParam === config.name) {
            this.activeTimelineParam = null;
            this.selectedKeyframeIndex = -1;
          }
        }
        this.rebuildInspector();
        this.drawTimeline();
        this.mainApp.renderSingleFrame();
      });

      btnAddKeyframe.addEventListener('click', (e) => {
        e.stopPropagation();
        const duration = parseFloat(this.exportDurationEl.value) || 10;
        const maxFrames = duration * 60;
        let currentFrame = Math.max(0, Math.min(maxFrames, Math.round((this.mainApp.accumulatedTime / 1000) * 60)));

        // Snap feature
        const snapVal = this.timelineSnapSelectEl ? this.timelineSnapSelectEl.value : 'off';
        if (snapVal !== 'off') {
          const snap = parseInt(snapVal, 10);
          currentFrame = Math.round(currentFrame / snap) * snap;
          currentFrame = Math.max(0, Math.min(maxFrames, currentFrame));
        }

        const currentVal = isFx ? layer.effects[config.name] : layer.generator.params[config.name];

        const existingKf = mod.keyframes.find(k => k.frame === currentFrame);
        if (existingKf) {
          existingKf.value = currentVal;
        } else {
          mod.keyframes.push({ frame: currentFrame, value: currentVal, easing: 'linear' });
        }
        mod.keyframes.sort((a, b) => a.frame - b.frame);

        this.selectedKeyframeIndex = mod.keyframes.findIndex(k => k.frame === currentFrame);

        // Precise inputs sync
        const kf = mod.keyframes[this.selectedKeyframeIndex];
        this.keyPreciseFrameEl.value = kf.frame;
        this.keyPreciseFrameEl.disabled = false;
        this.keyPreciseValueEl.value = kf.value.toFixed(4);
        this.keyPreciseValueEl.disabled = false;
        this.keyPreciseEasingEl.value = kf.easing || 'linear';
        this.keyPreciseEasingEl.disabled = false;
        this.btnKeyPreciseDeleteEl.disabled = false;

        this.mainApp.renderSingleFrame();
        this.drawTimeline();
      });

      // Clicking anywhere on the parameter row focuses it in the shared Keyframe Timeline panel
      // below - a plain "select to view/edit" action, distinct from the 🔑 button which also
      // flips keyframeEnabled on/off. Without this, switching the timeline's focus to an already
      // keyframe-enabled parameter meant toggling 🔑 off then on again just to re-select it.
      // The per-row buttons (🧬/🔑/+Key/jitter knob) all stopPropagation their own clicks, so this
      // only fires on the label/value/slider area, not on those.
      mainField.addEventListener('click', () => {
        if (this.activeTimelineParam === config.name) return;
        this.activeTimelineParam = config.name;
        this.selectedKeyframeIndex = -1;
        this.drawTimeline();
      });

      fieldWrapper.appendChild(mainField);

      // LFO Settings Sub-panel
      if (mod && mod.enabled) {
        const modPanel = this.createElement('div');
        modPanel.className = 'modulation-panel';
        
        modPanel.innerHTML = `
          <div class="mod-grid">
            <div class="mod-cell">
              <label>LFO MIN</label>
              <input type="number" class="mod-input mod-min" value="${mod.min}" step="${config.step}">
            </div>
            <div class="mod-cell">
              <label>LFO MAX</label>
              <input type="number" class="mod-input mod-max" value="${mod.max}" step="${config.step}">
            </div>
            <div class="mod-cell">
              <label>TIME %</label>
              <input type="number" class="mod-input mod-time" value="${mod.timePct}" min="1" max="100">
            </div>
            <div class="mod-cell">
              <label>LFO MODE</label>
              <select class="mod-behavior">
                <option value="repeat" ${mod.behavior === 'repeat' ? 'selected' : ''}>Repeat</option>
                <option value="return" ${mod.behavior === 'return' ? 'selected' : ''}>Return</option>
                <option value="one" ${mod.behavior === 'one' ? 'selected' : ''}>One</option>
              </select>
            </div>
          </div>
        `;

        const inputMin = modPanel.querySelector('.mod-min');
        const inputMax = modPanel.querySelector('.mod-max');
        const inputTime = modPanel.querySelector('.mod-time');
        const selectBehavior = modPanel.querySelector('.mod-behavior');

        inputMin.addEventListener('change', (e) => {
          mod.min = Math.max(config.min, Math.min(config.max, parseFloat(e.target.value) || config.min));
          this.mainApp.renderSingleFrame();
        });
        inputMax.addEventListener('change', (e) => {
          mod.max = Math.max(config.min, Math.min(config.max, parseFloat(e.target.value) || config.max));
          this.mainApp.renderSingleFrame();
        });
        inputTime.addEventListener('change', (e) => {
          mod.timePct = Math.max(1, Math.min(100, parseInt(e.target.value) || 50));
          this.mainApp.renderSingleFrame();
        });
        selectBehavior.addEventListener('change', (e) => {
          mod.behavior = e.target.value;
          this.mainApp.renderSingleFrame();
        });

        fieldWrapper.appendChild(modPanel);
      }
    } else if (config.type === 'color') {
      const field = this.createElement('div');
      field.className = 'layer-field';
      field.innerHTML = `
        <label>${config.label}</label>
        <input type="color" value="${layer.generator.params[config.name]}" style="grid-column: span 2; width:100%; border:none; height:28px; border-radius:4px; cursor:pointer;">
      `;
      field.querySelector('input').addEventListener('input', (e) => {
        onValUpdate(e.target.value);
        this.mainApp.renderSingleFrame();
      });
      fieldWrapper.appendChild(field);
    }

    return fieldWrapper;
  }

  createSliderField(name, label, min, max, step, val, onChange) {
    const field = this.createElement('div');
    field.className = 'layer-field';
    
    let displayVal = val;
    if (typeof val === 'number') {
      displayVal = val % 1 === 0 ? val.toString() : val.toFixed(2);
    }

    field.innerHTML = `
      <label>${label}</label>
      <input type="range" min="${min}" max="${max}" step="${step}" value="${val}" style="grid-column: span 2;">
      <span class="val-display">${displayVal}</span>
    `;

    const rangeInput = field.querySelector('input[type="range"]');
    const valDisplay = field.querySelector('.val-display');

    rangeInput.addEventListener('input', (e) => {
      const v = e.target.value;
      const numVal = parseFloat(v);
      valDisplay.textContent = numVal % 1 === 0 ? numVal.toString() : numVal.toFixed(2);
      onChange(v);
    });

    return field;
  }

  /**
   * Applies a normalized motion template (normalized keyframes) to a modulation config
   */
  applyMotionTemplate(candidateMod, templateName, localMin, localMax, durationVal) {
    const template = MOTION_TEMPLATES[templateName];
    if (!template) return false;

    candidateMod.keyframeEnabled = true;
    candidateMod.enabled = false;
    candidateMod.keyframes = [];

    const maxFrames = durationVal * 60;

    template.forEach(pt => {
      const frame = Math.round(pt.time * maxFrames);
      // Scale from [0.0, 1.0] normalized value to the parameter's actual range
      const value = localMin + (localMax - localMin) * pt.value;
      candidateMod.keyframes.push({
        frame: frame,
        value: value,
        easing: pt.easing || 'linear'
      });
    });

    candidateMod.keyframes.sort((a, b) => a.frame - b.frame);
    return true;
  }

  /**
   * Randomizes the inspected layer.
   * Decide center first, then determine automation bounds under current Spread percentage.
   */
  randomizeLayer(layer, spreadPct) {
    const spread = spreadPct / 100;
    const badEvaluations = (this.scoreData || []).filter(evalItem => evalItem.layerType === layer.type && evalItem.score === 'bad');
    const goodEvaluations = (this.scoreData || []).filter(evalItem => evalItem.layerType === layer.type && evalItem.score === 'good');

    // Good-attraction: pull the mutation center toward the average of past Good-rated parameters.
    // Weight ramps from 0 (no Good data, identical to legacy behavior) up to GOOD_ATTRACTION_MAX_WEIGHT
    // as samples accumulate, saturating at GOOD_ATTRACTION_CONFIDENCE_SAMPLES to avoid overfitting a single sample.
    const goodAttractionWeight = goodEvaluations.length === 0
      ? 0
      : this.GOOD_ATTRACTION_MAX_WEIGHT * Math.min(1, goodEvaluations.length / this.GOOD_ATTRACTION_CONFIDENCE_SAMPLES);

    // Weighted by each entry's own 1-10 rating (a 9/10 pulls harder than a flat 7/10) instead of
    // averaging the Good bucket unweighted. Older entries saved before the rating dialog only
    // have score: 'good', so they fall back to an implicit weight of 8 - they still count, just
    // without the extra precision newer rated entries provide. When the rater specifically
    // flagged THIS parameter as good/bad on THIS example (paramFlags), that per-parameter
    // attribution overrides the whole-generation rating for this one key: a flagged-good value
    // pulls at least as hard as a 9, and a flagged-bad value is excluded from this example's
    // contribution entirely - so a 9/10 example with one specifically-bad param doesn't drag
    // that param's centroid toward a value the rater explicitly said was wrong.
    const ratingWeight = (e, key) => {
      const flag = e.paramFlags && e.paramFlags[key];
      if (flag === 'bad') return 0;
      const base = typeof e.rating === 'number' ? e.rating : 8;
      if (flag === 'good') return Math.max(base, 9);
      return base;
    };
    const weightedCentroid = (evalList, field, key) => {
      let weightedSum = 0, weightTotal = 0;
      for (const e of evalList) {
        const val = e[field] && e[field][key];
        if (typeof val !== 'number') continue;
        const w = ratingWeight(e, key);
        if (w <= 0) continue;
        weightedSum += val * w;
        weightTotal += w;
      }
      return weightTotal > 0 ? weightedSum / weightTotal : null;
    };
    const goodParamCentroid = (key) => weightedCentroid(goodEvaluations, 'params', key);
    const goodEffectCentroid = (key) => weightedCentroid(goodEvaluations, 'effects', key);

    // Motion counterpart to weightedCentroid: averages a getMotionFeatures() feature (amplitude
    // or speed) across Good evaluations that actually animated this param, so a currently-enabled
    // LFO's range/timing gets nudged toward "how Good examples tended to move this param" the
    // same way its base value already gets nudged toward their static centroid. Evaluations where
    // the param wasn't animated are excluded (an amplitude/speed of a static param is meaningless
    // noise, not a real "should be static" data point - the on/off decision itself stays governed
    // by the layer's own inherited state + Move-score gating, unchanged).
    const durationSecForMotion = parseFloat(this.exportDurationEl.value) || 10;
    const weightedMotionCentroid = (key, config, featureName) => {
      let weightedSum = 0, weightTotal = 0;
      for (const e of goodEvaluations) {
        const mod = e.modulations && e.modulations[key];
        if (!mod) continue;
        const feat = this.getMotionFeatures(mod, config, durationSecForMotion);
        if (feat.animated === 0) continue;
        const w = ratingWeight(e, key);
        if (w <= 0) continue;
        weightedSum += feat[featureName] * w;
        weightTotal += w;
      }
      return weightTotal > 0 ? weightedSum / weightTotal : null;
    };

    // Analyze negative reasons from past bad evaluations
    const hasStrobeExcess = badEvaluations.some(e => e.reasons && e.reasons.includes('strobe_excess'));
    const hasScaleIssue = badEvaluations.some(e => e.reasons && (e.reasons.includes('scale_too_small') || e.reasons.includes('scale_too_large')));
    const hasAspectBreak = badEvaluations.some(e => e.reasons && e.reasons.includes('aspect_break'));
    const hasTooSimple = badEvaluations.some(e => e.reasons && e.reasons.includes('too_simple'));
    const hasTooChaotic = badEvaluations.some(e => e.reasons && e.reasons.includes('too_chaotic'));
    const hasNoiseWarpExcess = badEvaluations.some(e => e.reasons && e.reasons.includes('noise_warp_excess'));
    const hasNothingVisible = badEvaluations.some(e => e.reasons && e.reasons.includes('nothing_visible'));
    const hasColorMonotonous = badEvaluations.some(e => e.reasons && e.reasons.includes('color_monotonous'));
    const hasMotionTooFast = badEvaluations.some(e => e.reasons && e.reasons.includes('motion_too_fast'));
    const hasMotionTooSlow = badEvaluations.some(e => e.reasons && e.reasons.includes('motion_too_slow'));

    // Similarity between a candidate and one past evaluation - delegates to the shared weighted
    // metric (calculateStatesSimilarity) so the Bad-avoidance check, the Good-closeness check
    // below, and batch-diversity filtering all agree on exactly the same notion of "similar".
    const calcSimilarityToEval = (evalItem, candidateParams, candidateEffects, genConfigs, candidateModulations) =>
      this.calculateStatesSimilarity({ params: candidateParams, effects: candidateEffects, modulations: candidateModulations }, evalItem, genConfigs, layer.type);

    const maxSimilarityAmong = (evalList, candidateParams, candidateEffects, genConfigs, candidateModulations) => {
      let max = 0;
      for (const evalItem of evalList) {
        const sim = calcSimilarityToEval(evalItem, candidateParams, candidateEffects, genConfigs, candidateModulations);
        if (sim > max) max = sim;
      }
      return max;
    };

    // Snaps a random-mutated value back onto the parameter's slider step (e.g. integer counts).
    // The mutation math below (baseVal + random offset) is pure float arithmetic and previously
    // ignored config.step entirely, so integer-only params like Sketch Growth's Branches could end
    // up fractional (e.g. 4.37). That specific case wasn't just cosmetic: growing-sketch's update()
    // rebuilds its path array to Math.round(branchCount) paths but initPaths() itself loops on the
    // raw (unrounded) branchCount, so a fractional value made the two disagree on path count every
    // single frame - triggering a full reset loop that never let branches grow, reading as "stuck
    // tangled at the center" (see 2026-07-19 bug report). Snapping here fixes that at the source for
    // every stepped param, not just this one.
    const snapToStep = (val, config) => {
      if (!config.step) return val;
      const snapped = config.min + Math.round((val - config.min) / config.step) * config.step;
      return Math.max(config.min, Math.min(config.max, snapped));
    };

    let attempt = 0;
    let bestCandidate = null;
    // Soft ranking score = closeness to a known-Good look minus closeness to a known-Bad one
    // (see the scoring block below). Kept across attempts so the best-scoring candidate wins
    // even when none clears the early-exit bar within the attempt budget.
    let bestScore = -Infinity;

    for (attempt = 0; attempt < 10; attempt++) {
      const candidateParams = {};
      const candidateEffects = {};
      const candidateModulations = {};

      const genConfigs = layer.generator.getParameterConfig();

      // 1. Generator Parameters with dynamic constraints
      genConfigs.forEach(config => {
        if (config.type === 'range') {
          let localMin = config.min;
          let localMax = config.max;

          const isCount = config.name === 'count' || config.name === 'particleCount' || config.name === 'lineCount';
          const isFreq = config.name === 'frequency' || config.name === 'density' || config.name === 'speed';
          const isSizeOrWidth = config.name === 'strokeWidth' || config.name === 'minSize' || config.name === 'maxSize';

          // scale_too_small / scale_too_large constraint
          if (hasScaleIssue && isCount) {
            localMin = config.min + (config.max - config.min) * 0.2;
          }
          // too_simple constraint
          if (hasTooSimple && (isCount || isFreq)) {
            localMin = config.min + (config.max - config.min) * 0.25;
          }
          // nothing_visible constraint (Generator values)
          if (hasNothingVisible) {
            if (isCount) {
              localMin = config.min + (config.max - config.min) * 0.3; // force more objects
            }
            if (isSizeOrWidth) {
              localMin = config.min + (config.max - config.min) * 0.3; // force visible width/size
            }
            if (config.name === 'colorLightness') {
              localMin = Math.max(40, localMin); // avoid too dark color
            }
          }
          // Sketch Growth's "Wiggle" (noiseScale) perturbs each branch's growth angle every frame;
          // past ~0.5 the perturbation swamps the branch's base direction and it stops reading as
          // an organic sketch, instead looping back on itself. Cap the randomizer's ceiling well
          // below the slider's full manual range (kept at 3.0 there for hands-on experimentation) -
          // 2026-07-19 user feedback: results above 0.5 are rarely kept anyway.
          if (layer.type === 'growing-sketch' && config.name === 'noiseScale') {
            localMax = Math.min(0.5, localMax);
          }

          const range = config.max - config.min;
          let baseVal = layer.generator.params[config.name] !== undefined
            ? layer.generator.params[config.name]
            : (localMin + (localMax - localMin) / 2);

          const goodCentroidVal = goodParamCentroid(config.name);
          if (goodCentroidVal !== null && goodAttractionWeight > 0) {
            baseVal = baseVal * (1 - goodAttractionWeight) + goodCentroidVal * goodAttractionWeight;
          }

          const offset = (Math.random() * 2 - 1) * (range * spread * 0.2);
          let newVal = baseVal + offset;
          newVal = Math.max(localMin, Math.min(localMax, newVal));
          newVal = snapToStep(newVal, config);

          candidateParams[config.name] = newVal;

          const mod = layer.modulations[config.name];
          if (mod) {
            const candidateMod = JSON.parse(JSON.stringify(mod));
            candidateMod.jitterBase = newVal; // keep Spawn Jitter centered on the new mutated value

            // "Move" score (0-5) from the opinion sheet: how effective animating this parameter
            // was judged to be. A low score (0-1) means past evaluation found it looks worse
            // animated, so skip LFO/keyframes entirely and leave it fixed - no need to even
            // consider motion templates for it.
            const moveScore = this.moveScores && this.moveScores[layer.type]
              ? this.moveScores[layer.type][config.name] : undefined;
            const isLowMove = moveScore !== undefined && moveScore <= 1;

            if (isLowMove) {
              candidateMod.enabled = false;
              candidateMod.keyframeEnabled = false;
              candidateMod.keyframes = [];
              candidateMod.min = newVal;
              candidateMod.max = newVal;
              candidateModulations[config.name] = candidateMod;
            } else {
              const templateApplied = false;

              // motion_too_fast constraint: templates pack in several oscillations across the
              // duration with no independent speed knob, so the only lever is to stop reaching
              // for one at all and fall back to a (speed-clampable) plain LFO instead.
              // motion_too_slow constraint: nudge the odds up so more parameters actually move.
              const baseTemplateChance = hasMotionTooSlow
                ? Math.min(1, this.RANDOM_TEMPLATE_CHANCE + 0.3)
                : this.RANDOM_TEMPLATE_CHANCE;
              // Move score used to only ever suppress (isLowMove above) - any value above that
              // threshold (2-5) was treated identically, so the opinion sheet's 0-5 scale had no
              // visible effect once a parameter cleared it. Scale the chance up with how strongly
              // the sheet says this parameter benefits from motion, so Move=5 ("moves great")
              // actually ends up animated far more often than Move=2 ("barely worth it") instead
              // of the two being indistinguishable. Move<=2 or no data at all: no change.
              const moveBoost = (moveScore !== undefined && moveScore > 2) ? (moveScore - 2) / 3 : 0;
              const effectiveTemplateChance = hasMotionTooFast ? 0 : Math.min(1, baseTemplateChance + moveBoost * 0.6);

              if (templateApplied) {
                candidateModulations[config.name] = candidateMod;
              } else if (mod.keyframeEnabled && mod.keyframes && mod.keyframes.length > 0) {
                candidateMod.keyframes.forEach(kf => {
                  const kfOffset = (Math.random() * 2 - 1) * (range * spread * 0.2);
                  let newKfVal = kf.value + kfOffset;
                  newKfVal = Math.max(localMin, Math.min(localMax, newKfVal));
                  kf.value = snapToStep(newKfVal, config);
                });
              } else if (Math.random() < effectiveTemplateChance) {
                // Not Excel-mapped, but Move score doesn't rule it out - occasionally pull a
                // shape straight from the motion template library instead of plain LFO.
                const templateKeys = Object.keys(MOTION_TEMPLATES);
                const pick = templateKeys[Math.floor(Math.random() * templateKeys.length)];
                const durationVal = parseFloat(this.exportDurationEl.value) || 10;
                const modMin = localMin + (localMax - localMin) * 0.1;
                const modMax = localMax - (localMax - localMin) * 0.1;
                this.applyMotionTemplate(candidateMod, pick, modMin, modMax, durationVal);
              } else if (mod.enabled) {
                const offsetMin = (Math.random() * 2 - 1) * (range * spread * 0.2);
                const offsetMax = (Math.random() * 2 - 1) * (range * spread * 0.2);

                let newMin = mod.min + offsetMin;
                let newMax = mod.max + offsetMax;

                newMin = Math.max(localMin, Math.min(localMax, newMin));
                newMax = Math.max(localMin, Math.min(localMax, newMax));

                // Good-motion attraction: nudge this LFO's amplitude toward how Good examples
                // tended to swing this same parameter (same confidence ramp as the static-value
                // centroid above - see weightedMotionCentroid).
                const goodAmplitude = weightedMotionCentroid(config.name, config, 'amplitude');
                if (goodAmplitude !== null && goodAttractionWeight > 0) {
                  const currentAmplitude = Math.abs(newMax - newMin) / range;
                  const targetAmplitude = currentAmplitude * (1 - goodAttractionWeight) + goodAmplitude * goodAttractionWeight;
                  const center = (newMin + newMax) / 2;
                  const halfSpan = (targetAmplitude * range) / 2;
                  newMin = Math.max(localMin, center - halfSpan);
                  newMax = Math.min(localMax, center + halfSpan);
                }

                candidateMod.min = snapToStep(newMin, config);
                candidateMod.max = snapToStep(newMax, config);

                const offsetTime = (Math.random() * 2 - 1) * 15;
                let newTimePct = mod.timePct + offsetTime;
                newTimePct = Math.max(1, Math.min(100, Math.round(newTimePct)));

                // Good-motion attraction: nudge this LFO's pacing toward how Good examples tended
                // to run it.
                const goodSpeed = weightedMotionCentroid(config.name, config, 'speed');
                if (goodSpeed !== null && goodAttractionWeight > 0) {
                  const currentSpeed = Math.max(0, Math.min(1, 1 - (newTimePct - 1) / 99));
                  const targetSpeed = currentSpeed * (1 - goodAttractionWeight) + goodSpeed * goodAttractionWeight;
                  newTimePct = Math.round(1 + (1 - targetSpeed) * 99);
                }

                // timePct = one LFO cycle's % share of the export duration, so higher = slower.
                if (hasMotionTooFast) newTimePct = Math.max(55, newTimePct);
                if (hasMotionTooSlow) newTimePct = Math.min(35, newTimePct);
                candidateMod.timePct = newTimePct;
              } else if (hasMotionTooSlow) {
                // "静止しすぎ" - this parameter would otherwise stay pinned static; force a modest,
                // fast-ish sway instead so the layer isn't dead motion-wise.
                const lfoSpan = range * 0.15;
                candidateMod.enabled = true;
                candidateMod.min = snapToStep(Math.max(localMin, newVal - lfoSpan / 2), config);
                candidateMod.max = snapToStep(Math.min(localMax, newVal + lfoSpan / 2), config);
                candidateMod.timePct = 20 + Math.floor(Math.random() * 15);
              } else {
                candidateMod.min = newVal;
                candidateMod.max = newVal;
              }
              candidateModulations[config.name] = candidateMod;
            }
          }
        } else if (config.type === 'color') {
          let h = Math.floor(Math.random() * 360);
          // color_monotonous constraint: a fully random hue can land close to the previous one by
          // pure chance, which is exactly what "地味・単調" complaints are about. Reroll until the
          // new hue sits at least 90° (circular distance) away from the current color.
          if (hasColorMonotonous) {
            const prevHex = layer.generator.params[config.name];
            if (prevHex) {
              const prevHue = hexToHsl(prevHex).h;
              let guard = 0;
              while (guard < 20 && Math.min(Math.abs(h - prevHue), 360 - Math.abs(h - prevHue)) < 90) {
                h = Math.floor(Math.random() * 360);
                guard++;
              }
            }
          }
          const s = 85 + Math.floor(Math.random() * 15);
          const l = 45 + Math.floor(Math.random() * 15);
          candidateParams[config.name] = this.hslToHex(h, s, l);
        }
      });

      // 2. Common FX parameters with dynamic constraints
      let tempRotation = 0;
      const rotConfig = this.fxConfigs['rotation'];
      if (rotConfig) {
        const range = rotConfig.max - rotConfig.min;
        let baseVal = layer.effects['rotation'] !== undefined ? layer.effects['rotation'] : 0;
        const goodRotationCentroid = goodEffectCentroid('rotation');
        if (goodRotationCentroid !== null && goodAttractionWeight > 0) {
          baseVal = baseVal * (1 - goodAttractionWeight) + goodRotationCentroid * goodAttractionWeight;
        }
        const offset = (Math.random() * 2 - 1) * (range * spread * 0.2);
        tempRotation = baseVal + offset;
        tempRotation = Math.max(rotConfig.min, Math.min(rotConfig.max, tempRotation));
      }

      // Per-FX-parameter randomization rules live in fxRandomizerRules.js (extracted from an
      // 18-branch if/else-if chain that used to live inline here - see its file comment). Good-
      // attraction centroids are closures over per-attempt state, so they're still computed here
      // and passed in as plain values to keep those functions pure.
      const durationVal = parseFloat(this.exportDurationEl.value) || 10;
      const goodScaleCentroid = goodEffectCentroid('scale');
      const goodGlowCentroid = goodEffectCentroid('glowIntensity');
      const goodDecayCentroid = goodEffectCentroid('feedbackDecay');

      for (let fxName in this.fxConfigs) {
        const config = this.fxConfigs[fxName];
        let r;

        switch (fxName) {
          // Deliberately excluded from randomization (see CLAUDE.md's "ガチャ回避" notes) -
          // positionX/Y (basically 0,0), strobe (almost never used), distortionIntensity/
          // kaleidoscopeSegment/mirrorMode/chromaticOffset (almost never used / manual-only
          // composition choices), rotateY/rotateZ (3D effects unused except X), translateZ
          // (overlaps with Scale).
          case 'positionX':
          case 'positionY':
          case 'strobe':
          case 'distortionIntensity':
          case 'kaleidoscopeSegment':
          case 'mirrorMode':
          case 'chromaticOffset':
          case 'rotateY':
          case 'rotateZ':
          case 'translateZ':
            r = forceFxOff(0);
            break;
          case 'rotation':
            r = randomizeRotation({ durationVal });
            break;
          case 'scale':
            r = randomizeScale({ layer, config, spread, hasScaleIssue, hasNothingVisible, hasAspectBreak, tempRotation, goodAttractionWeight, goodScaleCentroid });
            break;
          case 'glowIntensity':
            r = randomizeGlowIntensity({ layer, config, spread, hasNothingVisible, hasTooChaotic, goodAttractionWeight, goodGlowCentroid });
            break;
          case 'feedbackDecay':
            r = randomizeFeedbackDecay({ layer, config, spread, hasTooChaotic, goodAttractionWeight, goodDecayCentroid });
            break;
          case 'feedbackRotate':
            r = randomizeFeedbackRotate();
            break;
          case 'rotateX':
            r = randomizeRotateX();
            break;
          default:
            // fxConfigs parameter with no randomizer rule yet (e.g. hueRotate) - leave untouched.
            continue;
        }

        candidateEffects[fxName] = r.value;
        candidateModulations[fxName] = r.modulation;
      }

      const candidateState = {
        params: candidateParams,
        effects: candidateEffects,
        modulations: candidateModulations
      };

      // Soft-ranking selection: score every attempt by closeness to a known-Good look minus
      // closeness to a known-Bad one, and keep the best-scoring one seen. With no Good data yet
      // this collapses to "just avoid Bad" (legacy behavior) since maxGoodSimilarity is treated
      // as 0. Still exits early once an attempt clears reasonable bars on both counts, so this
      // doesn't burn all 10 attempts when the very first draw is already solid.
      const maxBadSimilarity = badEvaluations.length > 0
        ? maxSimilarityAmong(badEvaluations, candidateParams, candidateEffects, genConfigs, candidateModulations)
        : 0;
      const maxGoodSimilarity = goodEvaluations.length > 0
        ? maxSimilarityAmong(goodEvaluations, candidateParams, candidateEffects, genConfigs, candidateModulations)
        : null;
      const score = (maxGoodSimilarity !== null ? maxGoodSimilarity : 0) - maxBadSimilarity;

      const clearsBad = maxBadSimilarity < 0.90;
      const clearsGood = maxGoodSimilarity === null || maxGoodSimilarity >= 0.6;
      if (clearsBad && clearsGood) {
        bestCandidate = candidateState;
        bestScore = score;
        break;
      }

      if (score > bestScore) {
        bestScore = score;
        bestCandidate = candidateState;
      }

      console.log(`[Score Filter] Randomize attempt ${attempt + 1}: score ${score.toFixed(2)} (bad ${Math.round(maxBadSimilarity * 100)}%${maxGoodSimilarity !== null ? ', good ' + Math.round(maxGoodSimilarity * 100) + '%' : ''}). Rerolling...`);
    }

    if (bestCandidate) {
      if (attempt >= 10) {
        console.warn(`[Score Filter] Randomize reached max attempts. Using best-scoring candidate (score ${bestScore.toFixed(2)}).`);
      } else {
        console.log(`[Score Filter] Randomize succeeded on attempt ${attempt + 1}.`);
      }

      for (let key in bestCandidate.params) {
        layer.generator.params[key] = bestCandidate.params[key];
      }
      for (let key in bestCandidate.effects) {
        layer.effects[key] = bestCandidate.effects[key];
      }
      for (let key in bestCandidate.modulations) {
        const targetMod = layer.modulations[key];
        const srcMod = bestCandidate.modulations[key];
        if (targetMod && srcMod) {
          targetMod.enabled = srcMod.enabled;
          targetMod.min = srcMod.min;
          targetMod.max = srcMod.max;
          targetMod.timePct = srcMod.timePct;
          targetMod.behavior = srcMod.behavior;
          targetMod.keyframeEnabled = srcMod.keyframeEnabled;
          targetMod.keyframes = JSON.parse(JSON.stringify(srcMod.keyframes || []));
          targetMod.spawnJitter = srcMod.spawnJitter;
          if (srcMod.jitterBase !== undefined) targetMod.jitterBase = srcMod.jitterBase;
          if (srcMod.jitterWidth !== undefined) targetMod.jitterWidth = srcMod.jitterWidth;
        }
      }
    }
  }

  restoreLayerState(layer, state) {
    for (let key in state.params) {
      layer.generator.params[key] = state.params[key];
    }
    for (let key in state.effects) {
      layer.effects[key] = state.effects[key];
    }
    for (let key in state.modulations) {
      const targetMod = layer.modulations[key];
      const srcMod = state.modulations[key];
      if (targetMod && srcMod) {
        targetMod.enabled = srcMod.enabled;
        targetMod.min = srcMod.min;
        targetMod.max = srcMod.max;
        targetMod.timePct = srcMod.timePct;
        targetMod.behavior = srcMod.behavior;
        targetMod.keyframeEnabled = srcMod.keyframeEnabled;
        targetMod.keyframes = JSON.parse(JSON.stringify(srcMod.keyframes || []));
        targetMod.spawnJitter = srcMod.spawnJitter;
        if (srcMod.jitterBase !== undefined) targetMod.jitterBase = srcMod.jitterBase;
        if (srcMod.jitterWidth !== undefined) targetMod.jitterWidth = srcMod.jitterWidth;
      }
    }
  }

  // Saves one Batch Generator candidate's parameters as a real .mvlayer preset file, the moment
  // it's checked "Keep" - reuses the exact same /api/save endpoint and file shape as the
  // Inspector's normal 💾 Save button, so "keep this" persists across closing the wizard, closing
  // the browser, or switching PCs (presets/ is git-tracked) without inventing a new storage
  // format. Returns the saved filename, or null on failure (caller shows a toast either way).
  async autoSaveCandidateAsPreset(layer, candidateState, index) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const baseName = (layer.name || layer.type).replace(/\s*\(Batch\)\s*$/, '').trim();
    const rawName = `${baseName} Batch ${stamp} v${index + 1}`;

    const layerData = {
      version: '1.0',
      type: 'movie-creator-layer-preset',
      layer: {
        type: layer.type,
        name: rawName,
        opacity: layer.opacity,
        blendMode: layer.blendMode,
        randomSpread: layer.randomSpread,
        currentPresetName: layer.currentPresetName,
        params: { ...candidateState.params },
        effects: { ...candidateState.effects },
        modulations: JSON.parse(JSON.stringify(candidateState.modulations))
      }
    };

    try {
      const res = await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'preset', name: rawName, data: layerData })
      });
      const result = await res.json();
      if (result.success) {
        this.showToast(`✅ Kept & saved: presets/${result.file}`, 'success');
        await this.refreshFileList();
        return result.file;
      }
      this.showToast('❌ Failed to save kept variation: ' + result.error, 'error');
      return null;
    } catch (err) {
      this.showToast('❌ Failed to save kept variation: ' + err.message, 'error');
      return null;
    }
  }

  // Loads a saved .mvlayer preset file as a brand-new project layer (mirrors apiImportLayer's
  // load+copy logic without its UI-refresh side effects) for the Batch Generator wizard to work
  // on. Returns null on failure rather than throwing, so callers can show a toast and stay put.
  async createLayerFromPresetFile(file) {
    try {
      const res = await fetch(`/api/load?type=preset&file=${encodeURIComponent(file)}`);
      if (!res.ok) throw new Error('Preset file not found or server error');
      const data = await res.json();
      if (!data || data.type !== 'movie-creator-layer-preset' || !data.layer) {
        throw new Error('Invalid layer preset data');
      }

      const lData = data.layer;
      const newLayer = this.layerManager.addLayer(lData.type);

      newLayer.name = lData.name ? `${lData.name} (Batch)` : newLayer.name;
      newLayer.opacity = lData.opacity !== undefined ? lData.opacity : 1.0;
      newLayer.blendMode = lData.blendMode || 'lighter';
      newLayer.randomSpread = lData.randomSpread !== undefined ? lData.randomSpread : 50;
      newLayer.currentPresetName = lData.currentPresetName || 'static-none';

      if (lData.params) {
        newLayer.generator.params = { ...newLayer.generator.params, ...lData.params };
      }
      if (lData.effects) {
        newLayer.effects = { ...newLayer.effects, ...lData.effects };
      }
      if (lData.modulations) {
        for (let paramName in lData.modulations) {
          if (newLayer.modulations[paramName]) {
            const srcMod = lData.modulations[paramName];
            newLayer.modulations[paramName].enabled = srcMod.enabled;
            newLayer.modulations[paramName].min = srcMod.min;
            newLayer.modulations[paramName].max = srcMod.max;
            newLayer.modulations[paramName].timePct = srcMod.timePct !== undefined ? srcMod.timePct : 50;
            newLayer.modulations[paramName].behavior = srcMod.behavior || 'return';
            newLayer.modulations[paramName].keyframeEnabled = srcMod.keyframeEnabled !== undefined ? srcMod.keyframeEnabled : false;
            newLayer.modulations[paramName].keyframes = srcMod.keyframes ? JSON.parse(JSON.stringify(srcMod.keyframes)) : [];
            newLayer.modulations[paramName].spawnJitter = srcMod.spawnJitter !== undefined ? srcMod.spawnJitter : false;
            if (srcMod.jitterWidth !== undefined) newLayer.modulations[paramName].jitterWidth = srcMod.jitterWidth;
          }
        }
      }

      // initModulations() captured jitterBase from the generator's DEFAULT params at layer
      // construction time, before the preset's real params/effects were copied in just above -
      // re-sync it now so the wizard's Random draws center on what the preset actually configured.
      for (let key in newLayer.modulations) {
        if (key in newLayer.generator.params) newLayer.modulations[key].jitterBase = newLayer.generator.params[key];
        else if (key in newLayer.effects) newLayer.modulations[key].jitterBase = newLayer.effects[key];
      }

      return newLayer;
    } catch (err) {
      console.error('Failed to load preset as new layer:', err);
      return null;
    }
  }

  // Applies one manually-configured random draw to `layer` in place, per the Batch Generator
  // wizard's per-parameter flags. Priority per parameter is KeyFrame > LFO > Random > static (a
  // parameter picks exactly one mode of variation, avoiding conflicting simultaneous ownership of
  // its live value - the same reasoning applySpawnJitterOne already uses against LFO/keyframes).
  // flags: { [paramName]: { random: bool, lfo: bool, keyframe: bool } }
  applyManualBatchDraw(layer, flags, durationVal) {
    const applyOne = (key, config) => {
      const f = flags[key];
      const mod = layer.modulations[key];
      if (!f || !mod) return;

      if (f.keyframe) {
        const templateKeys = Object.keys(MOTION_TEMPLATES);
        const pick = templateKeys[Math.floor(Math.random() * templateKeys.length)];
        const modMin = config.min + (config.max - config.min) * 0.1;
        const modMax = config.max - (config.max - config.min) * 0.1;
        mod.enabled = false;
        this.applyMotionTemplate(mod, pick, modMin, modMax, durationVal);
      } else if (f.lfo) {
        mod.keyframeEnabled = false;
        mod.enabled = true; // keeps this param's existing min/max/timePct/behavior as configured
      } else {
        mod.enabled = false;
        mod.keyframeEnabled = false;
      }

      if (f.random) {
        mod.spawnJitter = true;
        layer.applySpawnJitterOne(key); // no-ops if enabled/keyframeEnabled ended up true above
      }
    };

    layer.generator.getParameterConfig().forEach(config => {
      if (config.type === 'range') applyOne(config.name, config);
    });
    for (let fxName in this.fxConfigs) {
      // this.fxConfigs is keyed by a UI-only shorthand that doesn't always match the real
      // modulations/effects key (e.g. 'kaleidoscope' -> name: 'kaleidoscopeSegment') - use
      // .name, not the loop key, wherever this actually indexes into layer state.
      applyOne(this.fxConfigs[fxName].name, this.fxConfigs[fxName]);
    }
  }

  // Manual-flag counterpart to generateBatchVariations: same within-batch diversity reroll (avoid
  // near-duplicate candidates), but the per-parameter randomization itself is driven entirely by
  // the wizard's explicit flags instead of randomizeLayer's spread/Good-Bad-learning heuristics.
  generateManualBatchVariations(layer, count, thresholdPct, flags) {
    const threshold = thresholdPct / 100;
    const variations = [];
    const originalState = {
      params: JSON.parse(JSON.stringify(layer.generator.params || {})),
      effects: JSON.parse(JSON.stringify(layer.effects || {})),
      modulations: JSON.parse(JSON.stringify(layer.modulations || {}))
    };
    const genConfigs = layer.generator.getParameterConfig();
    const durationVal = parseFloat(this.exportDurationEl.value) || 10;

    for (let i = 0; i < count; i++) {
      let candidateState = null;
      let rerolls = 0;
      const maxRerolls = 20;

      while (rerolls < maxRerolls) {
        this.restoreLayerState(layer, originalState);
        this.applyManualBatchDraw(layer, flags, durationVal);

        const potentialState = {
          params: JSON.parse(JSON.stringify(layer.generator.params || {})),
          effects: JSON.parse(JSON.stringify(layer.effects || {})),
          modulations: JSON.parse(JSON.stringify(layer.modulations || {})),
          keep: false,
          rated: false
        };

        let isTooSimilar = false;
        for (const existing of variations) {
          const sim = this.calculateStatesSimilarity(potentialState, existing, genConfigs, layer.type);
          if (sim >= threshold) {
            isTooSimilar = true;
            break;
          }
        }

        if (!isTooSimilar) {
          candidateState = potentialState;
          break;
        }
        rerolls++;
      }

      if (!candidateState) {
        candidateState = {
          params: JSON.parse(JSON.stringify(layer.generator.params || {})),
          effects: JSON.parse(JSON.stringify(layer.effects || {})),
          modulations: JSON.parse(JSON.stringify(layer.modulations || {})),
          keep: false,
          rated: false
        };
      }

      variations.push(candidateState);
    }

    this.restoreLayerState(layer, originalState);
    return { variations, originalState };
  }

  // Exports only the specifically kept candidates from a Batch Generator review session, reusing
  // the exact same per-item export options/loop as runBatchExport.
  async exportBatchCandidates(layer, candidates) {
    this.mainApp.pause();
    const overlay = this.mainApp.recordingOverlayEl;
    const statusEl = this.mainApp.recordingStatusEl;
    const progressEl = this.mainApp.recordingProgressEl;
    overlay.classList.remove('hidden');

    try {
      const resVal = this.exportResolutionEl ? this.exportResolutionEl.value : '1080p';
      let w = 1920, h = 1080;
      if (resVal === '720p') { w = 1280; h = 720; }
      else if (resVal === '4K') { w = 3840; h = 2160; }

      const fpsVal = this.exportFpsEl ? parseInt(this.exportFpsEl.value, 10) : 60;
      const durationVal = parseFloat(this.exportDurationEl.value) || 10;
      const fadeOutVal = parseFloat(this.masterFadeOutEl.value) || 0;

      for (let i = 0; i < candidates.length; i++) {
        this.restoreLayerState(layer, candidates[i]);

        statusEl.textContent = `Exporting kept variation: ${i + 1}/${candidates.length} (0%)`;
        progressEl.value = 0;

        const options = {
          duration: durationVal,
          fps: fpsVal,
          width: w,
          height: h,
          bgMode: 'transparent',
          fadeOutDuration: fadeOutVal,
          alsoExportProRes: !!(this.exportProResEl && this.exportProResEl.checked),
          filename: `MovieCreator_Batch_${layer.type}_var${i + 1}_${Date.now()}`
        };

        await new Promise((resolve, reject) => {
          this.mainApp.recorder.export(
            options,
            (percent) => {
              statusEl.textContent = `Exporting kept variation: ${i + 1}/${candidates.length} (${percent}%)`;
              progressEl.value = percent;
            },
            () => resolve()
          ).catch(reject);
        });

        await new Promise(resolve => setTimeout(resolve, 500));
      }
      this.showToast(`Exported ${candidates.length} variation(s)`, 'success');
    } catch (err) {
      console.error('Batch export (selected) failed:', err);
      alert(`Batch export stopped due to error: ${err.message}`);
    } finally {
      overlay.classList.add('hidden');
      this.mainApp.play();
    }
  }

  // Batch Generator wizard: 1) pick a target preset (or use the current layer as-is), 2) toggle
  // Random/LFO/KeyFrame per parameter and set Count/Filter, 3) review generated candidates one at
  // a time in the live preview, mark which to keep (or rate the rejects), then export only the
  // kept ones. Replaces the old "press button -> immediately export everything" flow.
  async showBatchGeneratorWizard(seedLayer) {
    // Opens in its own popup window (same mechanism as the Float Inspector) instead of an
    // in-page overlay - a full-screen backdrop-blur overlay would otherwise mask the live
    // preview canvas for the entire time this multi-step wizard is open, which defeats the
    // point of the Step 3 review (you need to actually see each candidate while deciding).
    // The popup's controls still drive this.mainApp/this.layerManager directly, so the canvas
    // in the MAIN window updates live exactly like the Float Inspector's controls do today.
    const popup = window.open('', 'MovieCreatorBatchGenerator', 'width=620,height=820,menubar=no,toolbar=no,location=no,status=no,resizable=yes');
    if (!popup) {
      this.showToast('⚠️ Popup blocker prevented opening the Batch Generator window. Please allow popups for this site.', 'error');
      return;
    }
    const pDoc = popup.document;
    pDoc.title = 'MovieCreator - Batch Generator';
    document.querySelectorAll('link[rel="stylesheet"], style').forEach(el => {
      pDoc.head.appendChild(el.cloneNode(true));
    });
    pDoc.body.style.cssText = `
      background: #090714; margin: 0; padding: 1rem; color: #e2e8f0;
      font-family: 'Outfit', system-ui, -apple-system, sans-serif;
    `;

    const card = pDoc.createElement('div');
    card.style.cssText = `
      display: flex; flex-direction: column; gap: 1rem;
      height: calc(100vh - 2rem);
    `;
    pDoc.body.appendChild(card);

    let closed = false;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') closeWizard();
    };
    popup.addEventListener('keydown', handleKeyDown);

    // Restored when the wizard closes at any step, so cancelling never leaves the project
    // showing a half-configured batch draw or other layers hidden.
    const originalVisibilities = this.layerManager.layers.map(l => ({ id: l.id, visible: l.visible }));
    let workingLayer = null;
    let workingLayerIsNew = false;
    let seedSnapshot = null;
    // Accumulates across multiple "Generate" / "Generate More" rounds within one wizard session,
    // so reconfiguring or generating another batch never discards earlier Keep/Rate decisions.
    let candidates = [];
    let lastFlags = null;

    const closeWizard = (restore = true) => {
      if (closed) return;
      closed = true;
      if (restore && workingLayer && seedSnapshot) {
        this.restoreLayerState(workingLayer, seedSnapshot);
      }
      originalVisibilities.forEach(orig => {
        const l = this.layerManager.layers.find(x => x.id === orig.id);
        if (l) l.visible = orig.visible;
      });
      if (!popup.closed) popup.close();
      this.rebuildLayersList();
      this.rebuildInspector();
      this.mainApp.renderSingleFrame();
    };

    // Also clean up correctly if the user closes the popup with its own window controls
    // rather than the in-wizard Close/Cancel button.
    popup.addEventListener('beforeunload', () => {
      setTimeout(() => closeWizard(true), 0);
    });

    const soloPreview = (state) => {
      if (state) this.restoreLayerState(workingLayer, state);
      this.layerManager.layers.forEach(l => { l.visible = (l.id === workingLayer.id); });
      this.mainApp.renderSingleFrame();
    };

    // --- Step 1: target ---
    let presetFiles = [];
    try {
      const res = await fetch('/api/files');
      const data = await res.json();
      presetFiles = (data && data.presets) || [];
    } catch (err) {
      console.warn('Failed to load preset list for Batch Generator:', err.message);
    }

    const renderStep1 = () => {
      card.innerHTML = `
        <h3 style="margin: 0; font-size: 1.05rem; color: #e2e8f0; font-weight: 700;">🎬 Batch Generator — 1. Target</h3>
        <p style="margin: 0; font-size: 0.8rem; color: #9ca3af;">プリセットを選ぶか、今のレイヤー(${seedLayer.name})をそのまま使います。</p>
        <select class="bg-preset-select" style="padding: 0.4rem; background: rgba(0,0,0,0.3); border: 1px solid var(--border-color); color: #e2e8f0; border-radius: 6px; font-size: 0.85rem;">
          <option value="">-- 今のレイヤーを使う (${seedLayer.name}) --</option>
          ${presetFiles.map(f => `<option value="${f}">${f.replace(/\.mvlayer$/, '')}</option>`).join('')}
        </select>
        <div style="display: flex; gap: 0.75rem; justify-content: flex-end;">
          <button class="bg-cancel" style="padding: 0.4rem 1rem; border-radius: 6px; border: 1px solid #4b5563; background: transparent; color: #9ca3af; cursor: pointer; font-size: 0.85rem;">Cancel</button>
          <button class="bg-next" style="padding: 0.4rem 1.2rem; border-radius: 6px; border: none; background: #22d3ee; color: #0a0a0f; cursor: pointer; font-size: 0.85rem; font-weight: 600;">Next</button>
        </div>
      `;
      card.querySelector('.bg-cancel').addEventListener('click', () => closeWizard(false));
      card.querySelector('.bg-next').addEventListener('click', async () => {
        const chosen = card.querySelector('.bg-preset-select').value;
        const nextBtn = card.querySelector('.bg-next');
        nextBtn.disabled = true;
        nextBtn.textContent = 'Loading...';

        if (chosen) {
          const loaded = await this.createLayerFromPresetFile(chosen);
          if (!loaded) {
            this.showToast('Failed to load preset', 'error');
            nextBtn.disabled = false;
            nextBtn.textContent = 'Next';
            return;
          }
          workingLayer = loaded;
          workingLayerIsNew = true;
        } else {
          workingLayer = seedLayer;
          workingLayerIsNew = false;
        }

        seedSnapshot = {
          params: JSON.parse(JSON.stringify(workingLayer.generator.params || {})),
          effects: JSON.parse(JSON.stringify(workingLayer.effects || {})),
          modulations: JSON.parse(JSON.stringify(workingLayer.modulations || {}))
        };

        this.rebuildLayersList();
        soloPreview(null);
        renderStep2();
      });
    };

    // --- Step 2: per-parameter config ---
    const renderStep2 = () => {
      const genConfigs = workingLayer.generator.getParameterConfig();
      const rows = [];
      genConfigs.forEach(config => {
        if (config.type === 'range') rows.push({ key: config.name, label: config.label, config });
      });
      for (let fxName in this.fxConfigs) {
        // Same .name-vs-loop-key caveat as applyManualBatchDraw - see comment there.
        rows.push({ key: this.fxConfigs[fxName].name, label: this.fxConfigs[fxName].label, config: this.fxConfigs[fxName] });
      }

      const moveScoreFor = (key) => this.moveScores && this.moveScores[workingLayer.type]
        ? this.moveScores[workingLayer.type][key] : undefined;

      const rowsHtml = rows.map(r => {
        const mod = workingLayer.modulations[r.key];
        const move = moveScoreFor(r.key);
        const moveHint = move !== undefined ? `<span style="color: #6b7280;"> (Move:${move})</span>` : '';
        const dim = (move !== undefined && move <= 1) ? 'opacity: 0.55;' : '';
        const widthVal = mod.jitterWidth !== undefined ? mod.jitterWidth : 20;
        return `
          <div class="bg-param-row" data-key="${r.key}" style="display: flex; align-items: center; gap: 0.4rem; padding: 0.25rem 0; border-bottom: 1px solid rgba(255,255,255,0.05); ${dim}">
            <span style="flex: 1; font-size: 0.72rem; color: #9ca3af; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${r.label}">${r.label}${moveHint}</span>
            <input type="checkbox" class="bg-flag-random" checked title="Random" style="accent-color: #f59e0b; width: 14px; height: 14px;">
            <input type="range" class="bg-random-width" min="0" max="100" value="${widthVal}" title="Random width %" style="width: 46px;">
            <input type="checkbox" class="bg-flag-lfo" title="LFO" style="accent-color: #a78bfa; width: 14px; height: 14px;">
            <input type="checkbox" class="bg-flag-key" title="KeyFrame (random template)" style="accent-color: #22d3ee; width: 14px; height: 14px;">
          </div>
        `;
      }).join('');

      card.innerHTML = `
        <h3 style="margin: 0; font-size: 1.05rem; color: #e2e8f0; font-weight: 700;">🎬 Batch Generator — 2. Configure</h3>
        <div style="display: flex; gap: 0.4rem; font-size: 0.65rem; color: #6b7280;">
          <span style="flex: 1;"></span><span title="Random">🎲</span><span style="width: 46px; text-align: center;">width%</span><span title="LFO">🧬</span><span title="KeyFrame">🔑</span>
        </div>
        <div class="bg-param-list" style="display: flex; flex-direction: column; max-height: 280px; overflow-y: auto; padding-right: 0.25rem;">
          ${rowsHtml}
        </div>
        <div style="display: flex; align-items: center; gap: 1rem; justify-content: space-between; padding-top: 0.5rem; border-top: 1px solid var(--border-color);">
          <div style="display: flex; align-items: center; gap: 0.25rem;">
            <span style="font-size: 0.7rem; color: var(--color-text-dim);">Count:</span>
            <input type="number" class="bg-count" value="${this.batchCount}" min="1" max="50" style="width: 45px; background: rgba(0,0,0,0.3); border: 1px solid var(--border-color); color: white; font-size: 0.75rem; padding: 0.1rem 0.25rem; border-radius: 3px; text-align: center;">
          </div>
          <div style="display: flex; align-items: center; gap: 0.25rem;">
            <span style="font-size: 0.7rem; color: var(--color-text-dim);">Filter:</span>
            <input type="number" class="bg-threshold" value="${this.batchThreshold}" min="50" max="99" style="width: 40px; background: rgba(0,0,0,0.3); border: 1px solid var(--border-color); color: white; font-size: 0.75rem; padding: 0.1rem 0.25rem; border-radius: 3px; text-align: center;">
            <span style="font-size: 0.7rem; color: var(--color-text-dim);">%</span>
          </div>
        </div>
        <div style="display: flex; gap: 0.75rem; justify-content: flex-end;">
          <button class="bg-back" style="padding: 0.4rem 1rem; border-radius: 6px; border: 1px solid #4b5563; background: transparent; color: #9ca3af; cursor: pointer; font-size: 0.85rem;">Back</button>
          <button class="bg-cancel" style="padding: 0.4rem 1rem; border-radius: 6px; border: 1px solid #4b5563; background: transparent; color: #9ca3af; cursor: pointer; font-size: 0.85rem;">Cancel</button>
          <button class="bg-generate" style="padding: 0.4rem 1.2rem; border-radius: 6px; border: none; background: #22d3ee; color: #0a0a0f; cursor: pointer; font-size: 0.85rem; font-weight: 600;">Generate</button>
        </div>
      `;

      card.querySelector('.bg-back').addEventListener('click', () => {
        if (workingLayerIsNew) {
          this.layerManager.removeLayer(workingLayer.id);
          workingLayer = null;
          workingLayerIsNew = false;
        }
        this.rebuildLayersList();
        renderStep1();
      });
      card.querySelector('.bg-cancel').addEventListener('click', () => closeWizard());

      card.querySelector('.bg-generate').addEventListener('click', () => {
        this.batchCount = parseInt(card.querySelector('.bg-count').value, 10) || 10;
        this.batchThreshold = parseInt(card.querySelector('.bg-threshold').value, 10) || 90;

        const flags = {};
        card.querySelectorAll('.bg-param-row').forEach(row => {
          const key = row.dataset.key;
          const mod = workingLayer.modulations[key];
          const widthInput = row.querySelector('.bg-random-width');
          if (mod) mod.jitterWidth = parseInt(widthInput.value, 10);
          flags[key] = {
            random: row.querySelector('.bg-flag-random').checked,
            lfo: row.querySelector('.bg-flag-lfo').checked,
            keyframe: row.querySelector('.bg-flag-key').checked
          };
        });

        lastFlags = flags;
        const { variations } = this.generateManualBatchVariations(workingLayer, this.batchCount, this.batchThreshold, flags);
        candidates = variations; // fresh start - "Generate More" in Step 3 appends instead
        renderStep3();
      });
    };

    // --- Step 3: review & export --- (reads/mutates the outer `candidates` array so "Generate
    // More" can append another round without losing earlier Keep/Rate decisions)
    const renderStep3 = () => {
      let activeIdx = -1;

      const rowsHtml = candidates.map((c, i) => `
        <div class="bg-result-row" data-idx="${i}" style="display: flex; align-items: center; gap: 0.5rem; padding: 0.35rem 0.5rem; border-bottom: 1px solid rgba(255,255,255,0.05); cursor: pointer; border-radius: 4px;">
          <span style="flex: 1; font-size: 0.8rem; color: #e2e8f0;">Variation ${i + 1}</span>
          <span class="bg-saved-badge" style="font-size: 0.65rem; color: #10b981; display: ${c.savedPresetFile ? 'inline' : 'none'};" title="${c.savedPresetFile || ''}">💾 saved</span>
          <span class="bg-rated-badge" style="font-size: 0.65rem; color: #f59e0b; display: ${c.rated ? 'inline' : 'none'};">rated</span>
          <button class="bg-rate-btn" title="Rate this variation" style="padding: 0.15rem 0.4rem; border-radius: 4px; border: 1px solid #4b5563; background: transparent; color: #f59e0b; cursor: pointer; font-size: 0.75rem;">⭐</button>
          <label style="display: flex; align-items: center; gap: 0.25rem; font-size: 0.75rem; color: #10b981; cursor: pointer;">
            <input type="checkbox" class="bg-keep-cb" ${c.keep ? 'checked' : ''}> Keep
          </label>
        </div>
      `).join('');

      card.innerHTML = `
        <h3 style="margin: 0; font-size: 1.05rem; color: #e2e8f0; font-weight: 700;">🎬 Batch Generator — 3. Review (${candidates.length})</h3>
        <p style="margin: 0; font-size: 0.8rem; color: #9ca3af;">クリックでプレビュー。Keepチェックで即プリセット保存されます(presets/へ)。不採用のものも⭐で評価できます。</p>
        <div class="bg-result-list" style="display: flex; flex-direction: column; max-height: 300px; overflow-y: auto;">
          ${rowsHtml}
        </div>
        <div style="display: flex; align-items: center; gap: 0.5rem; justify-content: space-between;">
          <span class="bg-keep-count" style="font-size: 0.75rem; color: #9ca3af;"></span>
          <button class="bg-generate-more" style="padding: 0.3rem 0.75rem; border-radius: 6px; border: 1px solid #22d3ee; background: transparent; color: #22d3ee; cursor: pointer; font-size: 0.8rem;">🔄 Generate More (${this.batchCount})</button>
        </div>
        <div style="display: flex; gap: 0.75rem; justify-content: space-between; align-items: center; padding-top: 0.5rem; border-top: 1px solid var(--border-color);">
          <button class="bg-close" style="padding: 0.4rem 1rem; border-radius: 6px; border: 1px solid #4b5563; background: transparent; color: #9ca3af; cursor: pointer; font-size: 0.85rem;">Close</button>
          <button class="bg-export-selected" style="padding: 0.4rem 1.2rem; border-radius: 6px; border: none; background: #10b981; color: #0a0a0f; cursor: pointer; font-size: 0.85rem; font-weight: 600;">Export Selected</button>
        </div>
      `;

      const keepCountEl = card.querySelector('.bg-keep-count');
      const refreshKeepCount = () => {
        const n = candidates.filter(c => c.keep).length;
        keepCountEl.textContent = `${n} / ${candidates.length} kept`;
      };
      refreshKeepCount();

      card.querySelectorAll('.bg-result-row').forEach(row => {
        const idx = parseInt(row.dataset.idx, 10);

        row.querySelector('.bg-keep-cb').addEventListener('change', async (e) => {
          candidates[idx].keep = e.target.checked;
          refreshKeepCount();
          // Checking Keep immediately persists this candidate as a real preset file, so it
          // survives closing the wizard/browser (unchecking does NOT delete the saved file -
          // deleting on an accidental un-check would be a destructive surprise).
          if (e.target.checked && !candidates[idx].savedPresetFile) {
            const savedFile = await this.autoSaveCandidateAsPreset(workingLayer, candidates[idx], idx);
            if (savedFile) {
              candidates[idx].savedPresetFile = savedFile;
              const badge = row.querySelector('.bg-saved-badge');
              badge.style.display = 'inline';
              badge.title = savedFile;
            }
          }
        });

        row.addEventListener('click', (e) => {
          if (e.target.closest('.bg-keep-cb') || e.target.closest('.bg-rate-btn')) return;
          activeIdx = idx;
          soloPreview(candidates[idx]);
          card.querySelectorAll('.bg-result-row').forEach(r => { r.style.background = ''; });
          row.style.background = 'rgba(34,211,238,0.15)';
        });

        row.querySelector('.bg-rate-btn').addEventListener('click', async (e) => {
          e.stopPropagation();
          activeIdx = idx;
          soloPreview(candidates[idx]);
          const result = await this.showRatingDialog(workingLayer, pDoc);
          if (result) {
            this.rateLayer(workingLayer, result.rating, result.comment, result.reasons, result.paramFlags, row.querySelector('.bg-rate-btn'));
            candidates[idx].rated = true;
            row.querySelector('.bg-rated-badge').style.display = 'inline';
          }
        });
      });

      card.querySelector('.bg-generate-more').addEventListener('click', () => {
        const { variations } = this.generateManualBatchVariations(workingLayer, this.batchCount, this.batchThreshold, lastFlags);
        candidates = candidates.concat(variations); // append - keeps earlier Keep/Rate decisions
        renderStep3();
      });

      card.querySelector('.bg-close').addEventListener('click', () => closeWizard());
      card.querySelector('.bg-export-selected').addEventListener('click', async () => {
        const kept = candidates.filter(c => c.keep);
        if (kept.length === 0) {
          this.showToast('Check at least one "Keep" to export', 'error');
          return;
        }
        await this.exportBatchCandidates(workingLayer, kept);
      });
    };

    renderStep1();
  }

  // Standalone counterpart to the snapToStep() closure inside randomizeLayer - same logic, kept
  // as a real method so randomizePatternOnly (and anything else outside that closure) can reuse
  // it without duplicating randomizeLayer's internals.
  snapToStep(val, config) {
    if (!config.step) return val;
    const snapped = config.min + Math.round((val - config.min) / config.step) * config.step;
    return Math.max(config.min, Math.min(config.max, snapped));
  }

  // Rerolls only a generator's declared "pattern" params (BaseGenerator.getPatternParamNames -
  // e.g. Dot Design's symmetry/noiseScale/patternSeed), leaving color, grid resolution, speed,
  // and every other styling choice untouched. 2026-07-20 user feedback: Dot Design's pattern is
  // genuinely interesting to reroll on its own, but the existing full Random LFO changes
  // everything at once, discarding styling choices the user already liked along with it.
  randomizePatternOnly(layer) {
    const patternNames = layer.generator.getPatternParamNames ? layer.generator.getPatternParamNames() : [];
    if (patternNames.length === 0) return;

    const genConfigs = layer.generator.getParameterConfig();
    for (const paramName of patternNames) {
      const config = genConfigs.find(c => c.name === paramName);
      if (!config || config.type !== 'range') continue;

      const newVal = this.snapToStep(config.min + Math.random() * (config.max - config.min), config);
      layer.generator.params[paramName] = newVal;

      // Keep an un-animated parameter's LFO bounds/jitter centered on the new value, same as
      // randomizeLayer does for every other param - otherwise the next LFO/jitter pass would
      // silently pull it back toward the stale pre-reroll value.
      const mod = layer.modulations[paramName];
      if (mod && !mod.enabled && !mod.keyframeEnabled) {
        mod.min = newVal;
        mod.max = newVal;
        mod.jitterBase = newVal;
      }
    }
  }

  // Circular hue distance between two hex colors, normalized to 0 (same hue) .. 1 (opposite hue,
  // 180deg apart). Falls back to 0 if either value isn't a real hex color (nothing to compare).
  hueDiff(hexA, hexB) {
    if (typeof hexA !== 'string' || typeof hexB !== 'string') return 0;
    const hA = hexToHsl(hexA).h;
    const hB = hexToHsl(hexB).h;
    const raw = Math.abs(hA - hB) % 360;
    return (raw > 180 ? 360 - raw : raw) / 180;
  }

  // How much a given parameter's value should weigh in a similarity score, on top of the flat
  // per-parameter average every param used to get equally. Two heuristics from the roadmap
  // ("色相の差、モジュレーションの有無、物量パラメータなど") plus a real signal already on hand:
  // hue/count-shaped param names get a fixed boost, and the rest is scaled by how much past
  // evaluators judged animating that parameter to matter (Move score, 0-5, from the Opinion
  // Sheet) - a rough but concrete stand-in for "how much this parameter shapes the look", since
  // params worth animating tend to also be params whose static value is visually significant.
  // paramFlag: optional 'good'|'bad' - the rating dialog's per-parameter attribution on the
  // specific past example being compared against (stateB in calculateStatesSimilarity). When
  // present it overrides the heuristics above for this one comparison: a param the rater
  // specifically called out as the reason an example was bad should dominate the "avoid looking
  // like this" signal, while a param flagged good even within an overall-bad example shouldn't
  // count against a candidate that happens to share it.
  getParamSimilarityWeight(layerType, paramName, config, paramFlag) {
    let weight = 1.0;

    if (config.type === 'color' || /color|hue/i.test(paramName)) {
      weight *= 2.2;
    }
    if (/count|density|particleCount|lineCount|bandCount|spawnRate|ringCount|spikeCount/i.test(paramName)) {
      weight *= 1.6;
    }

    const moveScore = this.moveScores && layerType && this.moveScores[layerType]
      ? this.moveScores[layerType][paramName] : undefined;
    if (moveScore !== undefined) {
      weight *= (0.6 + moveScore / 5); // 0.6x at Move=0 up to 1.6x at Move=5
    }

    if (paramFlag === 'bad') weight *= 3;
    else if (paramFlag === 'good') weight *= 0.3;

    return weight;
  }

  // Extracts a normalized, comparable "how is this parameter moving" signature from a
  // modulation entry: { animated: 0|1, amplitude: 0..1, speed: 0..1 }. Added 2026-07-19 because
  // calculateStatesSimilarity/weightedCentroid previously only ever looked at stateA.params/
  // effects - two generations identical in every static value but one fully static and the other
  // wildly LFO'd registered as 100% similar. amplitude/speed are normalized against the param's
  // own slider range/export duration so different parameters stay comparable to each other.
  // Missing/legacy records (older ratings saved before the LFO-field-name bugfix above, or
  // genuinely static params) fall back to "not animated" rather than throwing.
  getMotionFeatures(mod, config, durationSec) {
    const range = config.max - config.min;
    if (!mod || !(range > 0)) return { animated: 0, amplitude: 0, speed: 0 };

    if (mod.keyframeEnabled && Array.isArray(mod.keyframes) && mod.keyframes.length >= 2) {
      const values = mod.keyframes.map(k => k.value).filter(v => typeof v === 'number');
      if (values.length < 2) return { animated: 0, amplitude: 0, speed: 0 };
      const amplitude = Math.max(0, Math.min(1, (Math.max(...values) - Math.min(...values)) / range));
      const frames = mod.keyframes.map(k => k.frame).filter(f => typeof f === 'number').sort((a, b) => a - b);
      const totalFrames = Math.max(1, durationSec * 60);
      const avgGap = frames.length >= 2 ? (frames[frames.length - 1] - frames[0]) / (frames.length - 1) : totalFrames;
      const speed = Math.max(0, Math.min(1, 1 - (avgGap / totalFrames))); // tightly-packed keyframes = busier/faster
      return { animated: amplitude > 0.01 ? 1 : 0, amplitude, speed };
    }

    if (mod.enabled && typeof mod.min === 'number' && typeof mod.max === 'number') {
      const amplitude = Math.max(0, Math.min(1, Math.abs(mod.max - mod.min) / range));
      const timePct = typeof mod.timePct === 'number' ? mod.timePct : 50;
      const speed = Math.max(0, Math.min(1, 1 - (timePct - 1) / 99)); // timePct = cycle's %-share of duration, so lower = faster
      return { animated: amplitude > 0.01 ? 1 : 0, amplitude, speed };
    }

    return { animated: 0, amplitude: 0, speed: 0 };
  }

  // Average of the three motion-feature deltas between two modulation entries for the same
  // parameter, 0 (identical motion) to 1 (as different as possible).
  motionFeatureDist(modA, modB, config, durationSec) {
    const fa = this.getMotionFeatures(modA, config, durationSec);
    const fb = this.getMotionFeatures(modB, config, durationSec);
    const animatedDiff = Math.abs(fa.animated - fb.animated);
    const ampDiff = Math.abs(fa.amplitude - fb.amplitude);
    const speedDiff = Math.abs(fa.speed - fb.speed);
    return (animatedDiff + ampDiff + speedDiff) / 3;
  }

  // Weighted normalized-diff similarity between two {params, effects, modulations} states
  // (1.0 = identical, 0.0 = as different as every parameter's range/weight allows). Shared by
  // the batch-diversity check (generateBatchVariations) and the Bad/Good closeness scoring in
  // randomizeLayer, so all three use exactly the same metric. layerType is optional - omitting
  // it just skips the Move-score weighting term (falls back to the heuristic-only weight).
  // Each range param's distance blends its static value (65%) with its motion signature (35%,
  // via motionFeatureDist) so two otherwise-identical states with different animation actually
  // register as different - see getMotionFeatures above.
  calculateStatesSimilarity(stateA, stateB, genConfigs, layerType) {
    let weightedDiffSum = 0;
    let weightSum = 0;
    const flagsB = stateB.paramFlags;
    const durationSec = parseFloat(this.exportDurationEl.value) || 10;
    const STATIC_WEIGHT = 0.65;
    const MOTION_WEIGHT = 0.35;

    genConfigs.forEach(config => {
      if (config.type === 'range') {
        const absoluteRange = config.max - config.min;
        if (absoluteRange <= 0) return;

        const valA = stateA.params && stateA.params[config.name] !== undefined ? stateA.params[config.name] : config.min + absoluteRange / 2;
        const valB = stateB.params && stateB.params[config.name] !== undefined ? stateB.params[config.name] : config.min + absoluteRange / 2;

        const normA = (valA - config.min) / absoluteRange;
        const normB = (valB - config.min) / absoluteRange;
        const staticDist = Math.abs(normA - normB);

        const modA = stateA.modulations && stateA.modulations[config.name];
        const modB = stateB.modulations && stateB.modulations[config.name];
        const motionDist = this.motionFeatureDist(modA, modB, config, durationSec);

        const w = this.getParamSimilarityWeight(layerType, config.name, config, flagsB && flagsB[config.name]);
        weightedDiffSum += w * (STATIC_WEIGHT * staticDist + MOTION_WEIGHT * motionDist);
        weightSum += w;
      } else if (config.type === 'color') {
        const colorA = stateA.params && stateA.params[config.name];
        const colorB = stateB.params && stateB.params[config.name];
        const w = this.getParamSimilarityWeight(layerType, config.name, config, flagsB && flagsB[config.name]);
        weightedDiffSum += w * this.hueDiff(colorA, colorB);
        weightSum += w;
      }
    });

    for (let fxName in this.fxConfigs) {
      const config = this.fxConfigs[fxName];
      const absoluteRange = config.max - config.min;
      if (absoluteRange <= 0) continue;

      const valA = stateA.effects && stateA.effects[fxName] !== undefined ? stateA.effects[fxName] : config.min + absoluteRange / 2;
      const valB = stateB.effects && stateB.effects[fxName] !== undefined ? stateB.effects[fxName] : config.min + absoluteRange / 2;

      const normA = (valA - config.min) / absoluteRange;
      const normB = (valB - config.min) / absoluteRange;
      const staticDist = Math.abs(normA - normB);

      const modA = stateA.modulations && stateA.modulations[fxName];
      const modB = stateB.modulations && stateB.modulations[fxName];
      const motionDist = this.motionFeatureDist(modA, modB, config, durationSec);

      const w = this.getParamSimilarityWeight(layerType, fxName, config, flagsB && flagsB[fxName]);
      weightedDiffSum += w * (STATIC_WEIGHT * staticDist + MOTION_WEIGHT * motionDist);
      weightSum += w;
    }

    if (weightSum > 0) {
      return 1.0 - (weightedDiffSum / weightSum);
    }
    return 1.0;
  }

  // rating: 1-10. Derives the legacy good/bad/neutral bucket so randomizeLayer's existing
  // Bad-avoidance and Good-attraction pools (score === 'bad' / 'good') keep working unchanged -
  // 7+ counts as Good, 4- counts as Bad, 5-6 is a deliberate "meh" middle that isn't strongly
  // pulled either way. The raw numeric rating is stored too so Good-attraction can weight by it
  // instead of averaging the Good bucket flatly (see goodParamCentroid/goodEffectCentroid).
  // paramFlags: optional { [paramName]: 'good'|'bad' } - only for parameters the rater actually
  // marked, giving randomizeLayer a per-parameter attribution signal sharper than the whole
  // generation's rating (see ratingWeight/getParamSimilarityWeight).
  rateLayer(layer, rating, comment, reasons, paramFlags, buttonEl) {
    const scoreType = rating >= 7 ? 'good' : (rating <= 4 ? 'bad' : 'neutral');

    const payload = {
      layerType: layer.type,
      params: JSON.parse(JSON.stringify(layer.generator.params || {})),
      effects: JSON.parse(JSON.stringify(layer.effects || {})),
      modulations: {},
      reasons: reasons || [],
      rating,
      comment: comment || '',
      paramFlags: paramFlags || {}
    };

    // 2026-07-19: previously saved lfoEnabled/lfoType/lfoRate/lfoAmount, none of which are real
    // fields on a modulation object (the actual LFO state lives in enabled/min/max/timePct/
    // behavior) - a stale field-name mismatch from an earlier data model, so every rating ever
    // submitted recorded its LFO motion as undefined. keyframeEnabled/keyframes were already
    // correct. Fixed to capture the real fields so getMotionFeatures() has something to read.
    for (let pName in layer.modulations) {
      const mod = layer.modulations[pName];
      payload.modulations[pName] = {
        enabled: mod.enabled,
        min: mod.min,
        max: mod.max,
        timePct: mod.timePct,
        behavior: mod.behavior,
        keyframeEnabled: mod.keyframeEnabled,
        keyframes: JSON.parse(JSON.stringify(mod.keyframes || []))
      };
    }
    payload.score = scoreType;

    fetch('/api/score', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        if (!this.scoreData) {
          this.scoreData = [];
        }
        this.scoreData.push(data.record);
        this.updateHeaderLayerStatus(layer);

        this.showToast(`Saved score: ${rating}/10`, 'success');

        if (buttonEl) {
          const tierColor = scoreType === 'good' ? '#10b981' : (scoreType === 'bad' ? '#ef4444' : '#f59e0b');
          buttonEl.style.boxShadow = `0 0 12px ${tierColor}`;
          setTimeout(() => { buttonEl.style.boxShadow = ''; }, 1000);
        }
      } else {
        this.showToast('Failed to save score: ' + (data.error || 'Unknown error'), 'error');
      }
    })
    .catch(err => {
      console.error('Failed to submit score:', err);
      this.showToast('Failed to submit score to server', 'error');
    });
  }

  hslToHex(h, s, l) {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = n => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  }

  async refreshFileList() {
    this.isRefreshingFiles = true;
    try {
      const res = await fetch('/api/files');
      const data = await res.json();
      if (data && data.projects && data.presets) {
        // 1. Projects Dropdown
        const currentProjectVal = this.projectSelectEl.value || this.currentProjectFile;
        this.projectSelectEl.innerHTML = '<option value="">-- Load Project --</option>';
        data.projects.forEach(file => {
          const opt = document.createElement('option');
          opt.value = file;
          opt.textContent = file;
          if (file === currentProjectVal) opt.selected = true;
          this.projectSelectEl.appendChild(opt);
        });

        // 2. Presets Dropdown
        this.presetSelectEl.innerHTML = '<option value="">-- Import Preset --</option>';
        data.presets.forEach(file => {
          const opt = document.createElement('option');
          opt.value = file;
          opt.textContent = file.replace(/\.mvlayer$/, '');
          this.presetSelectEl.appendChild(opt);
        });
      }
    } catch (err) {
      console.error('Failed to fetch local directory files:', err);
    } finally {
      this.isRefreshingFiles = false;
    }
  }

  async apiSaveProject() {
    const rawName = await this.showSaveDialog('Enter a name for this project config:');
    if (!rawName) return;

    const projectData = {
      version: "1.0",
      master: {
        duration: parseFloat(this.exportDurationEl.value) || 10,
        bgMode: this.exportBgEl.value,
        fadeOut: parseFloat(this.masterFadeOutEl.value) || 0,
        vignette: this.layerManager.masterVignette,
        grain: this.layerManager.masterFilmGrain
      },
      layers: this.layerManager.layers.map(layer => ({
        type: layer.type,
        name: layer.name,
        visible: layer.visible,
        opacity: layer.opacity,
        blendMode: layer.blendMode,
        randomSpread: layer.randomSpread,
        currentPresetName: layer.currentPresetName,
        params: { ...layer.generator.params },
        effects: { ...layer.effects },
        modulations: JSON.parse(JSON.stringify(layer.modulations))
      }))
    };

    try {
      const res = await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'project',
          name: rawName,
          data: projectData
        })
      });
      const result = await res.json();
      if (result.success) {
        alert(`Project saved successfully to projects/${result.file}`);
        await this.refreshFileList();
        this.projectSelectEl.value = result.file;
        this.currentProjectFile = result.file;
      } else {
        alert('Save failed: ' + result.error);
      }
    } catch (err) {
      alert('Save failed: ' + err.message);
    }
  }

  async apiLoadProject() {
    const file = this.projectSelectEl.value;
    if (!file) {
      alert('Please select a project from the list first.');
      return;
    }

    if (this.layerManager.layers.length > 0 && !confirm("Current layers will be replaced. Continue?")) {
      return;
    }

    try {
      const res = await fetch(`/api/load?type=project&file=${encodeURIComponent(file)}`);
      if (!res.ok) throw new Error('File not found or server error');
      
      const data = await res.json();
      if (!data || !data.layers) {
        alert('Invalid project configuration data.');
        return;
      }

      // Restore Master parameters
      if (data.master) {
        this.exportDurationEl.value = data.master.duration || 10;
        this.exportBgEl.value = data.master.bgMode || 'black';
        this.masterFadeOutEl.value = data.master.fadeOut !== undefined ? data.master.fadeOut : 0;
        this.layerManager.masterVignette = data.master.vignette !== undefined ? data.master.vignette : 0.3;
        this.layerManager.masterFilmGrain = data.master.grain !== undefined ? data.master.grain : 0.03;
      }

      // Restore Layer Manager
      this.layerManager.layers = [];
      this.layerManager.nextId = 1;

      data.layers.forEach(layerData => {
        const newLayer = this.layerManager.addLayer(layerData.type);
        newLayer.name = layerData.name || newLayer.name;
        newLayer.visible = layerData.visible !== undefined ? layerData.visible : true;
        newLayer.opacity = layerData.opacity !== undefined ? layerData.opacity : 1.0;
        newLayer.blendMode = layerData.blendMode || 'lighter';
        newLayer.randomSpread = layerData.randomSpread !== undefined ? layerData.randomSpread : 50;
        newLayer.currentPresetName = layerData.currentPresetName || 'static-none';

        if (layerData.params) {
          newLayer.generator.params = { ...newLayer.generator.params, ...layerData.params };
        }
        if (layerData.effects) {
          newLayer.effects = { ...newLayer.effects, ...layerData.effects };
        }
        if (layerData.modulations) {
          for (let paramName in layerData.modulations) {
            if (newLayer.modulations[paramName]) {
              const srcMod = layerData.modulations[paramName];
              newLayer.modulations[paramName].enabled = srcMod.enabled;
              newLayer.modulations[paramName].min = srcMod.min;
              newLayer.modulations[paramName].max = srcMod.max;
              newLayer.modulations[paramName].timePct = srcMod.timePct !== undefined ? srcMod.timePct : 50;
              newLayer.modulations[paramName].behavior = srcMod.behavior || 'return';
              newLayer.modulations[paramName].keyframeEnabled = srcMod.keyframeEnabled !== undefined ? srcMod.keyframeEnabled : false;
              newLayer.modulations[paramName].keyframes = srcMod.keyframes ? JSON.parse(JSON.stringify(srcMod.keyframes)) : [];
              newLayer.modulations[paramName].spawnJitter = srcMod.spawnJitter !== undefined ? srcMod.spawnJitter : false;
              if (srcMod.jitterBase !== undefined) newLayer.modulations[paramName].jitterBase = srcMod.jitterBase;
              if (srcMod.jitterWidth !== undefined) newLayer.modulations[paramName].jitterWidth = srcMod.jitterWidth;
            }
          }
        }
      });

      // Set focus to the first layer
      this.activeLayerId = this.layerManager.layers.length > 0 ? this.layerManager.layers[0].id : null;

      // Rebuild Hierarchy and Inspector
      this.rebuildLayersList();
      this.rebuildInspector();

      // Render frame immediately
      this.mainApp.renderSingleFrame();

      this.currentProjectFile = file;

    } catch (err) {
      alert('Failed to load project: ' + err.message);
    }
  }

  async apiNewProject() {
    const proceed = this.layerManager.layers.length > 0 
      ? await this.showConfirmDialog("New Project", "All layers will be deleted. Are you sure you want to create a new project?")
      : true;

    if (!proceed) return;

    this.layerManager.layers = [];
    this.layerManager.nextId = 1;
    this.currentProjectFile = null;
    this.projectSelectEl.value = '';
    this.activeLayerId = null;
    this.rebuildLayersList();
    this.rebuildInspector();
    this.mainApp.renderSingleFrame();
  }

  async apiSaveProjectQuick() {
    if (!this.currentProjectFile) {
      await this.apiSaveProject();
      return;
    }

    // API expects the raw filename without extension (apiHandler will append .mvproj)
    const rawName = this.currentProjectFile.replace(/\.mvproj$/, '').replace(/\.json$/, '');

    const projectData = {
      version: "1.0",
      master: {
        duration: parseFloat(this.exportDurationEl.value) || 10,
        bgMode: this.exportBgEl.value,
        fadeOut: parseFloat(this.masterFadeOutEl.value) || 0,
        vignette: this.layerManager.masterVignette,
        grain: this.layerManager.masterFilmGrain
      },
      layers: this.layerManager.layers.map(layer => ({
        type: layer.type,
        name: layer.name,
        visible: layer.visible,
        opacity: layer.opacity,
        blendMode: layer.blendMode,
        randomSpread: layer.randomSpread,
        currentPresetName: layer.currentPresetName,
        params: { ...layer.generator.params },
        effects: { ...layer.effects },
        modulations: JSON.parse(JSON.stringify(layer.modulations))
      }))
    };

    try {
      const res = await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'project',
          name: rawName,
          data: projectData
        })
      });
      const result = await res.json();
      if (result.success) {
        alert(`Project saved successfully to projects/${result.file}`);
        await this.refreshFileList();
        this.projectSelectEl.value = result.file;
        this.currentProjectFile = result.file;
      } else {
        alert('Save failed: ' + result.error);
      }
    } catch (err) {
      alert('Save failed: ' + err.message);
    }
  }

  localExportProject() {
    const projectData = {
      version: "1.0",
      master: {
        duration: parseFloat(this.exportDurationEl.value) || 10,
        bgMode: this.exportBgEl.value,
        fadeOut: parseFloat(this.masterFadeOutEl.value) || 0,
        vignette: this.layerManager.masterVignette,
        grain: this.layerManager.masterFilmGrain
      },
      layers: this.layerManager.layers.map(layer => ({
        type: layer.type,
        name: layer.name,
        visible: layer.visible,
        opacity: layer.opacity,
        blendMode: layer.blendMode,
        randomSpread: layer.randomSpread,
        currentPresetName: layer.currentPresetName,
        params: { ...layer.generator.params },
        effects: { ...layer.effects },
        modulations: JSON.parse(JSON.stringify(layer.modulations))
      }))
    };

    const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    let fileName = 'project.mvproj';
    if (this.currentProjectFile) {
      fileName = this.currentProjectFile.replace(/\.mvproj$/, '').replace(/\.json$/, '') + '.mvproj';
    }

    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }

  async localImportProject(e) {
    const file = e.target.files[0];
    if (!file) return;

    const proceed = this.layerManager.layers.length > 0 
      ? await this.showConfirmDialog("Import Project", "Current layers will be replaced by the imported project. Continue?")
      : true;

    if (!proceed) {
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (!data || !data.layers) {
          alert('Invalid project configuration data.');
          return;
        }

        // Restore Master parameters
        if (data.master) {
          this.exportDurationEl.value = data.master.duration || 10;
          this.exportBgEl.value = data.master.bgMode || 'black';
          this.masterFadeOutEl.value = data.master.fadeOut !== undefined ? data.master.fadeOut : 0;
          this.layerManager.masterVignette = data.master.vignette !== undefined ? data.master.vignette : 0.3;
          this.layerManager.masterFilmGrain = data.master.grain !== undefined ? data.master.grain : 0.03;
        }

        // Restore Layer Manager
        this.layerManager.layers = [];
        this.layerManager.nextId = 1;

        data.layers.forEach(layerData => {
          const newLayer = this.layerManager.addLayer(layerData.type);
          newLayer.name = layerData.name || newLayer.name;
          newLayer.visible = layerData.visible !== undefined ? layerData.visible : true;
          newLayer.opacity = layerData.opacity !== undefined ? layerData.opacity : 1.0;
          newLayer.blendMode = layerData.blendMode || 'lighter';
          newLayer.randomSpread = layerData.randomSpread !== undefined ? layerData.randomSpread : 50;
          newLayer.currentPresetName = layerData.currentPresetName || 'static-none';

          if (layerData.params) {
            newLayer.generator.params = { ...newLayer.generator.params, ...layerData.params };
          }
          if (layerData.effects) {
            newLayer.effects = { ...newLayer.effects, ...layerData.effects };
          }
          if (layerData.modulations) {
            for (let paramName in layerData.modulations) {
              if (newLayer.modulations[paramName]) {
                const srcMod = layerData.modulations[paramName];
                newLayer.modulations[paramName].enabled = srcMod.enabled;
                newLayer.modulations[paramName].min = srcMod.min;
                newLayer.modulations[paramName].max = srcMod.max;
                newLayer.modulations[paramName].timePct = srcMod.timePct !== undefined ? srcMod.timePct : 50;
                newLayer.modulations[paramName].behavior = srcMod.behavior || 'return';
                newLayer.modulations[paramName].keyframeEnabled = srcMod.keyframeEnabled !== undefined ? srcMod.keyframeEnabled : false;
                newLayer.modulations[paramName].keyframes = srcMod.keyframes ? JSON.parse(JSON.stringify(srcMod.keyframes)) : [];
                newLayer.modulations[paramName].spawnJitter = srcMod.spawnJitter !== undefined ? srcMod.spawnJitter : false;
                if (srcMod.jitterBase !== undefined) newLayer.modulations[paramName].jitterBase = srcMod.jitterBase;
                if (srcMod.jitterWidth !== undefined) newLayer.modulations[paramName].jitterWidth = srcMod.jitterWidth;
              }
            }
          }
        });

        // Set focus to the first layer
        this.activeLayerId = this.layerManager.layers.length > 0 ? this.layerManager.layers[0].id : null;

        // Set project file reference (keep it as .mvproj since we now unified on this extension)
        this.currentProjectFile = file.name;
        
        // Rebuild Hierarchy and Inspector
        this.rebuildLayersList();
        this.rebuildInspector();

        // Render frame immediately
        this.mainApp.renderSingleFrame();

        alert('Project imported successfully.');

      } catch (err) {
        alert('Failed to parse project file: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  }

  /**
   * Shows a custom inline confirm dialog matching the design theme
   * Returns a Promise that resolves to true (OK) or false (Cancel).
   */
  showConfirmDialog(title, message) {
    return new Promise((resolve) => {
      const overlay = this.createElement('div');
      overlay.style.cssText = `
        position: fixed; inset: 0; z-index: 9999;
        background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
        display: flex; align-items: center; justify-content: center;
      `;

      overlay.innerHTML = `
        <div style="
          background: #1a1a2e; border: 1px solid #7c3aed;
          border-radius: 12px; padding: 1.5rem 2rem; min-width: 360px;
          box-shadow: 0 0 30px rgba(124,58,237,0.5);
          display: flex; flex-direction: column; gap: 1rem;
        ">
          <h3 style="margin: 0; font-size: 1rem; color: #e2e8f0; font-weight: 700;">${title}</h3>
          <p style="margin: 0; font-size: 0.9rem; color: #9ca3af; line-height: 1.4; white-space: normal; text-align: left;">${message}</p>
          <div style="display: flex; gap: 0.75rem; justify-content: flex-end;">
            <button id="confirm-dialog-cancel" style="
              padding: 0.4rem 1rem; border-radius: 6px; border: 1px solid #4b5563;
              background: transparent; color: #9ca3af; cursor: pointer; font-size: 0.85rem;
            ">Cancel</button>
            <button id="confirm-dialog-ok" style="
              padding: 0.4rem 1.2rem; border-radius: 6px; border: none;
              background: #7c3aed; color: white; cursor: pointer; font-size: 0.85rem; font-weight: 600;
            ">Proceed</button>
          </div>
        </div>
      `;

      (this.activeDocument || document).body.appendChild(overlay);

      const btnOk = overlay.querySelector('#confirm-dialog-ok');
      const btnCancel = overlay.querySelector('#confirm-dialog-cancel');

      const finish = (result) => {
        (this.activeDocument || document).body.removeChild(overlay);
        resolve(result);
      };

      btnOk.addEventListener('click', () => finish(true));
      btnCancel.addEventListener('click', () => finish(false));
      
      const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
          window.removeEventListener('keydown', handleKeyDown);
          finish(false);
        }
      };
      window.addEventListener('keydown', handleKeyDown);
    });
  }

  // Unified 1-10 + comment rating dialog, replacing the old binary Good/Bad buttons. Resolves
  // { rating, comment, reasons } on submit, or null on cancel/escape. rateLayer() derives the
  // legacy good/bad/neutral bucket from `rating` for the existing randomizeLayer logic, and
  // Good-attraction now weights by the raw rating instead of averaging the Good bucket flatly.
  // targetDoc: optional - render into a specific document (e.g. the Batch Generator's popup
  // window) instead of wherever this.activeDocument currently points. Defaults to the existing
  // behavior (main document, or the Float Inspector's popup if that's independently detached).
  showRatingDialog(layer, targetDoc) {
    return new Promise((resolve) => {
      const doc = targetDoc || this.activeDocument || document;
      const overlay = doc.createElement('div');
      overlay.style.cssText = `
        position: fixed; inset: 0; z-index: 9999;
        background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
        display: flex; align-items: center; justify-content: center;
      `;

      // Per-parameter good/bad attribution (optional, mark only what stood out): lets
      // randomizeLayer's Good-attraction centroid trust a specific value more than the whole
      // generation's rating would (or exclude it entirely if flagged bad), instead of every
      // parameter in a 9/10 example pulling equally hard even when most of them were incidental.
      const paramRows = [];
      if (layer) {
        layer.generator.getParameterConfig().forEach(config => {
          if (config.type === 'range' || config.type === 'color') {
            paramRows.push({ key: config.name, label: config.label, val: layer.generator.params[config.name] });
          }
        });
        for (let fxName in this.fxConfigs) {
          paramRows.push({ key: fxName, label: this.fxConfigs[fxName].label, val: layer.effects[fxName] });
        }
      }
      const formatParamVal = (v) => typeof v === 'number' ? (v % 1 === 0 ? v.toString() : v.toFixed(3)) : v;
      const paramRowsHtml = paramRows.map(p => `
        <div class="param-flag-row" data-key="${p.key}" style="display: flex; align-items: center; gap: 0.5rem; padding: 0.2rem 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
          <span style="flex: 1; font-size: 0.75rem; color: #9ca3af; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${p.label}</span>
          <span style="font-size: 0.7rem; color: #6b7280; font-family: var(--font-mono); width: 64px; text-align: right;">${formatParamVal(p.val)}</span>
          <button class="param-flag-btn" data-flag="good" style="width: 22px; height: 22px; border-radius: 4px; border: 1px solid #4b5563; background: transparent; cursor: pointer; font-size: 0.7rem; line-height: 1; padding: 0;">👍</button>
          <button class="param-flag-btn" data-flag="bad" style="width: 22px; height: 22px; border-radius: 4px; border: 1px solid #4b5563; background: transparent; cursor: pointer; font-size: 0.7rem; line-height: 1; padding: 0;">👎</button>
        </div>
      `).join('');

      const reasons = [
        { id: 'strobe_excess', text: 'strobe_excess : ストロボ過多 (チカチカしすぎる)' },
        { id: 'scale_too_small', text: 'scale_too_small : スケールが小さすぎる (こじんまり)' },
        { id: 'scale_too_large', text: 'scale_too_large : 全体カバー不足 (もっと全体に広げたい)' },
        { id: 'aspect_break', text: 'aspect_break : 回転によるアスペクト破綻 (画面端の黒い隙間)' },
        { id: 'too_simple', text: 'too_simple : シンプルすぎる (スカスカ・地味)' },
        { id: 'too_chaotic', text: 'too_chaotic : 過剰演出すぎる (光すぎ・残像過多・白飛び)' },
        { id: 'noise_warp_excess', text: 'noise_warp_excess : ノイズワープ過多 (歪みすぎ)' },
        { id: 'nothing_visible', text: 'nothing_visible : 何も映っていない (真っ暗・見えない)' },
        { id: 'color_monotonous', text: 'color_monotonous : 配色が地味・単調' },
        { id: 'motion_too_fast', text: 'motion_too_fast : 動きが速すぎて目が疲れる' },
        { id: 'motion_too_slow', text: 'motion_too_slow : 静止しすぎ' }
      ];

      const checkboxesHtml = reasons.map(r => `
        <label style="display: flex; align-items: center; gap: 0.5rem; color: #9ca3af; font-size: 0.8rem; cursor: pointer; user-select: none; margin-bottom: 0.2rem;">
          <input type="checkbox" name="rate-reason" value="${r.id}" style="
            accent-color: #f59e0b; cursor: pointer; width: 14px; height: 14px;
          ">
          <span>${r.text}</span>
        </label>
      `).join('');

      const tierColor = (n) => n <= 4 ? '#ef4444' : (n <= 6 ? '#f59e0b' : '#10b981');
      const ratingButtonsHtml = Array.from({ length: 10 }, (_, i) => i + 1).map(n => `
        <button class="rate-num-btn" data-val="${n}" style="
          width: 30px; height: 30px; border-radius: 6px; border: 1px solid ${tierColor(n)};
          background: transparent; color: ${tierColor(n)}; cursor: pointer;
          font-size: 0.8rem; font-weight: 700; font-family: var(--font-mono);
        ">${n}</button>
      `).join('');

      overlay.innerHTML = `
        <div style="
          background: #1a1a2e; border: 1px solid #f59e0b;
          border-radius: 12px; padding: 1.5rem 2rem; min-width: 460px;
          max-height: 85vh; overflow-y: auto;
          box-shadow: 0 0 30px rgba(245,158,11,0.35);
          display: flex; flex-direction: column; gap: 1rem;
        ">
          <h3 style="margin: 0; font-size: 1.05rem; color: #e2e8f0; font-weight: 700;">⭐ Rate This Generation</h3>
          <div style="display: flex; gap: 0.4rem; justify-content: space-between;">
            ${ratingButtonsHtml}
          </div>
          <p class="rate-selected-label" style="margin: 0; font-size: 0.8rem; color: #6b7280; text-align: center;">Select a score (1-10)</p>
          <textarea class="rate-comment" placeholder="Comment (optional) - what worked, what didn't..." rows="2" style="
            resize: vertical; background: rgba(0,0,0,0.3); border: 1px solid var(--border-color);
            color: #e2e8f0; font-size: 0.8rem; border-radius: 6px; padding: 0.5rem; font-family: inherit;
          "></textarea>
          <p style="margin: 0; font-size: 0.8rem; color: #9ca3af;">気になった点(任意):</p>
          <div style="display: flex; flex-direction: column; gap: 0.4rem; text-align: left; max-height: 160px; overflow-y: auto;">
            ${checkboxesHtml}
          </div>
          <p style="margin: 0; font-size: 0.8rem; color: #9ca3af;">パラメータ別チェック(任意 - 気になったものだけ):</p>
          <div class="param-flags-list" style="display: flex; flex-direction: column; text-align: left; max-height: 220px; overflow-y: auto; padding-right: 0.25rem;">
            ${paramRowsHtml}
          </div>
          <div style="display: flex; gap: 0.75rem; justify-content: flex-end;">
            <button id="rate-dialog-cancel" style="
              padding: 0.4rem 1rem; border-radius: 6px; border: 1px solid #4b5563;
              background: transparent; color: #9ca3af; cursor: pointer; font-size: 0.85rem;
            ">Cancel</button>
            <button id="rate-dialog-submit" disabled style="
              padding: 0.4rem 1.2rem; border-radius: 6px; border: none;
              background: #4b5563; color: white; cursor: not-allowed; font-size: 0.85rem; font-weight: 600;
            ">Submit</button>
          </div>
        </div>
      `;

      doc.body.appendChild(overlay);

      const numBtns = Array.from(overlay.querySelectorAll('.rate-num-btn'));
      const selectedLabel = overlay.querySelector('.rate-selected-label');
      const btnSubmit = overlay.querySelector('#rate-dialog-submit');
      const btnCancel = overlay.querySelector('#rate-dialog-cancel');
      let selectedRating = null;

      const paramFlags = {};
      overlay.querySelectorAll('.param-flag-row').forEach(row => {
        const key = row.dataset.key;
        const btnFlagGood = row.querySelector('[data-flag="good"]');
        const btnFlagBad = row.querySelector('[data-flag="bad"]');
        const refreshRow = () => {
          const flag = paramFlags[key];
          btnFlagGood.style.background = flag === 'good' ? '#10b981' : 'transparent';
          btnFlagGood.style.borderColor = flag === 'good' ? '#10b981' : '#4b5563';
          btnFlagBad.style.background = flag === 'bad' ? '#ef4444' : 'transparent';
          btnFlagBad.style.borderColor = flag === 'bad' ? '#ef4444' : '#4b5563';
        };
        const toggle = (flag) => {
          if (paramFlags[key] === flag) delete paramFlags[key];
          else paramFlags[key] = flag;
          refreshRow();
        };
        btnFlagGood.addEventListener('click', () => toggle('good'));
        btnFlagBad.addEventListener('click', () => toggle('bad'));
      });

      numBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          selectedRating = parseInt(btn.dataset.val, 10);
          const color = tierColor(selectedRating);
          numBtns.forEach(b => {
            const active = b === btn;
            b.style.background = active ? color : 'transparent';
            b.style.color = active ? '#0a0a0f' : tierColor(parseInt(b.dataset.val, 10));
          });
          selectedLabel.textContent = `Score: ${selectedRating}/10`;
          selectedLabel.style.color = color;
          btnSubmit.disabled = false;
          btnSubmit.style.background = color;
          btnSubmit.style.cursor = 'pointer';
          btnSubmit.style.boxShadow = `0 0 10px ${color}`;
        });
      });

      const finish = (result) => {
        doc.body.removeChild(overlay);
        resolve(result);
      };

      btnSubmit.addEventListener('click', () => {
        if (selectedRating === null) return;
        const checkedReasons = Array.from(overlay.querySelectorAll('input[name="rate-reason"]:checked')).map(el => el.value);
        const comment = overlay.querySelector('.rate-comment').value.trim();
        finish({ rating: selectedRating, comment, reasons: checkedReasons, paramFlags });
      });

      btnCancel.addEventListener('click', () => finish(null));

      const dialogWindow = doc.defaultView || window;
      const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
          dialogWindow.removeEventListener('keydown', handleKeyDown);
          finish(null);
        }
      };
      dialogWindow.addEventListener('keydown', handleKeyDown);
    });
  }

  // Popup editor (same window.open pattern as showBatchGeneratorWizard) for the Score/Move/Comment
  // "tendency" rows this layer type has in Excels/PresetLayerOpinionSheet.xlsx - Score/Move drive
  // randomizeLayer's constraints and Move-score gating (see CLAUDE.md "プリセット量産・教師モデル"),
  // so a gacha-avoidance parameter that keeps rolling unwanted values usually traces back to one of
  // these two numbers being set too permissively, not to the live evaluation data. 2026-07-20: added
  // after a user report that Neon Lightning's Trail Spin kept rolling unwanted nonzero values - that
  // turned out to be an unrelated hardcoded FX branch (fixed separately), but the underlying ask for
  // a way to tune these tendencies without opening Excel is legitimate on its own.
  async showOpinionSheetEditor(layer) {
    const popup = window.open('', 'MovieCreatorOpinionSheet', 'width=580,height=780,menubar=no,toolbar=no,location=no,status=no,resizable=yes');
    if (!popup) {
      this.showToast('⚠️ Popup blocker prevented opening the editor window. Please allow popups for this site.', 'error');
      return;
    }
    const pDoc = popup.document;
    pDoc.title = 'MovieCreator - Opinion Sheet Editor';
    document.querySelectorAll('link[rel="stylesheet"], style').forEach(el => {
      pDoc.head.appendChild(el.cloneNode(true));
    });
    pDoc.body.style.cssText = `
      background: #090714; margin: 0; padding: 1rem; color: #e2e8f0;
      font-family: 'Outfit', system-ui, -apple-system, sans-serif;
    `;

    const card = pDoc.createElement('div');
    card.style.cssText = `display: flex; flex-direction: column; gap: 0.75rem; height: calc(100vh - 2rem);`;
    pDoc.body.appendChild(card);

    let closed = false;
    const closeEditor = () => {
      if (closed) return;
      closed = true;
      if (!popup.closed) popup.close();
    };
    const handleKeyDown = (e) => { if (e.key === 'Escape') closeEditor(); };
    popup.addEventListener('keydown', handleKeyDown);
    popup.addEventListener('beforeunload', () => { closed = true; });

    card.innerHTML = `<p style="color: #9ca3af; font-size: 0.85rem;">Loading ${layer.type}...</p>`;

    let rows = [];
    try {
      // displayName/params are only actually used by the server when `layer.type` isn't already
      // registered in the opinion sheet - a brand new generator this session (see
      // registerNewLayerColumn in apiHandler.js). Harmless to always send them; an already-known
      // layer type just ignores them and returns its existing rows as before.
      const ownParams = layer.generator.getParameterConfig()
        .filter(c => c.type === 'range' || c.type === 'color')
        .map(c => ({ name: c.name, label: c.label }));
      const qs = new URLSearchParams({
        layer: layer.type,
        displayName: layer.getDefaultName(layer.type),
        params: JSON.stringify(ownParams)
      });
      const res = await fetch(`/api/opinion-sheet?${qs.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      rows = data.rows;
    } catch (err) {
      card.innerHTML = `<p style="color: #ef4444; font-size: 0.85rem;">読み込み失敗: ${err.message}</p>`;
      return;
    }

    const render = () => {
      card.innerHTML = `
        <h3 style="margin: 0; font-size: 1.05rem; color: #e2e8f0; font-weight: 700;">📝 Opinion Sheet — ${layer.type}</h3>
        <p style="margin: 0; font-size: 0.75rem; color: #9ca3af;">Score(1-5): 結果の良さ。Move(0-5): アニメーションさせる効果。ここでの変更は保存時にExcelへ書き戻され、data/move_scores.jsonも自動再生成されます(ランダマイザーへ即反映)。</p>
        <div class="os-rows" style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 0.4rem; border-top: 1px solid var(--border-color); padding-top: 0.5rem;">
          ${rows.map((r, i) => `
            <div class="os-row" data-idx="${i}" style="display: grid; grid-template-columns: 1fr 52px 52px 2fr; gap: 0.4rem; align-items: center;">
              <span style="font-size: 0.78rem; color: #e2e8f0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${r.param}">${r.label}</span>
              <input type="number" class="os-score" min="0" max="5" step="1" value="${r.score !== null ? r.score : ''}" style="width: 48px; padding: 0.2rem; background: rgba(0,0,0,0.3); border: 1px solid var(--border-color); color: #e2e8f0; border-radius: 4px; font-size: 0.78rem;">
              <input type="number" class="os-move" min="0" max="5" step="1" value="${r.move !== null ? r.move : ''}" style="width: 48px; padding: 0.2rem; background: rgba(0,0,0,0.3); border: 1px solid var(--border-color); color: #e2e8f0; border-radius: 4px; font-size: 0.78rem;">
              <input type="text" class="os-comment" value="${(r.comment || '').replace(/"/g, '&quot;')}" style="padding: 0.2rem 0.4rem; background: rgba(0,0,0,0.3); border: 1px solid var(--border-color); color: #e2e8f0; border-radius: 4px; font-size: 0.72rem;">
            </div>
          `).join('')}
        </div>
        <div style="display: flex; gap: 0.5rem; justify-content: flex-end; border-top: 1px solid var(--border-color); padding-top: 0.6rem;">
          <button class="os-close" style="padding: 0.4rem 1rem; border-radius: 6px; border: 1px solid #4b5563; background: transparent; color: #9ca3af; cursor: pointer; font-size: 0.85rem;">Close</button>
          <button class="os-save" style="padding: 0.4rem 1.2rem; border-radius: 6px; border: none; background: #22d3ee; color: #0a0a0f; cursor: pointer; font-size: 0.85rem; font-weight: 600;">💾 Save</button>
        </div>
      `;

      card.querySelector('.os-close').addEventListener('click', closeEditor);
      card.querySelector('.os-save').addEventListener('click', async () => {
        const saveBtn = card.querySelector('.os-save');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        const updates = [];
        card.querySelectorAll('.os-row').forEach(rowEl => {
          const idx = parseInt(rowEl.dataset.idx, 10);
          const r = rows[idx];
          const scoreStr = rowEl.querySelector('.os-score').value;
          const moveStr = rowEl.querySelector('.os-move').value;
          const comment = rowEl.querySelector('.os-comment').value;
          updates.push({
            row: r.row,
            score: scoreStr === '' ? null : parseFloat(scoreStr),
            move: moveStr === '' ? null : parseFloat(moveStr),
            comment
          });
        });

        try {
          const res = await fetch('/api/opinion-sheet', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ layerType: layer.type, updates })
          });
          const data = await res.json();
          if (!res.ok || !data.success) throw new Error(data.error || `HTTP ${res.status}`);

          await this.loadMoveScores(); // refresh in-memory Move scores immediately
          this.showToast('✅ Opinion sheet saved', 'success');
        } catch (err) {
          this.showToast('❌ Save failed: ' + err.message, 'error');
        } finally {
          saveBtn.disabled = false;
          saveBtn.textContent = '💾 Save';
        }
      });
    };

    render();
  }

  showLearningStatsDialog(layerType) {
    const data = this.scoreData || [];
    
    // 全レイヤーの集計
    const totalAll = data.length;
    const goodAll = data.filter(e => e.score === 'good').length;
    const badAll = data.filter(e => e.score === 'bad').length;

    // 現在のレイヤーの集計
    const layerData = data.filter(e => e.layerType === layerType);
    const totalLayer = layerData.length;
    const goodLayer = layerData.filter(e => e.score === 'good').length;
    const badLayer = layerData.filter(e => e.score === 'bad').length;

    // Good引力（randomizeLayerの goodAttractionWeight と同じ計算式）
    const goodAttractionWeight = goodLayer === 0
      ? 0
      : this.GOOD_ATTRACTION_MAX_WEIGHT * Math.min(1, goodLayer / this.GOOD_ATTRACTION_CONFIDENCE_SAMPLES);
    const goodAttractionPct = Math.round(goodAttractionWeight * 100);
    const goodAttractionStatus = goodLayer === 0
      ? { icon: '⚪ なし', color: '#6b7280' }
      : (goodAttractionWeight < this.GOOD_ATTRACTION_MAX_WEIGHT ? { icon: '🟡 弱', color: '#f59e0b' } : { icon: '🟢 有効', color: '#10b981' });

    // 理由別カウント（現在のレイヤー）
    const reasonCounts = {
      strobe_excess: 0,
      scale_too_small: 0,
      scale_too_large: 0,
      aspect_break: 0,
      too_simple: 0,
      too_chaotic: 0,
      noise_warp_excess: 0,
      nothing_visible: 0,
      color_monotonous: 0,
      motion_too_fast: 0,
      motion_too_slow: 0
    };

    layerData.forEach(e => {
      if (e.score === 'bad' && e.reasons) {
        e.reasons.forEach(r => {
          if (reasonCounts[r] !== undefined) {
            reasonCounts[r]++;
          }
        });
      }
    });

    const reasonsMeta = [
      { id: 'strobe_excess', name: 'ストロボ過多 (strobe_excess)', desc: 'ストロボ確率を 5% に低下、強さを 1.5 にクランプ' },
      { id: 'scale_too_small', name: 'スケールが小さすぎる (scale_too_small)', desc: 'スケール下限 0.8、Generator数量の下限引き上げ' },
      { id: 'scale_too_large', name: '全体カバー不足 (scale_too_large)', desc: 'スケール下限 0.8、Generator数量の下限引き上げ' },
      { id: 'aspect_break', name: 'アスペクト破綻 (aspect_break)', desc: '回転時にスケール下限を 1.42 に強制クランプ' },
      { id: 'too_simple', name: 'シンプルすぎる (too_simple)', desc: '数量下限、Glow下限 5.0、Decay下限 0.30' },
      { id: 'too_chaotic', name: '過剰演出すぎる (too_chaotic)', desc: 'Glow上限 20.0、Decay上限 0.80' },
      { id: 'noise_warp_excess', name: 'ノイズワープ過多 (noise_warp_excess)', desc: '80%確率でノイズ無効化、有効時上限 4.0' },
      { id: 'nothing_visible', name: '何も映っていない (nothing_visible)', desc: '数量・サイズ・輝度下限引き上げ、Glow下限 15.0、Scale下限 0.8' },
      { id: 'color_monotonous', name: '配色が地味・単調 (color_monotonous)', desc: '新しい色相を前回から90°以上離してリロール' },
      { id: 'motion_too_fast', name: '動きが速すぎる (motion_too_fast)', desc: 'テンプレート適用を停止、LFO周期を55%以上(遅く)にクランプ' },
      { id: 'motion_too_slow', name: '静止しすぎ (motion_too_slow)', desc: '静止パラメータを強制LFO化、周期を35%以下(速く)にクランプ' }
    ];

    const reasonsHtml = reasonsMeta.map(meta => {
      const count = reasonCounts[meta.id] || 0;
      const isActive = count > 0;
      const statusIcon = isActive ? '🔴 Active' : '⚪ Inactive';
      const statusColor = isActive ? '#ef4444' : '#6b7280';
      const barWidthPct = totalLayer > 0 ? Math.min(100, (count / totalLayer) * 100) : 0;

      return `
        <div style="margin-bottom: 0.8rem; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.5rem;">
          <div style="display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 0.25rem;">
            <span style="color: #e2e8f0; font-weight: 600;">${meta.name}</span>
            <span style="color: ${statusColor}; font-weight: 700; font-size: 0.75rem;">${statusIcon} (${count}回)</span>
          </div>
          <div style="height: 6px; background: #2e2e4f; border-radius: 3px; overflow: hidden; margin-bottom: 0.3rem;">
            <div style="height: 100%; width: ${barWidthPct}%; background: ${isActive ? '#ef4444' : '#3b82f6'}; border-radius: 3px; box-shadow: 0 0 8px ${isActive ? '#ef4444' : '#3b82f6'};"></div>
          </div>
          <div style="font-size: 0.75rem; color: #9ca3af; line-height: 1.3;">
            <span style="color: #a855f7; font-weight: 600;">制約:</span> ${meta.desc}
          </div>
        </div>
      `;
    }).join('');

    const overlay = this.createElement('div');
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 9999;
      background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
      display: flex; align-items: center; justify-content: center;
    `;

    overlay.innerHTML = `
      <div style="
        background: #1a1a2e; border: 1px solid #7c3aed;
        border-radius: 12px; padding: 1.5rem 2rem; width: 500px; max-height: 80vh; overflow-y: auto;
        box-shadow: 0 0 35px rgba(124,58,237,0.4);
        display: flex; flex-direction: column; gap: 1.2rem;
      ">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">
          <h3 style="margin: 0; font-size: 1.1rem; color: #e2e8f0; font-weight: 700; display: flex; align-items: center; gap: 0.5rem;">
            <span>📊</span> Learning Progress & Parameters Stats
          </h3>
          <button id="stats-dialog-close-top" style="background: transparent; border: none; color: #9ca3af; font-size: 1.2rem; cursor: pointer; padding: 0;">&times;</button>
        </div>

        <!-- 全体統計 -->
        <div style="background: #111122; border-radius: 8px; padding: 0.75rem 1rem; border: 1px solid rgba(124,58,237,0.2); display: flex; justify-content: space-around; text-align: center;">
          <div>
            <div style="font-size: 0.7rem; color: #9ca3af; text-transform: uppercase;">Total Rated</div>
            <div style="font-size: 1.25rem; font-weight: 700; color: #7c3aed;">${totalAll}</div>
          </div>
          <div>
            <div style="font-size: 0.7rem; color: #9ca3af; text-transform: uppercase;">Good 👍</div>
            <div style="font-size: 1.25rem; font-weight: 700; color: #10b981;">${goodAll}</div>
          </div>
          <div>
            <div style="font-size: 0.7rem; color: #9ca3af; text-transform: uppercase;">Bad 👎</div>
            <div style="font-size: 1.25rem; font-weight: 700; color: #ef4444;">${badAll}</div>
          </div>
        </div>

        <!-- 現在のレイヤーの統計 -->
        <div style="text-align: left;">
          <h4 style="margin: 0 0 0.5rem 0; font-size: 0.9rem; color: #e2e8f0; font-weight: 600;">
            Layer Type: <span style="color: var(--color-accent); font-family: var(--font-mono);">${layerType}</span>
          </h4>
          <p style="margin: 0 0 0.8rem 0; font-size: 0.8rem; color: #9ca3af; line-height: 1.4;">
            このレイヤータイプの評価数: <strong>${totalLayer}回</strong> (👍 ${goodLayer} / 👎 ${badLayer})
          </p>

          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; margin-bottom: 0.8rem; background: #111122; border-radius: 6px; padding: 0.5rem 0.75rem; border: 1px solid rgba(16,185,129,0.15);">
            <span style="color: #e2e8f0; font-weight: 600;">Good引力 (Attraction)</span>
            <span style="color: ${goodAttractionStatus.color}; font-weight: 700;">${goodAttractionStatus.icon} (${goodLayer}件, 重み${goodAttractionPct}%)</span>
          </div>

          <!-- 各理由と制約のリスト -->
          <div style="max-height: 320px; overflow-y: auto; padding-right: 0.5rem;">
            ${reasonsHtml}
          </div>
        </div>

        <div style="display: flex; justify-content: flex-end; margin-top: 0.5rem;">
          <button id="stats-dialog-close" style="
            padding: 0.4rem 1.5rem; border-radius: 6px; border: none;
            background: #7c3aed; color: white; cursor: pointer; font-size: 0.85rem; font-weight: 600;
            box-shadow: 0 0 10px rgba(124,58,237,0.4);
          ">Close</button>
        </div>
      </div>
    `;

    (this.activeDocument || document).body.appendChild(overlay);

    const btnClose = overlay.querySelector('#stats-dialog-close');
    const btnCloseTop = overlay.querySelector('#stats-dialog-close-top');

    const finish = () => {
      (this.activeDocument || document).body.removeChild(overlay);
    };

    btnClose.addEventListener('click', finish);
    btnCloseTop.addEventListener('click', finish);

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        window.removeEventListener('keydown', handleKeyDown);
        finish();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
  }

  /**
   * Shows a custom inline save dialog (replaces prompt() which can be suppressed by browsers)
   * Returns a Promise that resolves to the entered name, or null if cancelled.
   */
  showSaveDialog(title, defaultValue = '') {
    return new Promise((resolve) => {
      // Create overlay
      const overlay = this.createElement('div');
      overlay.style.cssText = `
        position: fixed; inset: 0; z-index: 9999;
        background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
        display: flex; align-items: center; justify-content: center;
      `;

      overlay.innerHTML = `
        <div style="
          background: #1a1a2e; border: 1px solid #7c3aed;
          border-radius: 12px; padding: 1.5rem 2rem; min-width: 360px;
          box-shadow: 0 0 30px rgba(124,58,237,0.5);
          display: flex; flex-direction: column; gap: 1rem;
        ">
          <h3 style="margin: 0; font-size: 1rem; color: #e2e8f0; font-weight: 700;">${title}</h3>
          <input id="save-dialog-input" type="text" value="${defaultValue.replace(/"/g, '&quot;')}" style="
            width: 100%; padding: 0.5rem 0.75rem; font-size: 0.95rem;
            background: #0f0f1a; border: 1px solid #4c1d95;
            border-radius: 6px; color: #e2e8f0; outline: none;
            box-sizing: border-box;
          " placeholder="Enter name...">
          <div style="display: flex; gap: 0.75rem; justify-content: flex-end;">
            <button id="save-dialog-cancel" style="
              padding: 0.4rem 1rem; border-radius: 6px; border: 1px solid #4b5563;
              background: transparent; color: #9ca3af; cursor: pointer; font-size: 0.85rem;
            ">Cancel</button>
            <button id="save-dialog-ok" style="
              padding: 0.4rem 1.2rem; border-radius: 6px; border: none;
              background: #7c3aed; color: white; cursor: pointer; font-size: 0.85rem; font-weight: 600;
            ">Save</button>
          </div>
        </div>
      `;

      (this.activeDocument || document).body.appendChild(overlay);

      const input = overlay.querySelector('#save-dialog-input');
      const btnOk = overlay.querySelector('#save-dialog-ok');
      const btnCancel = overlay.querySelector('#save-dialog-cancel');

      // Focus and select all text in input
      input.addEventListener('focus', () => {
        input.select();
      });
      setTimeout(() => { 
        input.focus(); 
        input.select(); 
      }, 100);

      const finish = (value) => {
        (this.activeDocument || document).body.removeChild(overlay);
        resolve(value);
      };

      btnOk.addEventListener('click', () => {
        const val = input.value.trim();
        if (val) finish(val); else input.focus();
      });

      btnCancel.addEventListener('click', () => finish(null));

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const val = input.value.trim();
          if (val) finish(val);
        } else if (e.key === 'Escape') {
          finish(null);
        }
      });
    });
  }

  async apiSaveProject() {
    const rawName = await this.showSaveDialog('Save Project As:', 'my_project');
    if (!rawName) return;

    const projectData = {
      version: "1.0",
      master: {
        duration: parseFloat(this.exportDurationEl.value) || 10,
        bgMode: this.exportBgEl.value,
        fadeOut: parseFloat(this.masterFadeOutEl.value) || 0,
        vignette: this.layerManager.masterVignette,
        grain: this.layerManager.masterFilmGrain
      },
      layers: this.layerManager.layers.map(layer => ({
        type: layer.type,
        name: layer.name,
        visible: layer.visible,
        opacity: layer.opacity,
        blendMode: layer.blendMode,
        randomSpread: layer.randomSpread,
        currentPresetName: layer.currentPresetName,
        params: { ...layer.generator.params },
        effects: { ...layer.effects },
        modulations: JSON.parse(JSON.stringify(layer.modulations))
      }))
    };

    try {
      const res = await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'project',
          name: rawName,
          data: projectData
        })
      });
      const result = await res.json();
      if (result.success) {
        this.showToast(`✅ Project saved: projects/${result.file}`);
        await this.refreshFileList();
        this.projectSelectEl.value = result.file;
      } else {
        this.showToast('❌ Save failed: ' + result.error, 'error');
      }
    } catch (err) {
      this.showToast('❌ Save failed: ' + err.message, 'error');
    }
  }

  /**
   * Shows a brief toast notification (replaces alert() which can be blocked)
   */
  showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed; bottom: 2rem; left: 50%; transform: translateX(-50%);
      z-index: 9999; padding: 0.75rem 1.5rem; border-radius: 8px;
      font-size: 0.9rem; font-weight: 600; color: white;
      background: ${type === 'error' ? '#7f1d1d' : '#14532d'};
      border: 1px solid ${type === 'error' ? '#dc2626' : '#16a34a'};
      box-shadow: 0 4px 20px rgba(0,0,0,0.5);
      transition: opacity 0.4s; pointer-events: none;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 400);
    }, 3500);
  }

  async apiExportLayer() {
    const activeLayer = this.layerManager.layers.find(l => l.id === this.activeLayerId);
    if (!activeLayer) {
      this.showToast('❌ Please select a layer in the hierarchy first.', 'error');
      return;
    }

    const rawName = await this.showSaveDialog('Save Layer Preset As:', activeLayer.name);
    if (!rawName) return;

    const layerData = {
      version: "1.0",
      type: "movie-creator-layer-preset",
      layer: {
        type: activeLayer.type,
        name: rawName,
        opacity: activeLayer.opacity,
        blendMode: activeLayer.blendMode,
        randomSpread: activeLayer.randomSpread,
        currentPresetName: activeLayer.currentPresetName,
        params: { ...activeLayer.generator.params },
        effects: { ...activeLayer.effects },
        modulations: JSON.parse(JSON.stringify(activeLayer.modulations))
      }
    };

    try {
      const res = await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'preset',
          name: rawName,
          data: layerData
        })
      });
      const result = await res.json();
      if (result.success) {
        this.showToast(`✅ Preset saved: presets/${result.file}`);
        await this.refreshFileList();
      } else {
        this.showToast('❌ Save preset failed: ' + result.error, 'error');
      }
    } catch (err) {
      this.showToast('❌ Save preset failed: ' + err.message, 'error');
    }
  }

  async apiImportLayer() {
    const file = this.presetSelectEl.value;
    if (!file) {
      alert('Please select a layer preset from the list first.');
      return;
    }

    try {
      const res = await fetch(`/api/load?type=preset&file=${encodeURIComponent(file)}`);
      if (!res.ok) throw new Error('Preset file not found or server error');

      const data = await res.json();
      if (!data || data.type !== "movie-creator-layer-preset" || !data.layer) {
        alert('Invalid layer preset data.');
        return;
      }

      const lData = data.layer;
      const newLayer = this.layerManager.addLayer(lData.type);
      
      newLayer.name = lData.name ? `${lData.name} (Imported)` : newLayer.name;
      newLayer.opacity = lData.opacity !== undefined ? lData.opacity : 1.0;
      newLayer.blendMode = lData.blendMode || 'lighter';
      newLayer.randomSpread = lData.randomSpread !== undefined ? lData.randomSpread : 50;
      newLayer.currentPresetName = lData.currentPresetName || 'static-none';

      if (lData.params) {
        newLayer.generator.params = { ...newLayer.generator.params, ...lData.params };
      }
      if (lData.effects) {
        newLayer.effects = { ...newLayer.effects, ...lData.effects };
      }
      if (lData.modulations) {
        for (let paramName in lData.modulations) {
          if (newLayer.modulations[paramName]) {
            const srcMod = lData.modulations[paramName];
            newLayer.modulations[paramName].enabled = srcMod.enabled;
            newLayer.modulations[paramName].min = srcMod.min;
            newLayer.modulations[paramName].max = srcMod.max;
            newLayer.modulations[paramName].timePct = srcMod.timePct !== undefined ? srcMod.timePct : 50;
            newLayer.modulations[paramName].behavior = srcMod.behavior || 'return';
            newLayer.modulations[paramName].keyframeEnabled = srcMod.keyframeEnabled !== undefined ? srcMod.keyframeEnabled : false;
            newLayer.modulations[paramName].keyframes = srcMod.keyframes ? JSON.parse(JSON.stringify(srcMod.keyframes)) : [];
            newLayer.modulations[paramName].spawnJitter = srcMod.spawnJitter !== undefined ? srcMod.spawnJitter : false;
            if (srcMod.jitterBase !== undefined) newLayer.modulations[paramName].jitterBase = srcMod.jitterBase;
            if (srcMod.jitterWidth !== undefined) newLayer.modulations[paramName].jitterWidth = srcMod.jitterWidth;
          }
        }
      }

      // Set focus to the newly imported layer
      this.activeLayerId = newLayer.id;

      // Rebuild Hierarchy and Inspector
      this.rebuildLayersList();
      this.rebuildInspector();

      // Render frame immediately
      this.mainApp.renderSingleFrame();

    } catch (err) {
      alert('Failed to import layer preset: ' + err.message);
    }
  }

  toggleInspectorDetach() {
    if (this.isDetached) {
      this.attachInspector();
    } else {
      this.detachInspector();
    }
  }

  detachInspector() {
    if (this.popupWindow && !this.popupWindow.closed) {
      this.popupWindow.focus();
      return;
    }

    // Open a popup window with suitable width/height for inspector
    this.popupWindow = window.open('', 'MovieCreatorInspector', 'width=460,height=800,menubar=no,toolbar=no,location=no,status=no,resizable=yes');
    if (!this.popupWindow) {
      this.showToast('⚠️ Popup blocker prevented opening the inspector window. Please allow popups for this site.', 'error');
      return;
    }

    this.isDetached = true;
    this.btnDetachInspectorEl.textContent = '↙️ Dock';
    this.btnDetachInspectorEl.title = 'Dock inspector back to main window';

    const pDoc = this.popupWindow.document;
    pDoc.title = 'MovieCreator - Inspector';
    this.activeDocument = pDoc;

    // 1. Copy styles from main document to popup head
    document.querySelectorAll('link[rel="stylesheet"], style').forEach(el => {
      pDoc.head.appendChild(el.cloneNode(true));
    });

    // Add general page styling for standalone dark mode look
    pDoc.body.style.background = '#090714';
    pDoc.body.style.margin = '0';
    pDoc.body.style.padding = '1rem';
    pDoc.body.style.color = '#e2e8f0';
    pDoc.body.style.fontFamily = "'Outfit', system-ui, -apple-system, sans-serif";

    // 2. Build DOM layout matching style.css structure inside popup
    pDoc.body.innerHTML = `
      <div class="panel-section" style="height: calc(100vh - 2rem); border: none; box-shadow: none; background: transparent; display: flex; flex-direction: column;">
        <div class="inspector-container" style="flex: 1; display: flex; flex-direction: column; height: 100%;">
          <div class="inspector-header" style="margin-bottom: 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.75rem; display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0;">
            <h2 style="margin: 0; font-size: 1.1rem; font-weight: 600; white-space: nowrap;">Inspector</h2>
            <input type="text" id="popup-inspector-layer-name" style="flex: 1; padding: 0.35rem 0.65rem; border: 1px solid var(--border-color); background: var(--bg-control); color: var(--color-text); border-radius: 4px; font-size: 0.95rem; outline: none;" disabled>
          </div>
          <div id="popup-inspector-content" class="inspector-content" style="flex: 1; overflow-y: auto;"></div>
        </div>
      </div>
    `;

    // 3. Swap element references to popup elements
    this.inspectorContentEl = pDoc.getElementById('popup-inspector-content');
    this.inspectorLayerNameEl = pDoc.getElementById('popup-inspector-layer-name');

    // Re-bind layer name input handler
    this.inspectorLayerNameEl.oninput = (e) => {
      const layer = this.layerManager.layers.find(l => l.id === this.activeLayerId);
      if (layer) {
        layer.name = e.target.value;
        this.originalInspectorLayerNameEl.value = layer.name; // Keep main input synchronized
        const rowText = this.layersListEl.querySelector(`.layer-item-simple[data-id="${layer.id}"] .layer-name-text`);
        if (rowText) rowText.textContent = layer.name;
      }
    };

    // 4. Bind cleanup handler when popup is closed directly
    this.popupWindow.addEventListener('beforeunload', () => {
      // Small delay prevents re-running window.close() inside attachInspector if closed by browser button
      setTimeout(() => {
        this.attachInspector();
      }, 50);
    });

    // Bind keydown shortcut listener to popup window
    this.popupWindow.addEventListener('keydown', this.boundGlobalKeyDown);

    // 5. Replace main window inspector body with floating placeholder
    this.originalInspectorContentEl.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; text-align: center; color: var(--color-text-muted); padding: 2rem; gap: 1rem;">
        <span style="font-size: 2.5rem; animation: float 3s ease-in-out infinite;">↗️</span>
        <p style="margin: 0; font-size: 0.9rem;">Inspector is floating in a separate window.</p>
        <button id="btn-dock-back-inside" class="btn btn-secondary btn-small" style="font-size: 0.75rem; padding: 0.35rem 0.75rem;">Dock Inspector</button>
      </div>
    `;

    const btnDock = this.originalInspectorContentEl.querySelector('#btn-dock-back-inside');
    if (btnDock) {
      btnDock.addEventListener('click', () => {
        this.attachInspector();
      });
    }

    // Re-render UI parameters onto new popup DOM
    this.rebuildInspector();
  }

  attachInspector() {
    if (!this.isDetached) return;
    this.isDetached = false;
    this.activeDocument = document;

    // Close the popup if it's still open
    if (this.popupWindow) {
      if (!this.popupWindow.closed) {
        this.popupWindow.removeEventListener('keydown', this.boundGlobalKeyDown);
        this.popupWindow.close();
      }
    }
    this.popupWindow = null;

    // Reset button states
    this.btnDetachInspectorEl.textContent = '↗️ Float';
    this.btnDetachInspectorEl.title = 'Detach Inspector to float window';

    // Restore element references
    this.inspectorContentEl = this.originalInspectorContentEl;
    this.inspectorLayerNameEl = this.originalInspectorLayerNameEl;

    // Restore default layer name input handler
    this.inspectorLayerNameEl.oninput = (e) => {
      const layer = this.layerManager.layers.find(l => l.id === this.activeLayerId);
      if (layer) {
        layer.name = e.target.value;
        const rowText = this.layersListEl.querySelector(`.layer-item-simple[data-id="${layer.id}"] .layer-name-text`);
        if (rowText) rowText.textContent = layer.name;
      }
    };

    // Rebuild inspector in the main window
    this.rebuildInspector();
  }
}
