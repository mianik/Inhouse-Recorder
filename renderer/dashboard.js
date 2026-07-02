// DOM Elements
const navRecordings = document.getElementById('navRecordings');
const navCollaboration = document.getElementById('navCollaboration');
const navSettings = document.getElementById('navSettings');
const panelRecordings = document.getElementById('panelRecordings');
const panelCollaboration = document.getElementById('panelCollaboration');
const panelSettings = document.getElementById('panelSettings');
const startRecordBtn = document.getElementById('startRecordBtn');

const recordingsGrid = document.getElementById('recordingsGrid');
const emptyState = document.getElementById('emptyState');
const recordingCountEl = document.getElementById('recordingCount');

// Collaboration Elements
const toggleServerBtn = document.getElementById('toggleServerBtn');
const serverStatusIndicator = document.getElementById('serverStatusIndicator');
const serverStatusText = document.getElementById('serverStatusText');
const collaborationLinkBox = document.getElementById('collaborationLinkBox');
const joinUrlInput = document.getElementById('joinUrlInput');
const copyUrlBtn = document.getElementById('copyUrlBtn');
const participantsGrid = document.getElementById('participantsGrid');
const noParticipantsMsg = document.getElementById('noParticipantsMsg');
const floatingFeedsContainer = document.getElementById('floatingFeedsContainer');

// Settings Elements
const settingsForm = document.getElementById('settingsForm');
const cameraSelect = document.getElementById('cameraSelect');
const micSelect = document.getElementById('micSelect');
const saveDirectoryInput = document.getElementById('saveDirectoryInput');
const browseDirBtn = document.getElementById('browseDirBtn');
const resolutionSelect = document.getElementById('resolutionSelect');
const fpsSelect = document.getElementById('fpsSelect');

const previewWebcam = document.getElementById('previewWebcam');
const previewNoCam = document.getElementById('previewNoCam');
const previewAudioBar = document.getElementById('previewAudioBar');

// Player Modal
const videoPlayerOverlay = document.getElementById('videoPlayerOverlay');
const playerVideo = document.getElementById('playerVideo');
const playerVideoTitle = document.getElementById('playerVideoTitle');
const closePlayerBtn = document.getElementById('closePlayerBtn');
const playerOpenFolderBtn = document.getElementById('playerOpenFolderBtn');
const playerDownloadBtn = document.getElementById('playerDownloadBtn');
const playerDeleteBtn = document.getElementById('playerDeleteBtn');

// State
let activeTab = 'recordings';
let appSettings = {};
let previewStream = null;
let previewAudioContext = null;
let previewAnalyser = null;
let previewAudioInterval = null;
let previewAudioStream = null;

// Media Recorder State
let mediaRecorder = null;
let recordedChunks = [];
let screenStream = null;
let audioStream = null;
let recordingStartTime = 0;
let currentPlayingFilename = null;

// Collaboration State
let isServerRunning = false;
let guests = []; // { socketId, name, pc, stream, screenPc, screenStream }
const rtcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

// Tab Navigation
navRecordings.addEventListener('click', () => switchTab('recordings'));
navCollaboration.addEventListener('click', () => switchTab('collaboration'));
navSettings.addEventListener('click', () => switchTab('settings'));

function switchTab(tab) {
  if (activeTab === tab) return;
  activeTab = tab;

  // Active state classes for nav items
  navRecordings.classList.toggle('active', tab === 'recordings');
  navCollaboration.classList.toggle('active', tab === 'collaboration');
  navSettings.classList.toggle('active', tab === 'settings');

  // Active panel visibility
  panelRecordings.classList.toggle('active', tab === 'recordings');
  panelCollaboration.classList.toggle('active', tab === 'collaboration');
  panelSettings.classList.toggle('active', tab === 'settings');

  if (tab !== 'settings') {
    stopSettingsPreview();
  }

  if (tab === 'recordings') {
    loadRecordings();
  } else if (tab === 'settings') {
    startSettingsPreview();
  }
}

// -------------------------------------------------------------
// Recordings Library Management
// -------------------------------------------------------------
async function loadRecordings() {
  try {
    const list = await window.electronAPI.getRecordings();
    renderRecordings(list);
  } catch (err) {
    console.error('Failed to load recordings list:', err);
  }
}

