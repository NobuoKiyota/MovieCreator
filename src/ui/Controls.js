/**
 * Controls.js - Refactored to Unity-style Hierarchy & Inspector Panel.
 * Left/Middle: Preview & Render Canvas
 * Right Upper: Layers Hierarchy List (Simple rows: reorder, delete, visibility, active toggle)
 * Right Lower: Inspector Panel (Detailed parameter tuning & LFO settings for the ACTIVE layer only)
 */
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
    this.masterFadeOutEl = document.getElementById('master-fade-out');

    // Project Save/Load elements (API based)
    this.currentProjectFile = null;
    this.projectSelectEl = document.getElementById('project-select');
    this.btnApiLoadProjectEl = document.getElementById('btn-api-load-project');
    this.btnApiSaveProjectEl = document.getElementById('btn-api-save-project');
    this.btnApiSaveProjectQuickEl = document.getElementById('btn-api-save-project-quick');
    this.btnProjectNewEl = document.getElementById('btn-project-new');

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

    // Common FX Configs supporting LFO modulation
    this.fxConfigs = {
      rotation:            { name: 'rotation',            label: 'Rotation',      min: -360,  max: 360,  step: 1,     type: 'range' },
      scale:               { name: 'scale',               label: 'Scale',         min: 0.1,   max: 5.0,  step: 0.05,  type: 'range' },
      strobe:              { name: 'strobe',              label: 'Strobe Speed',  min: 0,     max: 30,   step: 0.5,   type: 'range' },
      glowIntensity:       { name: 'glowIntensity',       label: 'Neon Glow',     min: 0,     max: 50,   step: 1,     type: 'range' },
      feedbackDecay:       { name: 'feedbackDecay',       label: 'Motion Trails', min: 0.0,   max: 0.95, step: 0.01,  type: 'range' },
      feedbackRotate:      { name: 'feedbackRotate',      label: 'Trail Spin',    min: -0.05, max: 0.05, step: 0.001, type: 'range' },
      distortionIntensity: { name: 'distortionIntensity', label: 'Noise Warp',    min: 0,     max: 40,   step: 1,     type: 'range' }
    };
    this.activeDocument = document;
  }

  createElement(tagName) {
    return (this.activeDocument || document).createElement(tagName);
  }

  init() {
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
      const options = {
        duration: parseFloat(this.exportDurationEl.value) || 10,
        fps: 60,
        bgMode: this.exportBgEl.value,
        fadeOutDuration: parseFloat(this.masterFadeOutEl.value) || 2.0
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
    this.rebuildLayersList();
    this.rebuildInspector();
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
    `;

    const spreadSlider = randomizerHeader.querySelector('.random-spread-slider');
    const spreadDisplay = randomizerHeader.querySelector('.spread-val-display');
    const btnRandom = randomizerHeader.querySelector('.btn-randomize');

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

    this.inspectorContentEl.appendChild(randomizerHeader);

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

      const mainField = this.createElement('div');
      mainField.className = 'layer-field';
      
      const currentVal = isFx ? layer.effects[config.name] : layer.generator.params[config.name];
      let displayVal = currentVal;
      if (typeof displayVal === 'number') {
        displayVal = displayVal % 1 === 0 ? displayVal.toString() : displayVal.toFixed(4);
      }

      mainField.innerHTML = `
        <div class="layer-field-header">
          <label>${config.label}</label>
          <span class="val-display">${displayVal}</span>
          <button class="btn-modulation-toggle" ${modActiveGlow} title="Toggle Automation">🧬</button>
        </div>
        <input type="range" class="param-slider" min="${config.min}" max="${config.max}" step="${config.step}" value="${currentVal}">
      `;

      const rangeInput = mainField.querySelector('.param-slider');
      const valDisplay = mainField.querySelector('.val-display');
      const btnModToggle = mainField.querySelector('.btn-modulation-toggle');

      rangeInput.addEventListener('input', (e) => {
        const v = parseFloat(e.target.value);
        valDisplay.textContent = v % 1 === 0 ? v.toString() : v.toFixed(4);
        onValUpdate(v);
        
        if (mod && !mod.enabled) {
          mod.min = v;
          mod.max = v;
        }
        this.mainApp.renderSingleFrame();
      });

      btnModToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        mod.enabled = !mod.enabled;
        
        const modKey = `${layer.id}-${config.name}`;
        if (mod.enabled) {
          this.expandedMods.add(modKey);
          btnModToggle.style.color = 'var(--color-accent)';
          btnModToggle.style.textShadow = '0 0 8px var(--color-accent)';
        } else {
          this.expandedMods.delete(modKey);
          btnModToggle.style.color = '';
          btnModToggle.style.textShadow = '';
        }
        this.rebuildInspector(); // Redraw parameter structure
        this.mainApp.renderSingleFrame();
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

  createStaticFXField(fxName, label, min, max, step, val, onChange) {
    const field = this.createElement('div');
    field.className = 'layer-field';
    field.dataset.staticFx = fxName;
    
    let displayVal = val;
    if (typeof val === 'number') {
      displayVal = val % 1 === 0 ? val.toString() : val.toFixed(2);
    }

    field.innerHTML = `
      <label>${label}</label>
      <input type="range" min="${min}" max="${max}" step="${step}" value="${val}">
      <span class="val-display">${displayVal}</span>
      <div style="width: 30px;"></div>
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
   * Randomizes the inspected layer.
   * Decide center first, then determine automation bounds under current Spread percentage.
   */
  randomizeLayer(layer, spreadPct) {
    const spread = spreadPct / 100;

    // 1. Generator Parameters
    const genConfigs = layer.generator.getParameterConfig();
    genConfigs.forEach(config => {
      if (config.type === 'range') {
        const absoluteRange = config.max - config.min;
        const currentVal = layer.generator.params[config.name];
        
        const maxOffset = absoluteRange * spread;
        let center = currentVal + (Math.random() * 2 - 1) * (maxOffset / 2);
        center = Math.max(config.min, Math.min(config.max, center));

        const mod = layer.modulations[config.name];
        if (mod) {
          if (mod.enabled) {
            const lfoRange = Math.random() * maxOffset;
            mod.min = Math.max(config.min, center - lfoRange / 2);
            mod.max = Math.min(config.max, center + lfoRange / 2);
          } else {
            layer.generator.params[config.name] = center;
            mod.min = center;
            mod.max = center;
          }
        }
      } else if (config.type === 'color') {
        const h = Math.floor(Math.random() * 360);
        const s = 85 + Math.floor(Math.random() * 15);
        const l = 45 + Math.floor(Math.random() * 15);
        layer.generator.params[config.name] = this.hslToHex(h, s, l);
      }
    });

    // 2. Common FX parameters (including Motion Trails / Trail Spin / Noise Warp)
    for (let fxName in this.fxConfigs) {
      const config = this.fxConfigs[fxName];
      const absoluteRange = config.max - config.min;
      const currentVal = layer.effects[fxName];

      const maxOffset = absoluteRange * spread;
      let center = currentVal + (Math.random() * 2 - 1) * (maxOffset / 2);
      center = Math.max(config.min, Math.min(config.max, center));

      // feedbackDecay のホワイトアウト防止クランプ
      if (fxName === 'feedbackDecay') {
        center = Math.min(0.92, center);
      }

      const mod = layer.modulations[fxName];
      if (mod) {
        if (mod.enabled) {
          const lfoRange = Math.random() * maxOffset;
          mod.min = Math.max(config.min, center - lfoRange / 2);
          mod.max = Math.min(config.max, center + lfoRange / 2);
          // feedbackDecay LFO max もクランプ
          if (fxName === 'feedbackDecay') {
            mod.max = Math.min(0.92, mod.max);
          }
        } else {
          layer.effects[fxName] = center;
          mod.min = center;
          mod.max = center;
        }
      } else {
        // modulation未初期化の場合も値のみ更新（後方互換）
        layer.effects[fxName] = center;
      }
    }
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
        fadeOut: parseFloat(this.masterFadeOutEl.value) || 2.0,
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
        this.masterFadeOutEl.value = data.master.fadeOut !== undefined ? data.master.fadeOut : 2.0;
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
          newLayer.modulations = { ...newLayer.modulations, ...layerData.modulations };
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
        fadeOut: parseFloat(this.masterFadeOutEl.value) || 2.0,
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
        fadeOut: parseFloat(this.masterFadeOutEl.value) || 2.0,
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
          this.masterFadeOutEl.value = data.master.fadeOut !== undefined ? data.master.fadeOut : 2.0;
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
            newLayer.modulations = { ...newLayer.modulations, ...layerData.modulations };
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
        fadeOut: parseFloat(this.masterFadeOutEl.value) || 2.0,
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
        newLayer.modulations = { ...newLayer.modulations, ...lData.modulations };
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
      alert('Popup blocker prevented opening the inspector window. Please allow popups for this site.');
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
    if (this.popupWindow && !this.popupWindow.closed) {
      this.popupWindow.close();
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
