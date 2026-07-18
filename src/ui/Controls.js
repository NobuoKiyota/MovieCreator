/**
 * Controls.js - Refactored to Unity-style Hierarchy & Inspector Panel.
 * Left/Middle: Preview & Render Canvas
 * Right Upper: Layers Hierarchy List (Simple rows: reorder, delete, visibility, active toggle)
 * Right Lower: Inspector Panel (Detailed parameter tuning & LFO settings for the ACTIVE layer only)
 */
import { FX_PARAM_RANGES } from '../engine/fxParamRanges.js';
import { MOTION_TEMPLATES } from '../engine/motionTemplates.js';

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
    this.btnPlayPauseEl = document.getElementById('btn-play-pause');
    this.btnExportEl = document.getElementById('btn-export');
    this.exportDurationEl = document.getElementById('export-duration');
    this.exportBgEl = document.getElementById('export-bg');
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
      chromatic:           { name: 'chromaticOffset',     label: 'Chromatic Aberr',...R.chromaticOffset,     step: 0.5,   type: 'range' },
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

    // Batch generator defaults
    this.batchCount = 10;
    this.batchThreshold = 90;
    this.motionMapping = {};
  }

  async loadMotionMapping() {
    try {
      const res = await fetch('/data/motion_mapping.json');
      if (res.ok) {
        this.motionMapping = await res.json();
        console.log("[Motion Presets] Loaded motion mapping matrix successfully.");
      }
    } catch (e) {
      console.warn("[Motion Presets] Failed to load motion mapping JSON, using defaults:", e.message);
      this.motionMapping = {};
    }
  }

  updateTemplateDropdown() {
    if (!this.timelineTemplateSelectEl) return;
    
    this.timelineTemplateSelectEl.innerHTML = '<option value="">Template</option>';
    
    // 1. Built-in Templates
    const builtinGroup = this.createElement('optgroup');
    builtinGroup.label = "Built-in Shapes";
    for (let key in MOTION_TEMPLATES) {
      const opt = this.createElement('option');
      opt.value = "builtin:" + key;
      opt.textContent = key;
      builtinGroup.appendChild(opt);
    }
    this.timelineTemplateSelectEl.appendChild(builtinGroup);
    
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
    this.loadMotionMapping();
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
        fadeOutDuration: parseFloat(this.masterFadeOutEl.value) || 0
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

      // 1. Check if clicking on the ruler (top margin) for seek operation
      if (pos.y <= topMargin) {
        this.isTimelineSeeking = true;
        const f = Math.max(0, Math.min(maxFrames, Math.round(((pos.x - leftMargin) / graphWidth) * maxFrames)));
        this.mainApp.accumulatedTime = (f / 60) * 1000;
        this.mainApp.renderSingleFrame();
        this.drawTimeline();
        return;
      }

      // 2. Check if clicking near a keyframe point
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

        const newVal = Math.max(config.min, Math.min(config.max, config.min + (1 - (pos.y - topMargin) / graphHeight) * (config.max - config.min)));
        
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

      const newVal = Math.max(config.min, Math.min(config.max, config.min + (1 - (pos.y - topMargin) / graphHeight) * (config.max - config.min)));

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
        <div class="layer-simple-drag">☰</div>
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

      this.layersListEl.appendChild(row);
    });
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
      return;
    }

    const layer = this.layerManager.layers.find(l => l.id === this.activeLayerId);
    if (!layer) {
      this.activeLayerId = null;
      this.rebuildInspector();
      return;
    }

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
    randomizerHeader.innerHTML = `
      <div style="display: flex; align-items: center; gap: 0.5rem; flex: 1;">
        <span style="font-size: 0.75rem; color: var(--color-text-muted); font-weight: 600; white-space: nowrap;">LFO Spread</span>
        <input type="range" class="random-spread-slider" min="10" max="100" step="5" value="${currentSpread}" style="flex: 1; height: 4px;">
        <span class="spread-val-display" style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--color-accent); width: 35px; text-align: right;">${currentSpread}%</span>
      </div>
      <button class="btn btn-secondary btn-small btn-randomize" style="padding: 0.25rem 0.65rem; font-size: 0.75rem;">🎲 Random LFO</button>
      <div style="display: flex; gap: 0.25rem;">
        <button class="btn btn-secondary btn-small btn-score-stats" title="View Learning Progress & Stats" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; min-width: 28px;">📊</button>
        <button class="btn btn-secondary btn-small btn-score-good" title="Rate: Good! (Prioritize similar parameters)" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; min-width: 28px;">👍</button>
        <button class="btn btn-secondary btn-small btn-score-bad" title="Rate: Bad! (Avoid similar parameters)" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; min-width: 28px;">👎</button>
      </div>
    `;

    const spreadSlider = randomizerHeader.querySelector('.random-spread-slider');
    const spreadDisplay = randomizerHeader.querySelector('.spread-val-display');
    const btnRandom = randomizerHeader.querySelector('.btn-randomize');
    const btnGood = randomizerHeader.querySelector('.btn-score-good');
    const btnBad = randomizerHeader.querySelector('.btn-score-bad');
    const btnStats = randomizerHeader.querySelector('.btn-score-stats');

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

    btnGood.addEventListener('click', () => {
      this.rateLayer(layer, 'good', btnGood);
    });

    btnBad.addEventListener('click', async () => {
      const selectedReasons = await this.showBadScoreDialog();
      if (selectedReasons !== null) {
        this.rateLayer(layer, 'bad', btnBad, selectedReasons);
      }
    });

    btnStats.addEventListener('click', () => {
      this.showLearningStatsDialog(layer.type);
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
        <button class="btn btn-accent btn-small btn-batch-export" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; flex: 1;">🎬 Batch Export (Transparent WebM)</button>
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
      if (confirm(`Start batch export of ${this.batchCount} variations as transparent WebM?`)) {
        await this.runBatchExport(layer, this.batchCount, this.batchThreshold);
      }
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
    `;

    presetRow.querySelector('select').addEventListener('change', (e) => {
      layer.applyPreset(e.target.value);
      this.rebuildInspector(); // Dynamic redrawing to show automation toggles
      this.mainApp.renderSingleFrame();
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

    const goodParamCentroid = (key) => {
      const vals = goodEvaluations.map(e => e.params && e.params[key]).filter(v => typeof v === 'number');
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    };
    const goodEffectCentroid = (key) => {
      const vals = goodEvaluations.map(e => e.effects && e.effects[key]).filter(v => typeof v === 'number');
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    };

    // Analyze negative reasons from past bad evaluations
    const hasStrobeExcess = badEvaluations.some(e => e.reasons && e.reasons.includes('strobe_excess'));
    const hasScaleIssue = badEvaluations.some(e => e.reasons && (e.reasons.includes('scale_too_small') || e.reasons.includes('scale_too_large')));
    const hasAspectBreak = badEvaluations.some(e => e.reasons && e.reasons.includes('aspect_break'));
    const hasTooSimple = badEvaluations.some(e => e.reasons && e.reasons.includes('too_simple'));
    const hasTooChaotic = badEvaluations.some(e => e.reasons && e.reasons.includes('too_chaotic'));
    const hasNoiseWarpExcess = badEvaluations.some(e => e.reasons && e.reasons.includes('noise_warp_excess'));
    const hasNothingVisible = badEvaluations.some(e => e.reasons && e.reasons.includes('nothing_visible'));

    // Normalized-diff similarity between a candidate and one past evaluation (1.0 = identical,
    // 0.0 = as different as the parameter ranges allow). Shared by both the Bad-avoidance check
    // and the Good-closeness check below so the two use exactly the same metric.
    const calcSimilarityToEval = (evalItem, candidateParams, candidateEffects, genConfigs) => {
      let paramDiffSum = 0;
      let paramCount = 0;

      genConfigs.forEach(config => {
        if (config.type !== 'range') return;
        const absoluteRange = config.max - config.min;
        if (absoluteRange <= 0) return;
        const val = (evalItem.params && evalItem.params[config.name] !== undefined)
          ? evalItem.params[config.name] : config.min + absoluteRange / 2;
        const normEval = (val - config.min) / absoluteRange;
        const normCurrent = (candidateParams[config.name] - config.min) / absoluteRange;
        paramDiffSum += Math.abs(normCurrent - normEval);
        paramCount++;
      });

      for (let fxName in this.fxConfigs) {
        const config = this.fxConfigs[fxName];
        const absoluteRange = config.max - config.min;
        if (absoluteRange <= 0) continue;
        const val = (evalItem.effects && evalItem.effects[fxName] !== undefined)
          ? evalItem.effects[fxName] : config.min + absoluteRange / 2;
        const normEval = (val - config.min) / absoluteRange;
        const normCurrent = (candidateEffects[fxName] - config.min) / absoluteRange;
        paramDiffSum += Math.abs(normCurrent - normEval);
        paramCount++;
      }

      return paramCount > 0 ? 1.0 - (paramDiffSum / paramCount) : 0;
    };

    const maxSimilarityAmong = (evalList, candidateParams, candidateEffects, genConfigs) => {
      let max = 0;
      for (const evalItem of evalList) {
        const sim = calcSimilarityToEval(evalItem, candidateParams, candidateEffects, genConfigs);
        if (sim > max) max = sim;
      }
      return max;
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

          candidateParams[config.name] = newVal;

          const mod = layer.modulations[config.name];
          if (mod) {
            const candidateMod = JSON.parse(JSON.stringify(mod));
            candidateMod.jitterBase = newVal; // keep Spawn Jitter centered on the new mutated value

            // Check if there is an Excel-mapped motion template for this parameter
            const allowedTemplates = this.motionMapping && this.motionMapping[layer.type] && this.motionMapping[layer.type][config.name];
            let templateApplied = false;
            if (allowedTemplates && allowedTemplates.length > 0) {
              const templateName = allowedTemplates[Math.floor(Math.random() * allowedTemplates.length)];
              const durationVal = parseFloat(this.exportDurationEl.value) || 10;
              const modMin = localMin + (localMax - localMin) * 0.1;
              const modMax = localMax - (localMax - localMin) * 0.1;
              templateApplied = this.applyMotionTemplate(candidateMod, templateName, modMin, modMax, durationVal);
            }

            if (templateApplied) {
              candidateModulations[config.name] = candidateMod;
            } else if (mod.keyframeEnabled && mod.keyframes && mod.keyframes.length > 0) {
              candidateMod.keyframes.forEach(kf => {
                const kfOffset = (Math.random() * 2 - 1) * (range * spread * 0.2);
                let newKfVal = kf.value + kfOffset;
                newKfVal = Math.max(localMin, Math.min(localMax, newKfVal));
                kf.value = newKfVal;
              });
            } else if (mod.enabled) {
              const offsetMin = (Math.random() * 2 - 1) * (range * spread * 0.2);
              const offsetMax = (Math.random() * 2 - 1) * (range * spread * 0.2);
              
              let newMin = mod.min + offsetMin;
              let newMax = mod.max + offsetMax;
              
              newMin = Math.max(localMin, Math.min(localMax, newMin));
              newMax = Math.max(localMin, Math.min(localMax, newMax));
              
              candidateMod.min = newMin;
              candidateMod.max = newMax;

              const offsetTime = (Math.random() * 2 - 1) * 15;
              let newTimePct = mod.timePct + offsetTime;
              candidateMod.timePct = Math.max(1, Math.min(100, Math.round(newTimePct)));
            } else {
              candidateMod.min = newVal;
              candidateMod.max = newVal;
            }
            candidateModulations[config.name] = candidateMod;
          }
        } else if (config.type === 'color') {
          const h = Math.floor(Math.random() * 360);
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

      for (let fxName in this.fxConfigs) {
        const config = this.fxConfigs[fxName];
        
        let localMin = config.min;
        let localMax = config.max;
        const range = config.max - config.min;

        // Check if there is an Excel-mapped motion template for this FX parameter
        const allowedTemplates = this.motionMapping && this.motionMapping[layer.type] && this.motionMapping[layer.type][fxName];
        let templateApplied = false;
        
        if (allowedTemplates && allowedTemplates.length > 0) {
          const templateName = allowedTemplates[Math.floor(Math.random() * allowedTemplates.length)];
          const durationVal = parseFloat(this.exportDurationEl.value) || 10;
          
          let fxMin = localMin;
          let fxMax = localMax;
          // Apply safety limits for common FX templates
          if (fxName === 'scale') {
            fxMin = Math.max(1.0, localMin);
            fxMax = Math.min(2.0, localMax);
          } else if (fxName === 'feedbackDecay') {
            fxMin = Math.max(0.70, localMin);
            fxMax = Math.min(0.92, localMax);
          } else if (fxName === 'glowIntensity') {
            fxMin = Math.max(40, localMin);
            fxMax = Math.min(85, localMax);
          } else if (fxName === 'rotation') {
            fxMin = -180;
            fxMax = 180;
          }
          
          const mod = layer.modulations[fxName] || {
            enabled: false,
            min: fxMin,
            max: fxMax,
            timePct: 50,
            behavior: 'return',
            keyframeEnabled: false,
            keyframes: []
          };
          
          const candidateMod = JSON.parse(JSON.stringify(mod));
          templateApplied = this.applyMotionTemplate(candidateMod, templateName, fxMin, fxMax, durationVal);
          
          if (templateApplied) {
            candidateEffects[fxName] = fxMin;
            candidateModulations[fxName] = candidateMod;
            continue; // Skip standard hardcoded logic for this parameter
          }
        }

        // Apply User Directive overrides & clamping
        
        // 1. positionX / positionY: Basically 0,0, no modulation
        if (fxName === 'positionX' || fxName === 'positionY') {
          candidateEffects[fxName] = 0;
          candidateModulations[fxName] = {
            enabled: false,
            min: 0,
            max: 0,
            timePct: 50,
            behavior: 'return',
            keyframeEnabled: false,
            keyframes: []
          };
          continue;
        }

        // 2. rotation: Basically 0. Occasionally rotate 1 or 2 turns over export duration.
        if (fxName === 'rotation') {
          const isSpin = Math.random() < 0.15; // 15% chance to rotate
          if (isSpin) {
            const durationVal = parseFloat(this.exportDurationEl.value) || 10;
            const maxFrames = durationVal * 60;
            const turns = Math.random() < 0.5 ? 1 : 2;
            const dir = Math.random() < 0.5 ? 1 : -1;
            const finalRot = 360 * turns * dir;
            candidateEffects['rotation'] = 0;
            candidateModulations['rotation'] = {
              enabled: false,
              min: 0,
              max: 0,
              timePct: 50,
              behavior: 'repeat',
              keyframeEnabled: true,
              keyframes: [
                { frame: 0, value: 0, easing: 'linear' },
                { frame: maxFrames, value: finalRot, easing: 'linear' }
              ]
            };
          } else {
            candidateEffects['rotation'] = 0;
            candidateModulations['rotation'] = {
              enabled: false,
              min: 0,
              max: 0,
              timePct: 50,
              behavior: 'return',
              keyframeEnabled: false,
              keyframes: []
            };
          }
          continue;
        }

        // 3. scale: Minimum 1.0. Move very slowly when animated.
        if (fxName === 'scale') {
          localMin = Math.max(1.0, localMin);
          if (hasScaleIssue || hasNothingVisible) {
            localMin = Math.max(1.2, localMin);
          }
          if (hasAspectBreak && Math.abs(tempRotation) > 5) {
            localMin = Math.max(1.42, localMin); // cover diagonal
          }
          
          let baseVal = layer.effects['scale'] !== undefined ? layer.effects['scale'] : 1.0;
          baseVal = Math.max(localMin, baseVal);
          const goodScaleCentroid = goodEffectCentroid('scale');
          if (goodScaleCentroid !== null && goodAttractionWeight > 0) {
            baseVal = baseVal * (1 - goodAttractionWeight) + goodScaleCentroid * goodAttractionWeight;
          }
          const offset = (Math.random() * 2 - 1) * (range * spread * 0.08); // small mutation offset
          let newVal = baseVal + offset;
          newVal = Math.max(localMin, Math.min(localMax, newVal));
          candidateEffects['scale'] = newVal;

          const mod = layer.modulations['scale'];
          if (mod) {
            const candidateMod = JSON.parse(JSON.stringify(mod));
            candidateMod.jitterBase = newVal;
            if (mod.keyframeEnabled && mod.keyframes && mod.keyframes.length > 0) {
              candidateMod.keyframes.forEach(kf => {
                const kfOffset = (Math.random() * 2 - 1) * (range * spread * 0.05); // slowly move
                let newKfVal = kf.value + kfOffset;
                newKfVal = Math.max(localMin, Math.min(localMax, newKfVal));
                kf.value = newKfVal;
              });
            } else if (mod.enabled) {
              const offsetMin = (Math.random() * 2 - 1) * 0.05;
              const offsetMax = (Math.random() * 2 - 1) * 0.05;
              let newMin = mod.min + offsetMin;
              let newMax = mod.max + offsetMax;
              newMin = Math.max(localMin, Math.min(localMax, newMin));
              newMax = Math.max(localMin, Math.min(localMax, newMax));
              if (Math.abs(newMax - newMin) > 0.4) {
                newMax = newMin + 0.25; // limit variance to prevent large scale breaks
              }
              candidateMod.min = newMin;
              candidateMod.max = newMax;
              candidateMod.timePct = 80 + Math.floor(Math.random() * 20); // very slow (80% - 100%)
            } else {
              candidateMod.min = newVal;
              candidateMod.max = newVal;
            }
            candidateModulations['scale'] = candidateMod;
          } else {
            candidateModulations['scale'] = {
              enabled: false,
              min: newVal,
              max: newVal,
              timePct: 50,
              behavior: 'return',
              keyframeEnabled: false,
              keyframes: []
            };
          }
          continue;
        }

        // 4. strobe: Almost never used (strobe = 0, modulation disabled)
        if (fxName === 'strobe') {
          candidateEffects['strobe'] = 0;
          candidateModulations['strobe'] = {
            enabled: false,
            min: 0,
            max: 0,
            timePct: 50,
            behavior: 'return',
            keyframeEnabled: false,
            keyframes: []
          };
          continue;
        }

        // 5. glowIntensity: Neon Glow - make it highly visible (above 40-50)
        if (fxName === 'glowIntensity') {
          localMin = Math.max(40, localMin);
          if (hasNothingVisible) {
            localMin = Math.max(60, localMin);
          }
          if (hasTooChaotic) {
            localMax = Math.min(80, localMax);
          }
          let baseVal = layer.effects['glowIntensity'] !== undefined ? layer.effects['glowIntensity'] : 65;
          if (baseVal < 40) baseVal = 55 + Math.random() * 25;
          
          const goodGlowCentroid = goodEffectCentroid('glowIntensity');
          if (goodGlowCentroid !== null && goodAttractionWeight > 0) {
            baseVal = baseVal * (1 - goodAttractionWeight) + goodGlowCentroid * goodAttractionWeight;
          }
          
          const offset = (Math.random() * 2 - 1) * (range * spread * 0.15);
          let newVal = baseVal + offset;
          newVal = Math.max(localMin, Math.min(localMax, newVal));
          candidateEffects['glowIntensity'] = newVal;

          const mod = layer.modulations['glowIntensity'];
          if (mod) {
            const candidateMod = JSON.parse(JSON.stringify(mod));
            candidateMod.jitterBase = newVal;
            if (mod.keyframeEnabled && mod.keyframes && mod.keyframes.length > 0) {
              candidateMod.keyframes.forEach(kf => {
                const kfOffset = (Math.random() * 2 - 1) * (range * spread * 0.1);
                let newKfVal = kf.value + kfOffset;
                newKfVal = Math.max(localMin, Math.min(localMax, newKfVal));
                kf.value = newKfVal;
              });
            } else if (mod.enabled) {
              const offsetMin = (Math.random() * 2 - 1) * (range * spread * 0.1);
              const offsetMax = (Math.random() * 2 - 1) * (range * spread * 0.1);
              let newMin = mod.min + offsetMin;
              let newMax = mod.max + offsetMax;
              newMin = Math.max(localMin, Math.min(localMax, newMin));
              newMax = Math.max(localMin, Math.min(localMax, newMax));
              candidateMod.min = newMin;
              candidateMod.max = newMax;
            } else {
              candidateMod.min = newVal;
              candidateMod.max = newVal;
            }
            candidateModulations['glowIntensity'] = candidateMod;
          } else {
            candidateModulations['glowIntensity'] = {
              enabled: false,
              min: newVal,
              max: newVal,
              timePct: 50,
              behavior: 'return',
              keyframeEnabled: false,
              keyframes: []
            };
          }
          continue;
        }

        // 6. feedbackDecay: Motion Trails - highly effective. High value, slow keyframes.
        if (fxName === 'feedbackDecay') {
          localMin = Math.max(0.70, localMin);
          localMax = Math.min(0.92, localMax); // Hard cap 0.92
          if (hasTooChaotic) {
            localMax = Math.min(0.85, localMax);
          }
          
          let baseVal = layer.effects['feedbackDecay'] !== undefined ? layer.effects['feedbackDecay'] : 0.84;
          if (baseVal < 0.70) baseVal = 0.78 + Math.random() * 0.08;
          
          const goodDecayCentroid = goodEffectCentroid('feedbackDecay');
          if (goodDecayCentroid !== null && goodAttractionWeight > 0) {
            baseVal = baseVal * (1 - goodAttractionWeight) + goodDecayCentroid * goodDecayCentroid;
          }
          
          const offset = (Math.random() * 2 - 1) * (range * spread * 0.05); // very small fluctuation
          let newVal = baseVal + offset;
          newVal = Math.max(localMin, Math.min(localMax, newVal));
          candidateEffects['feedbackDecay'] = newVal;

          // 30% chance to auto-enable slow LFO if not modulated, as it creates great random movement elements
          let mod = layer.modulations['feedbackDecay'];
          if (!mod && Math.random() < 0.3) {
            mod = {
              enabled: true,
              min: 0.75,
              max: 0.88,
              timePct: 80 + Math.floor(Math.random() * 20),
              behavior: 'return',
              keyframeEnabled: false,
              keyframes: []
            };
          }

          if (mod) {
            const candidateMod = JSON.parse(JSON.stringify(mod));
            candidateMod.jitterBase = newVal;
            if (mod.keyframeEnabled && mod.keyframes && mod.keyframes.length > 0) {
              candidateMod.keyframes.forEach(kf => {
                const kfOffset = (Math.random() * 2 - 1) * 0.03; // slow changes
                let newKfVal = kf.value + kfOffset;
                newKfVal = Math.max(localMin, Math.min(localMax, newKfVal));
                kf.value = newKfVal;
              });
            } else if (mod.enabled) {
              const offsetMin = (Math.random() * 2 - 1) * 0.02;
              const offsetMax = (Math.random() * 2 - 1) * 0.02;
              let newMin = mod.min + offsetMin;
              let newMax = mod.max + offsetMax;
              newMin = Math.max(localMin, Math.min(localMax, newMin));
              newMax = Math.max(localMin, Math.min(localMax, newMax));
              candidateMod.min = newMin;
              candidateMod.max = newMax;
              candidateMod.timePct = 80 + Math.floor(Math.random() * 20); // slow (80% - 100%)
            } else {
              candidateMod.min = newVal;
              candidateMod.max = newVal;
            }
            candidateModulations['feedbackDecay'] = candidateMod;
          } else {
            candidateModulations['feedbackDecay'] = {
              enabled: false,
              min: newVal,
              max: newVal,
              timePct: 50,
              behavior: 'return',
              keyframeEnabled: false,
              keyframes: []
            };
          }
          continue;
        }

        // 7. feedbackRotate: Trail Spin - effect is extreme, keyframes have almost no effect.
        if (fxName === 'feedbackRotate') {
          // Disable modulations, use constant values (-0.02, -0.01, 0, 0.01, 0.02)
          const spinOpts = [0, -0.015, 0.015, -0.006, 0.006];
          const val = spinOpts[Math.floor(Math.random() * spinOpts.length)];
          candidateEffects['feedbackRotate'] = val;
          candidateModulations['feedbackRotate'] = {
            enabled: false,
            min: val,
            max: val,
            timePct: 50,
            behavior: 'return',
            keyframeEnabled: false,
            keyframes: []
          };
          continue;
        }

        // 8. distortionIntensity: Noise Warp - almost never used, set to 0.
        if (fxName === 'distortionIntensity') {
          candidateEffects['distortionIntensity'] = 0;
          candidateModulations['distortionIntensity'] = {
            enabled: false,
            min: 0,
            max: 0,
            timePct: 50,
            behavior: 'return',
            keyframeEnabled: false,
            keyframes: []
          };
          continue;
        }

        // 9. kaleidoscopeSegment: Kaleidoscope - almost never used, set to 0.
        if (fxName === 'kaleidoscopeSegment') {
          candidateEffects['kaleidoscopeSegment'] = 0;
          candidateModulations['kaleidoscopeSegment'] = {
            enabled: false,
            min: 0,
            max: 0,
            timePct: 50,
            behavior: 'return',
            keyframeEnabled: false,
            keyframes: []
          };
          continue;
        }

        // 10. chromaticOffset: Chromatic Aberration - almost never used, set to 0.
        if (fxName === 'chromaticOffset') {
          candidateEffects['chromaticOffset'] = 0;
          candidateModulations['chromaticOffset'] = {
            enabled: false,
            min: 0,
            max: 0,
            timePct: 50,
            behavior: 'return',
            keyframeEnabled: false,
            keyframes: []
          };
          continue;
        }

        // 11. rotateY / rotateZ: Don't use 3D effects except X rotation
        if (fxName === 'rotateY' || fxName === 'rotateZ') {
          candidateEffects[fxName] = 0;
          candidateModulations[fxName] = {
            enabled: false,
            min: 0,
            max: 0,
            timePct: 50,
            behavior: 'return',
            keyframeEnabled: false,
            keyframes: []
          };
          continue;
        }

        // 12. rotateX: Rotate X - can be used if rotated slowly (30% chance)
        if (fxName === 'rotateX') {
          const isAnimateX = Math.random() < 0.3;
          if (isAnimateX) {
            candidateEffects['rotateX'] = 0;
            candidateModulations['rotateX'] = {
              enabled: true,
              min: -15,
              max: 15,
              timePct: 80 + Math.floor(Math.random() * 20), // slow movement
              behavior: 'return',
              keyframeEnabled: false,
              keyframes: []
            };
          } else {
            candidateEffects['rotateX'] = 0;
            candidateModulations['rotateX'] = {
              enabled: false,
              min: 0,
              max: 0,
              timePct: 50,
              behavior: 'return',
              keyframeEnabled: false,
              keyframes: []
            };
          }
          continue;
        }

        // 13. translateZ: Depth - overlaps with Scale, do not use.
        if (fxName === 'translateZ') {
          candidateEffects['translateZ'] = 0;
          candidateModulations['translateZ'] = {
            enabled: false,
            min: 0,
            max: 0,
            timePct: 50,
            behavior: 'return',
            keyframeEnabled: false,
            keyframes: []
          };
          continue;
        }
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
        ? maxSimilarityAmong(badEvaluations, candidateParams, candidateEffects, genConfigs)
        : 0;
      const maxGoodSimilarity = goodEvaluations.length > 0
        ? maxSimilarityAmong(goodEvaluations, candidateParams, candidateEffects, genConfigs)
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

  async runBatchExport(layer, count, thresholdPct) {
    this.mainApp.pause();

    // 1. Generate variations
    const threshold = thresholdPct / 100;
    const variations = this.generateBatchVariations(layer, count, layer.randomSpread !== undefined ? layer.randomSpread : 50, threshold);

    if (variations.length === 0) {
      alert('Failed to generate any valid variations. Please adjust your criteria or score database.');
      this.mainApp.play();
      return;
    }

    // 2. Hide other layers to render active layer solo
    const originalVisibilities = this.layerManager.layers.map(l => ({
      id: l.id,
      visible: l.visible
    }));

    this.layerManager.layers.forEach(l => {
      l.visible = (l.id === layer.id);
    });

    // Back up original state of the active layer
    const originalState = {
      params: JSON.parse(JSON.stringify(layer.generator.params || {})),
      effects: JSON.parse(JSON.stringify(layer.effects || {})),
      modulations: JSON.parse(JSON.stringify(layer.modulations || {}))
    };

    // Show Progress Overlay
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

      for (let i = 0; i < variations.length; i++) {
        // Apply parameters for current variation
        this.restoreLayerState(layer, variations[i]);
        
        statusEl.textContent = `Batch rendering: ${i + 1}/${variations.length} (0%)`;
        progressEl.value = 0;

        const options = {
          duration: durationVal,
          fps: fpsVal,
          width: w,
          height: h,
          bgMode: 'transparent',
          fadeOutDuration: fadeOutVal,
          filename: `MovieCreator_Batch_${layer.type}_var${i + 1}_${Date.now()}`
        };

        // Export and wait for completion
        await new Promise((resolve, reject) => {
          this.mainApp.recorder.export(
            options,
            (percent) => {
              statusEl.textContent = `Batch rendering: ${i + 1}/${variations.length} (${percent}%)`;
              progressEl.value = percent;
            },
            () => {
              resolve();
            }
          ).catch(err => {
            console.error(`Error exporting variation ${i + 1}:`, err);
            reject(err);
          });
        });

        // Small delay to allow the browser thread to settle and process downloads
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (err) {
      console.error('Batch export failed:', err);
      alert(`Batch export stopped due to error: ${err.message}`);
    } finally {
      // Restore states
      this.restoreLayerState(layer, originalState);
      
      originalVisibilities.forEach(orig => {
        const l = this.layerManager.layers.find(x => x.id === orig.id);
        if (l) l.visible = orig.visible;
      });

      overlay.classList.add('hidden');
      this.rebuildInspector();
      this.mainApp.play();
    }
  }

  generateBatchVariations(layer, count, spreadPct, minSimilarityThreshold) {
    const variations = [];
    
    const originalState = {
      params: JSON.parse(JSON.stringify(layer.generator.params || {})),
      effects: JSON.parse(JSON.stringify(layer.effects || {})),
      modulations: JSON.parse(JSON.stringify(layer.modulations || {}))
    };

    const genConfigs = layer.generator.getParameterConfig();

    for (let i = 0; i < count; i++) {
      let candidateState = null;
      let rerolls = 0;
      const maxRerolls = 20;

      while (rerolls < maxRerolls) {
        this.restoreLayerState(layer, originalState);
        this.randomizeLayer(layer, spreadPct);

        const potentialState = {
          params: JSON.parse(JSON.stringify(layer.generator.params || {})),
          effects: JSON.parse(JSON.stringify(layer.effects || {})),
          modulations: JSON.parse(JSON.stringify(layer.modulations || {}))
        };

        let isTooSimilar = false;
        for (const existing of variations) {
          const sim = this.calculateStatesSimilarity(potentialState, existing, genConfigs);
          if (sim >= minSimilarityThreshold) {
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
        console.warn(`[Batch Generator] Reach max rerolls for variation ${i + 1}. Using last generated candidate.`);
        candidateState = {
          params: JSON.parse(JSON.stringify(layer.generator.params || {})),
          effects: JSON.parse(JSON.stringify(layer.effects || {})),
          modulations: JSON.parse(JSON.stringify(layer.modulations || {}))
        };
      }

      variations.push(candidateState);
    }

    this.restoreLayerState(layer, originalState);
    return variations;
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

  calculateStatesSimilarity(stateA, stateB, genConfigs) {
    let paramDiffSum = 0;
    let paramCount = 0;

    genConfigs.forEach(config => {
      if (config.type === 'range') {
        const absoluteRange = config.max - config.min;
        if (absoluteRange <= 0) return;

        const valA = stateA.params[config.name] !== undefined ? stateA.params[config.name] : config.min + absoluteRange / 2;
        const valB = stateB.params[config.name] !== undefined ? stateB.params[config.name] : config.min + absoluteRange / 2;

        const normA = (valA - config.min) / absoluteRange;
        const normB = (valB - config.min) / absoluteRange;

        paramDiffSum += Math.abs(normA - normB);
        paramCount++;
      }
    });

    for (let fxName in this.fxConfigs) {
      const config = this.fxConfigs[fxName];
      const absoluteRange = config.max - config.min;
      if (absoluteRange <= 0) continue;

      const valA = stateA.effects[fxName] !== undefined ? stateA.effects[fxName] : config.min + absoluteRange / 2;
      const valB = stateB.effects[fxName] !== undefined ? stateB.effects[fxName] : config.min + absoluteRange / 2;

      const normA = (valA - config.min) / absoluteRange;
      const normB = (valB - config.min) / absoluteRange;

      paramDiffSum += Math.abs(normA - normB);
      paramCount++;
    }

    if (paramCount > 0) {
      return 1.0 - (paramDiffSum / paramCount);
    }
    return 1.0;
  }

  rateLayer(layer, scoreType, buttonEl, reasons = []) {
    const payload = {
      layerType: layer.type,
      params: JSON.parse(JSON.stringify(layer.generator.params || {})),
      effects: JSON.parse(JSON.stringify(layer.effects || {})),
      modulations: {},
      reasons: reasons
    };

    for (let pName in layer.modulations) {
      const mod = layer.modulations[pName];
      payload.modulations[pName] = {
        keyframeEnabled: mod.keyframeEnabled,
        keyframes: JSON.parse(JSON.stringify(mod.keyframes || [])),
        lfoEnabled: mod.lfoEnabled,
        lfoType: mod.lfoType,
        lfoRate: mod.lfoRate,
        lfoAmount: mod.lfoAmount
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

        const scoreLabel = scoreType === 'good' ? 'Good! 👍' : 'Bad! 👎';
        this.showToast(`Saved score: ${scoreLabel}`, 'success');

        if (scoreType === 'good') {
          buttonEl.style.background = '#065f46';
          buttonEl.style.borderColor = '#10b981';
          buttonEl.style.boxShadow = '0 0 12px #10b981';
        } else {
          buttonEl.style.background = '#7f1d1d';
          buttonEl.style.borderColor = '#ef4444';
          buttonEl.style.boxShadow = '0 0 12px #ef4444';
        }

        setTimeout(() => {
          buttonEl.style.background = '';
          buttonEl.style.borderColor = '';
          buttonEl.style.boxShadow = '';
        }, 1000);
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

  showBadScoreDialog() {
    return new Promise((resolve) => {
      const overlay = this.createElement('div');
      overlay.style.cssText = `
        position: fixed; inset: 0; z-index: 9999;
        background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
        display: flex; align-items: center; justify-content: center;
      `;

      const reasons = [
        { id: 'strobe_excess', text: 'strobe_excess : ストロボ過多 (チカチカしすぎる)' },
        { id: 'scale_too_small', text: 'scale_too_small : スケールが小さすぎる (こじんまり)' },
        { id: 'scale_too_large', text: 'scale_too_large : 全体カバー不足 (もっと全体に広げたい)' },
        { id: 'aspect_break', text: 'aspect_break : 回転によるアスペクト破綻 (画面端の黒い隙間)' },
        { id: 'too_simple', text: 'too_simple : シンプルすぎる (スカスカ・地味)' },
        { id: 'too_chaotic', text: 'too_chaotic : 過剰演出すぎる (光すぎ・残像過多・白飛び)' },
        { id: 'noise_warp_excess', text: 'noise_warp_excess : ノイズワープ過多 (歪みすぎ)' },
        { id: 'nothing_visible', text: 'nothing_visible : 何も映っていない (真っ暗・見えない)' }
      ];

      const checkboxesHtml = reasons.map(r => `
        <label style="display: flex; align-items: center; gap: 0.5rem; color: #9ca3af; font-size: 0.85rem; cursor: pointer; user-select: none; margin-bottom: 0.2rem;">
          <input type="checkbox" name="bad-reason" value="${r.id}" style="
            accent-color: #ef4444; cursor: pointer; width: 15px; height: 15px;
          ">
          <span>${r.text}</span>
        </label>
      `).join('');

      overlay.innerHTML = `
        <div style="
          background: #1a1a2e; border: 1px solid #ef4444;
          border-radius: 12px; padding: 1.5rem 2rem; min-width: 420px;
          box-shadow: 0 0 30px rgba(239,68,68,0.4);
          display: flex; flex-direction: column; gap: 1rem;
        ">
          <h3 style="margin: 0; font-size: 1.05rem; color: #e2e8f0; font-weight: 700;">Rate Bad Parameters</h3>
          <p style="margin: 0; font-size: 0.85rem; color: #9ca3af; line-height: 1.4; white-space: normal; text-align: left;">
            Select negative reasons for this generation:
          </p>
          <div style="display: flex; flex-direction: column; gap: 0.6rem; text-align: left; padding: 0.5rem 0;">
            ${checkboxesHtml}
          </div>
          <div style="display: flex; gap: 0.75rem; justify-content: flex-end;">
            <button id="bad-dialog-cancel" style="
              padding: 0.4rem 1rem; border-radius: 6px; border: 1px solid #4b5563;
              background: transparent; color: #9ca3af; cursor: pointer; font-size: 0.85rem;
            ">Cancel</button>
            <button id="bad-dialog-submit" style="
              padding: 0.4rem 1.2rem; border-radius: 6px; border: none;
              background: #ef4444; color: white; cursor: pointer; font-size: 0.85rem; font-weight: 600;
              box-shadow: 0 0 10px rgba(239,68,68,0.5);
            ">Submit Bad Score</button>
          </div>
        </div>
      `;

      (this.activeDocument || document).body.appendChild(overlay);

      const btnSubmit = overlay.querySelector('#bad-dialog-submit');
      const btnCancel = overlay.querySelector('#bad-dialog-cancel');

      const finish = (selectedReasons) => {
        (this.activeDocument || document).body.removeChild(overlay);
        resolve(selectedReasons);
      };

      btnSubmit.addEventListener('click', () => {
        const checked = Array.from(overlay.querySelectorAll('input[name="bad-reason"]:checked')).map(el => el.value);
        finish(checked);
      });

      btnCancel.addEventListener('click', () => finish(null));

      const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
          window.removeEventListener('keydown', handleKeyDown);
          finish(null);
        }
      };
      window.addEventListener('keydown', handleKeyDown);
    });
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
      nothing_visible: 0
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
      { id: 'nothing_visible', name: '何も映っていない (nothing_visible)', desc: '数量・サイズ・輝度下限引き上げ、Glow下限 15.0、Scale下限 0.8' }
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
