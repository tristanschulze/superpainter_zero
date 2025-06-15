// ------------------------- PIXI SETUP -------------------------
const app = new PIXI.Application({
  width: 768,
  height: 768,
  backgroundColor: 0xffffff,
  resolution: window.devicePixelRatio || 1,
  autoDensity: true,
  resizeTo: null
});
document.body.appendChild(app.view);

const defaultPaletteColors = [
  '#000000', //black
  '#FF7F0E', // orange (complement to blue)
  '#2CA02C', // green
  '#D62728', // red (complement to green)
  '#9467BD', // purple
  '#8C564B', // brown
  '#E377C2', // pink
  '#7F7F7F', // medium gray
  '#BCBD22', // lime
  '#17BECF', // cyan

  '#003F5C', // dark navy
  '#58508D', // muted violet
  '#FF6361', // coral
  '#FFA600', // amber
  '#A05195', // deep purple
  '#665191', // indigo
  '#2E8B57', // sea green
  '#FFD700', // gold
  '#00CED1', // dark turquoise
  '#FFFFFF'  // white
];

// ---------------------- RENDER TEXTURE ------------------------
let renderTexture = PIXI.RenderTexture.create({ width: app.view.width, height: app.view.height });
let renderSprite = new PIXI.Sprite(renderTexture);
app.stage.addChild(renderSprite);

// Fill texture initially with white
const whiteBackground = new PIXI.Graphics()
  .beginFill(0xFFFFFF)
  .drawRect(0, 0, app.view.width, app.view.height)
  .endFill();
app.renderer.render(whiteBackground, { renderTexture });
whiteBackground.destroy();

// ------------------- GRADIENT TEXTURE CACHE -------------------
const gradientTextureCache = new Map();

/**
 * Get a cached radial gradient texture or generate one.
 */
function getRadialGradientTexture(color, radius, alpha) {
  const key = `${color}_${radius}_${alpha.toFixed(2)}`;
  if (gradientTextureCache.has(key)) return gradientTextureCache.get(key);
  const texture = createRadialGradientTexture(color, radius, alpha);
  gradientTextureCache.set(key, texture);
  return texture;
}

/**
 * Create a radial gradient texture as a canvas and convert to PIXI texture.
 */
function createRadialGradientTexture(color, radius, alpha) {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  const size = radius * 2;
  c.width = size;
  c.height = size;

  function hexToRGBA(hex, alpha) {
    hex = hex.replace('#', '');
    let r, g, b;
    if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    } else {
      r = parseInt(hex.substr(0, 2), 16);
      g = parseInt(hex.substr(2, 2), 16);
      b = parseInt(hex.substr(4, 2), 16);
    }
    return `rgba(${r},${g},${b},${alpha})`;
  }

  const grad = ctx.createRadialGradient(radius, radius, 0, radius, radius, radius);
  grad.addColorStop(0, hexToRGBA(color, alpha));
  grad.addColorStop(1, hexToRGBA(color, 0));

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(radius, radius, radius, 0, Math.PI * 2);
  ctx.fill();

  return PIXI.Texture.from(c);
}

/**
 * Apply a spray effect at a given position.
 */
function spray(x, y, color, size, alpha) {
  const gradientTexture = getRadialGradientTexture(color, size, alpha);
  const sprite = new PIXI.Sprite(gradientTexture);
  sprite.x = x - size;
  sprite.y = y - size;
  sprite.alpha = 1;
  app.renderer.render(sprite, { renderTexture, clear: false });
  sprite.destroy();
}

/**
 * Linear interpolation between two values.
 */
function lerp(a, b, t) {
  return a + (b - a) * t;
}

// --------------------------- UI BINDINGS ---------------------------
const colorPicker = document.getElementById('colorPicker');
const brushSizeSlider = document.getElementById('brushSize');
const alphaSlider = document.getElementById('alphaSlider');
const alphaLabel = document.getElementById('alphaLabel');
const paletteDiv = document.getElementById('palette');

