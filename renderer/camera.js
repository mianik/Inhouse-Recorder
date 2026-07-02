const videoEl = document.getElementById('webcam');
const container = document.getElementById('cameraContainer');

let stream = null;

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
    container.style.borderRadius = '12px';
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

// Clean up streams on close
window.addEventListener('beforeunload', () => {
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
  }
});

// Initialize
initCamera();
