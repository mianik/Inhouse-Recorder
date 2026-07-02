const videoEl = document.getElementById('webcam');
const sizeBtns = document.querySelectorAll('.size-btn');
const flipBtn = document.getElementById('flipBtn');
const closeCamBtn = document.getElementById('closeCamBtn');
const container = document.getElementById('cameraContainer');

let stream = null;
let currentSize = 'small';
let isMirrored = true;

// Get camera feed
async function initCamera() {
  try {
    const settings = await window.electronAPI.getSettings();
    const constraints = {
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: 'user'
      },
      audio: false // Audio is captured by the recorder in the background dashboard window
    };

    if (settings.cameraId && settings.cameraId !== 'default' && settings.cameraId !== 'none') {
      constraints.video.deviceId = { exact: settings.cameraId };
    }

    stream = await navigator.mediaDevices.getUserMedia(constraints);
    videoEl.srcObject = stream;
  } catch (error) {
    console.error('Error accessing camera:', error);
    // Display error message in the bubble
    container.style.borderRadius = '12px'; // make it a card instead of circle for text readability
    container.style.border = '2px solid #ef4444';
    container.innerHTML = `
      <div style="padding: 15px; text-align: center; color: #ef4444; font-family:-apple-system,BlinkMacSystemFont,sans-serif; font-size:11px;">
        <strong>Camera Error</strong><br>
        <span style="color:#aaa; font-size:9px;">${error.message}</span>
        <button id="retryBtn" style="margin-top: 8px; font-size: 9px; padding: 3px 6px; cursor: pointer;">Retry</button>
      </div>
    `;
    const retryBtn = document.getElementById('retryBtn');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        window.location.reload();
      });
    }
  }
}

// Handle size configuration
sizeBtns.forEach(btn => {
  if (btn.dataset.size === currentSize) {
    btn.classList.add('active');
  }

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const size = btn.dataset.size;
    currentSize = size;

    // Remove active from all
    sizeBtns.forEach(b => b.classList.remove('active'));
    // Add to current
    btn.classList.add('active');

    // Notify main process to resize window
    window.electronAPI.setCameraBubbleSize(size);
  });
});

// Flip camera preview
flipBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  isMirrored = !isMirrored;
  if (isMirrored) {
    videoEl.classList.remove('flipped-normal');
  } else {
    videoEl.classList.add('flipped-normal');
  }
});

// Close camera
closeCamBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  window.electronAPI.hideCameraBubble();
});

// Clean up streams on close
window.addEventListener('beforeunload', () => {
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
  }
});

// Initialize
initCamera();