alphaSlider.oninput = () => {
  alphaLabel.textContent = `Spray alpha: ${parseFloat(alphaSlider.value).toFixed(2)}`;
};

let isDrawing = false;
let lastPos = null;

/**
 * Interpolate between last and current pointer position for smooth drawing.
 */
function handleDrawing(currentPos) {
  if (!lastPos) {
    spray(currentPos.x, currentPos.y, colorPicker.value, brushSizeSlider.value, parseFloat(alphaSlider.value));
    lastPos = currentPos;
    return;
  }
  const dx = currentPos.x - lastPos.x;
  const dy = currentPos.y - lastPos.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  const maxSteps = 7;
  const stepDist = brushSizeSlider.value / 3;
  let steps = Math.floor(dist / stepDist);
  steps = Math.min(maxSteps, steps);
  if (steps < 1) steps = 1;

  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    const ix = lerp(lastPos.x, currentPos.x, t);
    const iy = lerp(lastPos.y, currentPos.y, t);
    spray(ix, iy, colorPicker.value, brushSizeSlider.value, parseFloat(alphaSlider.value));
  }

  lastPos = currentPos;
}

// ------------------------ POINTER EVENTS ------------------------
app.view.addEventListener('pointerdown', e => {
  if (e.button === 2) return;
  isDrawing = true;
  const rect = app.view.getBoundingClientRect();
  lastPos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  handleDrawing(lastPos);
});

app.view.addEventListener('pointerup', () => {
  isDrawing = false;
  lastPos = null;
});

app.view.addEventListener('pointermove', (e) => {
  const rect = app.view.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  // Remove or comment out brushPreview code if undefined
  // brushPreview.position.set(x, y);
  if (!isDrawing) return;
  handleDrawing({ x, y });
});

app.view.addEventListener('pointerleave', () => {
  isDrawing = false;
  lastPos = null;
});

// ------------------------ RIGHT CLICK PICKER ------------------------
app.view.addEventListener('contextmenu', async (e) => {
  e.preventDefault();
  const rect = app.view.getBoundingClientRect();
  const x = Math.round((e.clientX - rect.left) * (app.view.width / rect.width));
  const y = Math.round((e.clientY - rect.top) * (app.view.height / rect.height));

  try {
    const tempTexture = PIXI.RenderTexture.create({ width: app.renderer.width, height: app.renderer.height });
    app.renderer.render(app.stage, { renderTexture: tempTexture });
    const pixels = app.renderer.extract.pixels(tempTexture);
    const pixelOffset = (y * tempTexture.width + x) * 4;
    const r = pixels[pixelOffset];
    const g = pixels[pixelOffset + 1];
    const b = pixels[pixelOffset + 2];
    const a = pixels[pixelOffset + 3];
    if (a > 0) {
      const hexColor = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
      colorPicker.value = hexColor;
      updateSelectedPalette();
    }
    tempTexture.destroy(true);
  } catch (error) {
    console.error("Color pick error:", error);
  }
});

// --------------------------- PALETTE ---------------------------
const savedColorsKey = 'pixi_spray_palette_colors';

function loadPalette() {
  const stored = localStorage.getItem(savedColorsKey);
  try {
    const parsed = JSON.parse(stored);
    return (Array.isArray(parsed) && parsed.length) ? parsed : [...defaultPaletteColors];
  } catch {
    return [...defaultPaletteColors];
  }
}

function savePalette(colors) {
  localStorage.setItem(savedColorsKey, JSON.stringify(colors));
}

function addColorToPalette(color) {
  if (!paletteColors.includes(color)) {
    paletteColors.push(color);
    savePalette(paletteColors);
    renderPalette();
  }
}