function renderRecordings(list) {
  recordingsGrid.innerHTML = '';
  recordingCountEl.textContent = `${list.length} video${list.length === 1 ? '' : 's'}`;

  if (list.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  }
  emptyState.classList.add('hidden');

  list.forEach(item => {
    const card = document.createElement('div');
    card.className = 'recording-card';
    
    const formattedDate = new Date(item.timestamp).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    const sizeMB = (item.size / (1024 * 1024)).toFixed(1);

    card.innerHTML = `
      <div class="recording-thumb">
        <svg class="recording-thumb-placeholder" viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5">
          <polygon points="23 7 16 12 23 17 23 7"></polygon>
          <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
        </svg>
        <div class="play-hover-icon">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
        </div>
        <div class="recording-duration">${item.duration}</div>
      </div>
      <div class="recording-details">
        <div class="recording-title" title="${item.title}">${item.title}</div>
        <div class="recording-meta">
          <span>${formattedDate}</span>
          <span>${sizeMB} MB</span>
        </div>
      </div>
    `;

    card.addEventListener('click', () => {
      openPlayer(item);
    });

    recordingsGrid.appendChild(card);
  });
}

function openPlayer(item) {
  currentPlayingFilename = item.filename;
  playerVideoTitle.textContent = item.title;
  playerVideo.src = `video-stream:///${encodeURIComponent(item.path)}`;
  videoPlayerOverlay.classList.remove('hidden');
}

function closePlayer() {
  playerVideo.pause();
  playerVideo.removeAttribute('src');
  videoPlayerOverlay.classList.add('hidden');
  currentPlayingFilename = null;
}

closePlayerBtn.addEventListener('click', closePlayer);

playerOpenFolderBtn.addEventListener('click', async () => {
  if (currentPlayingFilename) {
    await window.electronAPI.openRecordingFolder(currentPlayingFilename);
  }
});

playerDownloadBtn.addEventListener('click', async () => {
  if (currentPlayingFilename) {
    const result = await window.electronAPI.exportRecording(currentPlayingFilename);
    if (result.success) {
      alert(`Recording successfully exported to:\n${result.filePath}`);
    } else if (!result.canceled) {
      alert(`Failed to export: ${result.error}`);
    }
  }
});

playerDeleteBtn.addEventListener('click', async () => {
  if (currentPlayingFilename) {
    const confirmed = confirm('Are you sure you want to delete this recording? This action cannot be undone.');
    if (confirmed) {
      const success = await window.electronAPI.deleteRecording(currentPlayingFilename);
      if (success) {
        closePlayer();
        loadRecordings();
      } else {
        alert('Failed to delete recording.');
      }
    }
  }
});

// -------------------------------------------------------------
// Settings & Preview Management
// -------------------------------------------------------------
async function loadSettings() {
  appSettings = await window.electronAPI.getSettings();
  saveDirectoryInput.value = appSettings.saveDirectory;
  resolutionSelect.value = appSettings.resolution || '1080p';
  fpsSelect.value = appSettings.fps || '30';
  
  await populateDevices();
  
  if (appSettings.cameraId) {
    cameraSelect.value = appSettings.cameraId;
  }
  if (appSettings.microphoneId) {
    micSelect.value = appSettings.microphoneId;
  }
}

async function populateDevices() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    
    cameraSelect.innerHTML = '<option value="default">Default Camera</option><option value="none">No Camera</option>';
    micSelect.innerHTML = '<option value="default">Default Microphone</option><option value="none">No Microphone</option>';
    
    devices.forEach(device => {
      const option = document.createElement('option');
      option.value = device.deviceId;
      
      if (device.kind === 'videoinput') {
        option.textContent = device.label || `Camera ${cameraSelect.length}`;
        cameraSelect.appendChild(option);
      } else if (device.kind === 'audioinput') {
        option.textContent = device.label || `Microphone ${micSelect.length - 1}`;
        micSelect.appendChild(option);
      }
    });
  } catch (err) {
    console.error('Failed to list media devices:', err);
  }
}

