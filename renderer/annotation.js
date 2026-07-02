const canvas = document.getElementById('annotationCanvas');
const ctx = canvas.getContext('2d');

let isDrawing = false;
let currentMode = 'none'; // 'none', 'pen', 'highlighter'
let isSpotlightActive = false;
let mousePos = { x: 0, y: 0 };
let currentLine = null;
let lines = []; // array of { mode, points }

// Configure Canvas dimensions
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  draw();
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Draw everything on the canvas
function draw() {
  // 1. Clear previous frame
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // 2. Draw Spotlight Focus Layer
  if (isSpotlightActive) {
    ctx.save();
    // Fill entire screen with dark overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Clear circle around cursor
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(mousePos.x, mousePos.y, 110, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    
    // Draw subtle border around cutout to separate it
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(mousePos.x, mousePos.y, 110, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // 3. Draw All Annotation Lines
  lines.forEach(line => {
    if (line.points.length < 2) return;
    
    ctx.save();
    if (line.mode === 'pen') {
      ctx.strokeStyle = '#ef4444'; // Red
      ctx.lineWidth = 4;
      ctx.globalAlpha = 1.0;
    } else if (line.mode === 'highlighter') {
      ctx.strokeStyle = 'rgba(253, 224, 71, 0.35)'; // Semi-transparent Yellow
      ctx.lineWidth = 18;
      ctx.globalAlpha = 1.0;
    }
    
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    ctx.beginPath();
    ctx.moveTo(line.points[0].x, line.points[0].y);
    
    for (let i = 1; i < line.points.length; i++) {
      ctx.lineTo(line.points[i].x, line.points[i].y);
    }
    
    ctx.stroke();
    ctx.restore();
  });
}

// -------------------------------------------------------------
// Mouse Handlers
// -------------------------------------------------------------
canvas.addEventListener('mousedown', (e) => {
  if (currentMode === 'none') return;
  
  isDrawing = true;
  mousePos = { x: e.clientX, y: e.clientY };
  
  currentLine = {
    mode: currentMode,
    points: [{ x: mousePos.x, y: mousePos.y }]
  };
  lines.push(currentLine);
});

canvas.addEventListener('mousemove', (e) => {
  mousePos = { x: e.clientX, y: e.clientY };
  
  if (isDrawing && currentMode !== 'none' && currentLine) {
    currentLine.points.push({ x: mousePos.x, y: mousePos.y });
  }
  
  draw();
});

canvas.addEventListener('mouseup', () => {
  isDrawing = false;
  currentLine = null;
});

canvas.addEventListener('mouseleave', () => {
  isDrawing = false;
  currentLine = null;
});

// -------------------------------------------------------------
// IPC Command Listener
// -------------------------------------------------------------
window.electronAPI.onAnnotationCommand((cmd) => {
  switch (cmd.type) {
    case 'MODE':
      currentMode = cmd.mode;
      canvas.className = `mode-${cmd.mode}`;
      break;
      
    case 'SPOTLIGHT':
      isSpotlightActive = cmd.active;
      draw();
      break;
      
    case 'CLEAR':
      lines = [];
      draw();
      break;
  }
});