function renderPalette() {
  paletteDiv.innerHTML = '';
  paletteColors.forEach(color => {
    const div = document.createElement('div');
    div.className = 'palette-color';
    div.style.backgroundColor = color;
    if (color === colorPicker.value) div.classList.add('selected');
    div.title = color;
    div.addEventListener('click', () => {
      colorPicker.value = color;
      updateSelectedPalette();
    });
    paletteDiv.appendChild(div);
  });
}

function updateSelectedPalette() {
  const items = paletteDiv.querySelectorAll('.palette-color');
  items.forEach(div => {
    if (div.style.backgroundColor === colorPicker.value) div.classList.add('selected');
    else div.classList.remove('selected');
  });
}

let paletteColors = loadPalette();
renderPalette();

window.addEventListener('keydown', e => {
  if (e.key.toLowerCase() === 'p') addColorToPalette(colorPicker.value);
});

colorPicker.addEventListener('input', updateSelectedPalette);

// ------------------------ EXPORT FUNCTION ------------------------
    function extractRegion(renderer, x, y, width, height) {
    const sourceCanvas = renderer.extract.canvas();
    const sourceContext = sourceCanvas.getContext('2d');
    const extractCanvas = document.createElement('canvas');
    const extractContext = extractCanvas.getContext('2d');
    
    extractCanvas.width = width;
    extractCanvas.height = height;
    
    // Sicherstellen, dass die Koordinaten innerhalb des Canvas liegen
    const safeX = Math.max(0, Math.min(x, sourceCanvas.width - width));
    const safeY = Math.max(0, Math.min(y, sourceCanvas.height - height));
    const safeWidth = Math.min(width, sourceCanvas.width - safeX);
    const safeHeight = Math.min(height, sourceCanvas.height - safeY);
    
    const imageData = sourceContext.getImageData(safeX, safeY, safeWidth, safeHeight);
    extractContext.putImageData(imageData, 0, 0);
    
    return extractCanvas.toDataURL('image/jpeg');
}
    
    
document.getElementById('exportBtn').addEventListener('click', async () => {
    // Temporär das Rendering anhalten
    app.stop();
    
    try {
        // Die gesamte Szene als Base64 exportieren
        const url = await app.renderer.extract.base64(renderSprite);
        
        // Download-Link erstellen
        const link = document.createElement('a');
        link.download = 'spray-paint-' + new Date().toISOString().slice(0, 10) + '.jpg';
        link.href = url;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (error) {
        console.error('Export failed:', error);
    } finally {
        // Rendering wieder starten
        app.start();
    }
});
    


    // Bild-Upload Funktion
document.getElementById('uploadBtn').addEventListener('click', () => {
    document.getElementById('fileInput').click();
});

document.getElementById('fileInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
        // Erstelle Textur aus hochgeladenem Bild
        PIXI.Texture.fromURL(event.target.result).then((texture) => {
            // Erstelle Sprite und passe es an Canvas-Größe an
            const bgSprite = new PIXI.Sprite(texture);
            
            // Skalierung berechnen um den Canvas vollständig zu füllen
            const scaleX = app.view.width / bgSprite.width;
            const scaleY = app.view.height / bgSprite.height;
            const scale = Math.max(scaleX, scaleY);
            
            bgSprite.width = bgSprite.width * scale;
            bgSprite.height = bgSprite.height * scale;
            
            // Zentrieren falls nötig
            bgSprite.x = (app.view.width - bgSprite.width) / 2;
            bgSprite.y = (app.view.height - bgSprite.height) / 2;
            
            // Alte RenderTexture ersetzen
            renderTexture.destroy(true);
            renderTexture = PIXI.RenderTexture.create({
                width: app.view.width,
                height: app.view.height
            });
            
            // Neuen Hintergrund rendern
            app.renderer.render(bgSprite, { renderTexture });
            
            // RenderSprite aktualisieren
            renderSprite.texture = renderTexture;
            
            bgSprite.destroy(true);
        });
    };
    reader.readAsDataURL(file);
});
    
    
    // -------------------------------------------------