async function startSettingsPreview() {
  stopSettingsPreview();
  
  const selectedCamera = cameraSelect.value;
  const selectedMic = micSelect.value;

  if (selectedCamera && selectedCamera !== 'none') {
    previewNoCam.classList.add('hidden');
    previewWebcam.classList.remove('hidden');
    try {
      const constraints = {
        video: selectedCamera === 'default' ? true : { deviceId: { exact: selectedCamera } },
        audio: false
      };
      previewStream = await navigator.mediaDevices.getUserMedia(constraints);
      previewWebcam.srcObject = previewStream;
    } catch (err) {
      console.error('Camera preview failed:', err);
      previewNoCam.textContent = 'Preview Failed';
      previewNoCam.classList.remove('hidden');
      previewWebcam.classList.add('hidden');
    }
  } else {
    previewNoCam.textContent = 'Camera Off';
    previewNoCam.classList.remove('hidden');
    previewWebcam.classList.add('hidden');
  }

  if (selectedMic !== 'none') {
    try {
      const constraints = {
        audio: selectedMic === 'default' ? true : { deviceId: { exact: selectedMic } },
        video: false
      };
      
      previewAudioStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      previewAudioContext = new (window.AudioContext || window.webkitAudioContext)();
      previewAnalyser = previewAudioContext.createAnalyser();
      const source = previewAudioContext.createMediaStreamSource(previewAudioStream);
      
      source.connect(previewAnalyser);
      previewAnalyser.fftSize = 256;
      
      const bufferLength = previewAnalyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      previewAudioInterval = setInterval(() => {
        previewAnalyser.getByteFrequencyData(dataArray);
        
        let values = 0;
        for (let i = 0; i < bufferLength; i++) {
          values += dataArray[i];
        }
        const average = values / bufferLength;
        const percentage = Math.min((average / 120) * 100, 100);
        previewAudioBar.style.width = `${percentage}%`;
      }, 50);
      
    } catch (err) {
      console.error('Audio preview failed:', err);
      previewAudioBar.style.width = '0%';
    }
  } else {
    previewAudioBar.style.width = '0%';
  }
}

function stopSettingsPreview() {
  if (previewStream) {
    previewStream.getTracks().forEach(track => track.stop());
    previewStream = null;
  }
  
  if (previewAudioStream) {
    previewAudioStream.getTracks().forEach(track => track.stop());
    previewAudioStream = null;
  }

  if (previewAudioInterval) {
    clearInterval(previewAudioInterval);
    previewAudioInterval = null;
  }

  if (previewAudioContext) {
    previewAudioContext.close();
    previewAudioContext = null;
  }

  previewAudioBar.style.width = '0%';
  previewWebcam.srcObject = null;
}

cameraSelect.addEventListener('change', startSettingsPreview);
micSelect.addEventListener('change', startSettingsPreview);

browseDirBtn.addEventListener('click', async () => {
  const chosenDir = await window.electronAPI.selectDirectory();
  if (chosenDir) {
    saveDirectoryInput.value = chosenDir;
  }
});

settingsForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const settings = {
    saveDirectory: saveDirectoryInput.value,
    cameraId: cameraSelect.value,
    microphoneId: micSelect.value,
    resolution: resolutionSelect.value,
    fps: parseInt(fpsSelect.value, 10)
  };
  
  const saved = await window.electronAPI.saveSettings(settings);
  if (saved) {
    appSettings = settings;
    alert('Settings saved successfully!');
  } else {
    alert('Failed to save settings.');
  }
});

// -------------------------------------------------------------
// Collaboration Logic (WebRTC Signal Broker)
// -------------------------------------------------------------
toggleServerBtn.addEventListener('click', async () => {
  if (isServerRunning) {
    // Stop server
    const result = await window.electronAPI.stopCollaborationServer();
    if (result.success) {
      isServerRunning = false;
      updateServerUI();
      disconnectAllGuests();
    }
  } else {
    // Start server
    const result = await window.electronAPI.startCollaborationServer();
    if (result.success) {
      isServerRunning = true;
      joinUrlInput.value = result.url;
      updateServerUI();
    } else {
      alert(`Could not start collaboration room: ${result.error}`);
    }
  }
});

function updateServerUI() {
  if (isServerRunning) {
    serverStatusIndicator.className = 'status-indicator-dot on';
    serverStatusText.textContent = 'Room Open';
    toggleServerBtn.textContent = 'Close Room';
    toggleServerBtn.className = 'btn btn-danger';
    collaborationLinkBox.classList.remove('hidden');
  } else {
    serverStatusIndicator.className = 'status-indicator-dot off';
    serverStatusText.textContent = 'Room Closed';
    toggleServerBtn.textContent = 'Open Room';
    toggleServerBtn.className = 'btn btn-primary';
    collaborationLinkBox.classList.add('hidden');
    joinUrlInput.value = '';
  }
}

