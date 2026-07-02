const timerEl = document.getElementById('timer');
const statusDot = document.getElementById('statusDot');
const canvas = document.getElementById('audioVisualizer');
const canvasCtx = canvas.getContext('2d');

const pauseBtn = document.getElementById('pauseBtn');
const stopBtn = document.getElementById('stopBtn');
const micBtn = document.getElementById('micBtn');
const camBtn = document.getElementById('camBtn');
const cancelBtn = document.getElementById('cancelBtn');

const pauseIcon = document.getElementById('pauseIcon');
const playIcon = document.getElementById('playIcon');
const micOnIcon = document.getElementById('micOnIcon');
const micOffIcon = document.getElementById('micOffIcon');
const camOnIcon = document.getElementById('camOnIcon');
const camOffIcon = document.getElementById('camOffIcon');

let seconds = 0;
let timerInterval = null;
let isPaused = false;
let isMicMuted = false;
let isCamActive = true;
let audioContext = null;
let analyser = null;
let microphoneStream = null;
let javascriptNode = null;
let drawVisual = null;

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
        // If mic is muted, draw flat line
        barHeight = isMicMuted ? 2 : (dataArray[i] / 255) * canvas.height;
        if (barHeight < 2) barHeight = 2; // draw a small dot/line even if quiet
        
        canvasCtx.fillStyle = isMicMuted ? 'rgba(255,255,255,0.2)' : 'rgba(99, 102, 241, 0.85)';
        canvasCtx.fillRect(x, canvas.height - barHeight, barWidth - 2, barHeight);
        
        x += barWidth;
      }
    }
    
    draw();
  } catch (err) {
    console.error('Error starting visualizer:', err);
    // Draw flat fallback lines
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

// Button Handlers
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
  window.electronAPI.stopRecording();
});

cancelBtn.addEventListener('click', () => {
  stopTimer();
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
  // Send IPC to main process to toggle mic in recording stream
  if (window.electronAPI.toggleMic) {
    window.electronAPI.toggleMic(isMicMuted);
  }
});

camBtn.addEventListener('click', () => {
  isCamActive = !isCamActive;
  if (isCamActive) {
    camOffIcon.classList.add('hidden');
    camOnIcon.classList.remove('hidden');
    camBtn.title = 'Hide Camera Bubble';
    camBtn.classList.remove('active');
    window.electronAPI.showCameraBubble();
  } else {
    camOnIcon.classList.add('hidden');
    camOffIcon.classList.remove('hidden');
    camBtn.title = 'Show Camera Bubble';
    camBtn.classList.add('active');
    window.electronAPI.hideCameraBubble();
  }
});

// Sync state if changed externally (e.g. from keys/shortcuts)
if (window.electronAPI.onControlsStateChange) {
  window.electronAPI.onControlsStateChange((state) => {
    if (state.action === 'PAUSE' && !isPaused) {
      pauseBtn.click();
    } else if (state.action === 'RESUME' && isPaused) {
      pauseBtn.click();
    }
  });
}

// Clean up
window.addEventListener('beforeunload', () => {
  stopTimer();
  cancelAnimationFrame(drawVisual);
  if (microphoneStream) {
    microphoneStream.getTracks().forEach(track => track.stop());
  }
  if (audioContext) {
    audioContext.close();
  }
});

// Initialize
startTimer();
initVisualizer();
