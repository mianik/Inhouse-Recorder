const timerEl = document.getElementById('timer');
const statusDot = document.getElementById('statusDot');
const canvas = document.getElementById('audioVisualizer');
const canvasCtx = canvas.getContext('2d');

const pauseBtn = document.getElementById('pauseBtn');
const stopBtn = document.getElementById('stopBtn');
const micBtn = document.getElementById('micBtn');
const cancelBtn = document.getElementById('cancelBtn');

// New Presentation tool elements
const penBtn = document.getElementById('penBtn');
const highlighterBtn = document.getElementById('highlighterBtn');
const spotlightBtn = document.getElementById('spotlightBtn');
const clearBtn = document.getElementById('clearBtn');
const screenshotBtn = document.getElementById('screenshotBtn');

const pauseIcon = document.getElementById('pauseIcon');
const playIcon = document.getElementById('playIcon');
const micOnIcon = document.getElementById('micOnIcon');
const micOffIcon = document.getElementById('micOffIcon');

let seconds = 0;
let timerInterval = null;
let isPaused = false;
let isMicMuted = false;
let audioContext = null;
let analyser = null;
let microphoneStream = null;
let drawVisual = null;

// Presentation State
let activeTool = 'none'; // 'none', 'pen', 'highlighter'
let isSpotlightOn = false;

// Timer functions
function startTimer() {
  stopTimer();
  timerInterval = setInterval(() => {
    seconds++;
    const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
    const secs = String(seconds % 60).padStart(2, '0');
    timerEl.textContent = `${mins}:${secs}`;
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

// Setup Mic Visualizer
async function initVisualizer() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    microphoneStream = stream;
    
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);
    
    source.connect(analyser);
    analyser.fftSize = 32;
    
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    function draw() {
      drawVisual = requestAnimationFrame(draw);
      
      analyser.getByteFrequencyData(dataArray);
      
      canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
      
      const barWidth = (canvas.width / bufferLength) * 1.5;
      let barHeight;
      let x = 0;
      
      for(let i = 0; i < bufferLength; i++) {
        barHeight = isMicMuted ? 2 : (dataArray[i] / 255) * canvas.height;
        if (barHeight < 2) barHeight = 2;
        
        canvasCtx.fillStyle = isMicMuted ? 'rgba(255,255,255,0.2)' : 'rgba(99, 102, 241, 0.85)';
        canvasCtx.fillRect(x, canvas.height - barHeight, barWidth - 2, barHeight);
        
        x += barWidth;
      }
    }
    
    draw();
  } catch (err) {
    console.error('Error starting visualizer:', err);
    drawFallbackVisualizer();
  }
}

function drawFallbackVisualizer() {
  canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
  canvasCtx.fillStyle = 'rgba(255, 255, 255, 0.2)';
  for (let i = 0; i < 5; i++) {
    canvasCtx.fillRect(i * 10, canvas.height - 2, 8, 2);
  }
}

// -------------------------------------------------------------
// Button Action Listeners
// -------------------------------------------------------------

pauseBtn.addEventListener('click', () => {
  isPaused = !isPaused;
  if (isPaused) {
    stopTimer();
    statusDot.className = 'status-dot paused';
    pauseIcon.classList.add('hidden');
    playIcon.classList.remove('hidden');
    pauseBtn.title = 'Resume Recording';
    window.electronAPI.pauseRecording();
  } else {
    startTimer();
    statusDot.className = 'status-dot recording';
    playIcon.classList.add('hidden');
    pauseIcon.classList.remove('hidden');
    pauseBtn.title = 'Pause Recording';
    window.electronAPI.resumeRecording();
  }
});

stopBtn.addEventListener('click', () => {
  stopTimer();
  deactivateAllTools();
  window.electronAPI.stopRecording();
});

cancelBtn.addEventListener('click', () => {
  stopTimer();
  deactivateAllTools();
  window.electronAPI.cancelRecording();
});

micBtn.addEventListener('click', () => {
  isMicMuted = !isMicMuted;
  if (isMicMuted) {
    micOnIcon.classList.add('hidden');
    micOffIcon.classList.remove('hidden');
    micBtn.title = 'Unmute Mic';
    micBtn.classList.add('active');
  } else {
    micOffIcon.classList.add('hidden');
    micOnIcon.classList.remove('hidden');
    micBtn.title = 'Mute Mic';
    micBtn.classList.remove('active');
  }
  if (window.electronAPI.toggleMic) {
    window.electronAPI.toggleMic(isMicMuted);
  }
});

// Presentation Tool Handlers
penBtn.addEventListener('click', () => {
  toggleTool('pen');
});

highlighterBtn.addEventListener('click', () => {
  toggleTool('highlighter');
});

spotlightBtn.addEventListener('click', () => {
  isSpotlightOn = !isSpotlightOn;
  spotlightBtn.classList.toggle('active', isSpotlightOn);
  window.electronAPI.setSpotlightMode(isSpotlightOn);
});

clearBtn.addEventListener('click', () => {
  window.electronAPI.clearAnnotations();
});

screenshotBtn.addEventListener('click', () => {
  window.electronAPI.captureScreenshot();
});

function toggleTool(tool) {
  if (activeTool === tool) {
    // Turn off
    activeTool = 'none';
    penBtn.classList.remove('active');
    highlighterBtn.classList.remove('active');
    window.electronAPI.setAnnotationMode('none');
  } else {
    // Turn on
    activeTool = tool;
    penBtn.classList.toggle('active', tool === 'pen');
    highlighterBtn.classList.toggle('active', tool === 'highlighter');
    window.electronAPI.setAnnotationMode(tool);
  }
}

function deactivateAllTools() {
  activeTool = 'none';
  isSpotlightOn = false;
  penBtn.classList.remove('active');
  highlighterBtn.classList.remove('active');
  spotlightBtn.classList.remove('active');
  window.electronAPI.setAnnotationMode('none');
  window.electronAPI.setSpotlightMode(false);
  window.electronAPI.clearAnnotations();
}

// Global ESC hotkey to clear/deactivate everything
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    deactivateAllTools();
  }
});

// Sync state if changed externally
if (window.electronAPI.onControlsStateChange) {
  window.electronAPI.onControlsStateChange((state) => {
    if (state.action === 'RECORDING') {
      startTimer();
    } else if (state.action === 'PAUSE' && !isPaused) {
      pauseBtn.click();
    } else if (state.action === 'RESUME' && isPaused) {
      pauseBtn.click();
    }
  });
}

// Clean up
window.addEventListener('beforeunload', () => {
  stopTimer();
  deactivateAllTools();
  cancelAnimationFrame(drawVisual);
  if (microphoneStream) {
    microphoneStream.getTracks().forEach(track => track.stop());
  }
  if (audioContext) {
    audioContext.close();
  }
});

// Initialize
// Note: Timer will start when the 'RECORDING' event is received after the countdown
initVisualizer();