copyUrlBtn.addEventListener('click', () => {
  if (joinUrlInput.value) {
    navigator.clipboard.writeText(joinUrlInput.value);
    const prevText = copyUrlBtn.textContent;
    copyUrlBtn.textContent = 'Copied!';
    setTimeout(() => {
      copyUrlBtn.textContent = prevText;
    }, 2000);
  }
});

// Enqueue signal to guest socket via main process WebSocket relay
function sendSignal(type, targetSocketId, extraData = {}) {
  window.electronAPI.sendCollaborationSignal({
    type,
    targetSocketId,
    ...extraData
  });
}

// Listen for incoming WS messages forwarded from Main process
window.electronAPI.onCollaborationEvent(async (data) => {
  if (!isServerRunning) return;

  switch (data.type) {
    case 'join':
      // Create guest profile
      const guest = {
        socketId: data.socketId,
        name: data.name,
        pc: null,
        stream: null,
        screenPc: null,
        screenStream: null
      };
      guests.push(guest);
      renderParticipants();
      break;

    case 'offer':
      // Guest initiates WebRTC camera/audio handshake
      handleGuestOffer(data.socketId, data.sdp);
      break;

    case 'candidate':
      // Guest sends ICE candidate for camera stream
      handleGuestCandidate(data.socketId, data.candidate);
      break;

    case 'screen-offer':
      // Guest initiates WebRTC screen sharing handshake
      handleGuestScreenOffer(data.socketId, data.sdp);
      break;

    case 'screen-candidate':
      // Guest sends ICE candidate for screen share
      handleGuestScreenCandidate(data.socketId, data.candidate);
      break;

    case 'screen-stop':
      // Guest stops screen share
      handleGuestScreenStop(data.socketId);
      break;

    case 'disconnect':
      // Guest closes browser connection
      handleGuestDisconnect(data.socketId);
      break;
  }
});

// Handle incoming WebRTC Camera Offer
async function handleGuestOffer(socketId, sdp) {
  const guest = guests.find(g => g.socketId === socketId);
  if (!guest) return;

  if (guest.pc) {
    guest.pc.close();
  }

  const pc = new RTCPeerConnection(rtcConfig);
  guest.pc = pc;

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      sendSignal('dashboard-candidate', socketId, { candidate: event.candidate });
    }
  };

  pc.ontrack = (event) => {
    if (event.streams && event.streams[0]) {
      guest.stream = event.streams[0];
      renderParticipants();
      updateFloatingFeeds();
    }
  };

  try {
    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    
    sendSignal('answer', socketId, { sdp: answer });
  } catch (err) {
    console.error('Error negotiating guest WebRTC offer:', err);
  }
}

function handleGuestCandidate(socketId, candidate) {
  const guest = guests.find(g => g.socketId === socketId);
  if (guest && guest.pc) {
    guest.pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(err => {
      console.error('Failed to add camera ICE candidate:', err);
    });
  }
}

// Handle Guest Screen Share Offer
async function handleGuestScreenOffer(socketId, sdp) {
  const guest = guests.find(g => g.socketId === socketId);
  if (!guest) return;

  if (guest.screenPc) {
    guest.screenPc.close();
  }

  const pc = new RTCPeerConnection(rtcConfig);
  guest.screenPc = pc;

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      sendSignal('screen-dashboard-candidate', socketId, { candidate: event.candidate });
    }
  };

  pc.ontrack = (event) => {
    if (event.streams && event.streams[0]) {
      guest.screenStream = event.streams[0];
      renderParticipants();
      updateFloatingFeeds();
    }
  };

  try {
    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    
    sendSignal('screen-answer', socketId, { sdp: answer });
  } catch (err) {
    console.error('Error negotiating screen share WebRTC offer:', err);
  }
}

function handleGuestScreenCandidate(socketId, candidate) {
  const guest = guests.find(g => g.socketId === socketId);
  if (guest && guest.screenPc) {
    guest.screenPc.addIceCandidate(new RTCIceCandidate(candidate)).catch(err => {
      console.error('Failed to add screen ICE candidate:', err);
    });
  }
}

function handleGuestScreenStop(socketId) {
  const guest = guests.find(g => g.socketId === socketId);
  if (guest) {
    if (guest.screenPc) {
      guest.screenPc.close();
      guest.screenPc = null;
    }
    guest.screenStream = null;
    renderParticipants();
    updateFloatingFeeds();
  }
}

function handleGuestDisconnect(socketId) {
  const idx = guests.findIndex(g => g.socketId === socketId);
  if (idx !== -1) {
    const guest = guests[idx];
    if (guest.pc) guest.pc.close();
    if (guest.screenPc) guest.screenPc.close();
    guests.splice(idx, 1);
    
    renderParticipants();
    updateFloatingFeeds();
  }
}

function disconnectAllGuests() {
  guests.forEach(guest => {
    sendSignal('kick', guest.socketId);
    if (guest.pc) guest.pc.close();
    if (guest.screenPc) guest.screenPc.close();
  });
  guests = [];
  renderParticipants();
  updateFloatingFeeds();
}

// Render Participants list
function renderParticipants() {
  participantsGrid.innerHTML = '';
  
  if (guests.length === 0) {
    participantsGrid.appendChild(noParticipantsMsg);
    return;
  }

  guests.forEach(guest => {
    const item = document.createElement('div');
    item.className = 'participant-item';

    const avatarInitial = guest.name ? guest.name.charAt(0).toUpperCase() : 'G';
    
    let badgesHtml = '';
    if (guest.stream) {
      badgesHtml += `<span class="badge badge-cam">Camera</span>`;
    }
    if (guest.screenStream) {
      badgesHtml += `<span class="badge badge-screen">Screen Shared</span>`;
    }

    item.innerHTML = `
      <div class="participant-info">
        <div class="participant-avatar">${avatarInitial}</div>
        <div class="participant-details">
          <div class="participant-name">${guest.name}</div>
          <div class="participant-badges">${badgesHtml}</div>
        </div>
      </div>
      <button class="kick-btn" title="Kick participant">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    `;

    // Kick button handler
    item.querySelector('.kick-btn').addEventListener('click', () => {
      sendSignal('kick', guest.socketId);
      handleGuestDisconnect(guest.socketId);
    });

    participantsGrid.appendChild(item);
  });
}

// Update Active Recording Floating feeds layout
function updateFloatingFeeds() {
  floatingFeedsContainer.innerHTML = '';
  
  // Only display if recording or previewing and we have active streams
  const activeStreams = guests.filter(g => g.stream || g.screenStream);
  
  if (activeStreams.length === 0) {
    floatingFeedsContainer.classList.add('hidden');
    return;
  }
  
  floatingFeedsContainer.classList.remove('hidden');

  activeStreams.forEach(guest => {
    // Camera feed card
    if (guest.stream) {
      const card = document.createElement('div');
      card.className = 'floating-feed-card circular-feed'; // circular cameras
      card.style.borderRadius = '50%';
      card.style.width = '120px';
      card.style.height = '120px';
      card.style.border = '3px solid #6366f1';
      card.style.overflow = 'hidden';
      card.style.boxShadow = '0 6px 15px rgba(0,0,0,0.4)';
      card.style.pointerEvents = 'auto';
      card.style.position = 'relative';

      const video = document.createElement('video');
      video.autoplay = true;
      video.playsinline = true;
      video.srcObject = guest.stream;
      
      const label = document.createElement('div');
      label.className = 'floating-feed-label';
      label.style.left = '50%';
      label.style.bottom = '4px';
      label.style.transform = 'translateX(-50%)';
      label.style.fontSize = '8px';
      label.textContent = guest.name;

      card.appendChild(video);
      card.appendChild(label);
      floatingFeedsContainer.appendChild(card);
    }

    // Shared screen card
    if (guest.screenStream) {
      const card = document.createElement('div');
      card.className = 'floating-feed-card';
      card.style.width = '240px';
      card.style.height = '150px';
      card.style.borderRadius = '8px';
      card.style.border = '2px solid #10b981';
      card.style.position = 'relative';
      card.style.pointerEvents = 'auto';

      const video = document.createElement('video');
      video.autoplay = true;
      video.playsinline = true;
      video.srcObject = guest.screenStream;

      const label = document.createElement('div');
      label.className = 'floating-feed-label';
      label.textContent = `${guest.name}'s Screen`;

      card.appendChild(video);
      card.appendChild(label);
      floatingFeedsContainer.appendChild(card);
    }
  });
}

// -------------------------------------------------------------
// Recording Session Coordination
// -------------------------------------------------------------
startRecordBtn.addEventListener('click', () => {
  stopSettingsPreview();
  window.electronAPI.openSelector();
});

window.electronAPI.onRecordingAction(async (action) => {
  switch (action.type) {
    case 'SOURCE_SELECTED':
      startCaptureSession(action.sourceId);
      break;
      
    case 'STOP':
      stopCaptureSession();
      break;
      
    case 'PAUSE':
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.pause();
        window.electronAPI.updateControlsState({ action: 'PAUSED' });
      }
      break;
      
    case 'RESUME':
      if (mediaRecorder && mediaRecorder.state === 'paused') {
        mediaRecorder.resume();
        window.electronAPI.updateControlsState({ action: 'RECORDING' });
      }
      break;
      
    case 'CANCEL':
      cancelCaptureSession();
      break;

    case 'TOGGLE_MIC':
      if (audioStream) {
        audioStream.getAudioTracks().forEach(track => track.enabled = !action.isMuted);
      }
      break;
      
    case 'SAVED':
      loadRecordings();
      break;
  }
});

// Capture and start recording
async function startCaptureSession(sourceId) {
  recordedChunks = [];
  
  const resolution = appSettings.resolution || '1080p';
  const fps = appSettings.fps || 30;
  const micId = appSettings.microphoneId || 'default';
  const width = resolution === '1080p' ? 1920 : 1280;
  const height = resolution === '1080p' ? 1080 : 720;

  try {
    // 1. Capture Screen Stream
    screenStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: sourceId,
          maxWidth: width,
          maxHeight: height,
          maxFrameRate: fps
        }
      }
    });

    // 2. Capture Audio Stream (if enabled)
    let combinedStream;
    if (micId !== 'none') {
      try {
        const audioConstraints = {
          audio: micId === 'default' ? true : { deviceId: { exact: micId } },
          video: false
        };
        audioStream = await navigator.mediaDevices.getUserMedia(audioConstraints);
        
        combinedStream = new MediaStream([
          ...screenStream.getVideoTracks(),
          ...audioStream.getAudioTracks()
        ]);
      } catch (err) {
        console.warn('Could not load microphone stream:', err);
        combinedStream = screenStream;
      }
    } else {
      combinedStream = screenStream;
    }

    // 3. Setup Media Recorder
    const options = { mimeType: 'video/webm; codecs=vp9' };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options.mimeType = 'video/webm; codecs=vp8';
    }
    
    mediaRecorder = new MediaRecorder(combinedStream, options);
    
    mediaRecorder.ondataavailable = async (event) => {
      if (event.data && event.data.size > 0) {
        const arrayBuffer = await event.data.arrayBuffer();
        await window.electronAPI.saveVideoChunk(arrayBuffer);
      }
    };
    
    mediaRecorder.onstop = async () => {
      const durationSecs = Math.round((new Date().getTime() - recordingStartTime) / 1000);
      const mins = String(Math.floor(durationSecs / 60)).padStart(2, '0');
      const secs = String(durationSecs % 60).padStart(2, '0');
      const durationStr = `${mins}:${secs}`;
      
      const metadata = {
        title: `Screen Recording ${new Date().toLocaleString()}`,
        duration: durationStr
      };

      await window.electronAPI.finalizeRecording(metadata);
      cleanStreams();
    };

    // 4. Start recording session
    recordingStartTime = new Date().getTime();
    mediaRecorder.start(1000); // chunk every 1 second
    
    // Hide dashboard window and show overlays
    window.electronAPI.startRecording(sourceId);
    
    if (appSettings.cameraId !== 'none') {
      window.electronAPI.showCameraBubble();
    }
    window.electronAPI.showControls();

  } catch (err) {
    console.error('Failed to start capture session:', err);
    alert(`Could not start screen capture: ${err.message}`);
    cleanStreams();
  }
}

function stopCaptureSession() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
}

function cancelCaptureSession() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.onstop = null;
    mediaRecorder.stop();
  }
  cleanStreams();
}

function cleanStreams() {
  if (screenStream) {
    screenStream.getTracks().forEach(track => track.stop());
    screenStream = null;
  }
  if (audioStream) {
    audioStream.getTracks().forEach(track => track.stop());
    audioStream = null;
  }
  mediaRecorder = null;
}

// -------------------------------------------------------------
// App Bootstrap
// -------------------------------------------------------------
async function init() {
  await loadSettings();
  loadRecordings();
  updateServerUI();
}

init();
