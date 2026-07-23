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

// Live Stream Elements
const navLiveStream = document.getElementById('navLiveStream');
const panelLiveStream = document.getElementById('panelLiveStream');
const toggleLiveBtn = document.getElementById('toggleLiveBtn');
const liveStatusIndicator = document.getElementById('liveStatusIndicator');
const liveStatusText = document.getElementById('liveStatusText');
const liveLinkBox = document.getElementById('liveLinkBox');
const liveUrlInput = document.getElementById('liveUrlInput');
const copyLiveUrlBtn = document.getElementById('copyLiveUrlBtn');
const liveViewersCount = document.getElementById('liveViewersCount');
const liveResolution = document.getElementById('liveResolution');
const liveFPS = document.getElementById('liveFPS');
const rtmpUrlInput = document.getElementById('rtmpUrlInput');
const rtmpKeyInput = document.getElementById('rtmpKeyInput');
const toggleRtmpBtn = document.getElementById('toggleRtmpBtn');

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
let captureVideo = null;
let audioStream = null;
let recordingStartTime = 0;
let currentPlayingFilename = null;
let recordingThumbnailData = null;

// Collaboration State
let isServerRunning = false;

// Live Stream State
let isLiveBroadcast = false;
let liveBroadcastStream = null;
let liveViewers = {}; // socketId -> { pc }
let rtmpStreamActive = false;
let rtmpRecorder = null;
let selectionPurpose = 'recording';
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
navLiveStream.addEventListener('click', () => switchTab('livestream'));
navSettings.addEventListener('click', () => switchTab('settings'));

function switchTab(tab) {
  if (activeTab === tab) return;
  activeTab = tab;

  // Active state classes for nav items
  navRecordings.classList.toggle('active', tab === 'recordings');
  navCollaboration.classList.toggle('active', tab === 'collaboration');
  navLiveStream.classList.toggle('active', tab === 'livestream');
  navSettings.classList.toggle('active', tab === 'settings');

  // Active panel visibility
  panelRecordings.classList.toggle('active', tab === 'recordings');
  panelCollaboration.classList.toggle('active', tab === 'collaboration');
  panelLiveStream.classList.toggle('active', tab === 'livestream');
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

    const thumbUrl = item.thumbnailPath ? `video-stream:///${encodeURIComponent(item.thumbnailPath)}` : '';
    const thumbHtml = thumbUrl 
      ? `<img src="${thumbUrl}" class="recording-thumbnail-img" />`
      : `<svg class="recording-thumb-placeholder" viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5">
          <polygon points="23 7 16 12 23 17 23 7"></polygon>
          <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
        </svg>`;

    card.innerHTML = `
      <div class="recording-thumb">
        ${thumbHtml}
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
      if (result.fallback) {
        alert(`${result.error}\n\nExported to:\n${result.filePath}`);
      } else {
        alert(`Recording successfully exported as MP4 to:\n${result.filePath}`);
      }
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
  if (!isServerRunning && !isLiveBroadcast) return;

  switch (data.type) {
    case 'join':
      if (!isServerRunning) return;
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
      if (!isServerRunning) return;
      handleGuestOffer(data.socketId, data.sdp);
      break;

    case 'candidate':
      if (!isServerRunning) return;
      handleGuestCandidate(data.socketId, data.candidate);
      break;

    case 'screen-offer':
      if (!isServerRunning) return;
      handleGuestScreenOffer(data.socketId, data.sdp);
      break;

    case 'screen-candidate':
      if (!isServerRunning) return;
      handleGuestScreenCandidate(data.socketId, data.candidate);
      break;

    case 'screen-stop':
      if (!isServerRunning) return;
      handleGuestScreenStop(data.socketId);
      break;

    case 'viewer-join':
      if (!isLiveBroadcast) return;
      handleViewerJoin(data.socketId);
      break;

    case 'viewer-answer':
      if (!isLiveBroadcast) return;
      handleViewerAnswer(data.socketId, data.sdp);
      break;

    case 'viewer-candidate':
      if (!isLiveBroadcast) return;
      handleViewerCandidate(data.socketId, data.candidate);
      break;

    case 'disconnect':
      if (isServerRunning) {
        handleGuestDisconnect(data.socketId);
      }
      if (isLiveBroadcast) {
        handleViewerDisconnect(data.socketId);
      }
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
  selectionPurpose = 'recording';
  window.electronAPI.openSelector();
});

window.electronAPI.onRecordingAction(async (action) => {
  switch (action.type) {
    case 'SOURCE_SELECTED':
      if (selectionPurpose === 'recording') {
        startCaptureSession(action.sourceId);
      } else if (selectionPurpose === 'live') {
        startLiveCaptureSession(action.sourceId);
      }
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

// Listener for screen countdown complete to start media recording chunks capturing
window.electronAPI.onCountdownComplete(() => {
  if (mediaRecorder && mediaRecorder.state === 'inactive') {
    recordingStartTime = new Date().getTime();
    recordingThumbnailData = null;
    mediaRecorder.start(1000); // chunk every 1 second
    
    // Notify control overlay to start its timer
    window.electronAPI.updateControlsState({ action: 'RECORDING' });

    // Generate preview thumbnail slightly after starting
    setTimeout(() => {
      if (captureVideo && screenStream) {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 800;
          canvas.height = 500;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(captureVideo, 0, 0, canvas.width, canvas.height);
          recordingThumbnailData = canvas.toDataURL('image/jpeg', 0.8);
        } catch (e) {
          console.warn('Failed to generate preview thumbnail:', e);
        }
      }
    }, 1200);
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

    captureVideo = document.createElement('video');
    captureVideo.srcObject = screenStream;
    captureVideo.muted = true;
    captureVideo.setAttribute('playsinline', '');
    captureVideo.play().catch(e => console.warn('captureVideo play failed', e));

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
        duration: durationStr,
        thumbnailData: recordingThumbnailData
      };

      await window.electronAPI.finalizeRecording(metadata);
      cleanStreams();
    };

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
  if (captureVideo) {
    captureVideo.srcObject = null;
    captureVideo = null;
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

// Screenshot capture listener
window.electronAPI.onScreenshotCommand(async () => {
  if (!screenStream || !captureVideo) return;
  
  try {
    const canvas = document.createElement('canvas');
    const track = screenStream.getVideoTracks()[0];
    const settings = track.getSettings();
    canvas.width = settings.width || 1920;
    canvas.height = settings.height || 1080;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(captureVideo, 0, 0, canvas.width, canvas.height);
    
    const dataUrl = canvas.toDataURL('image/png');
    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
    const arrayBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0)).buffer;
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `Screenshot_${timestamp}.png`;
    
    const result = await window.electronAPI.saveScreenshot(arrayBuffer, filename);
    if (result.success) {
      showToastNotification(`Screenshot saved to library: ${filename}`);
    } else {
      console.error('Failed to save screenshot:', result.error);
      alert('Failed to save screenshot');
    }
  } catch (err) {
    console.error('Failed to capture screenshot frame:', err);
  }
});

// Toast notification helper
function showToastNotification(message) {
  const toast = document.createElement('div');
  toast.className = 'toast-alert';
  toast.textContent = message;
  document.body.appendChild(toast);
  
  // Trigger transition
  setTimeout(() => toast.classList.add('visible'), 50);
  
  // Remove after 3.5s
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 400);
  }, 3500);
}

// -------------------------------------------------------------
// Live Streaming Controllers
// -------------------------------------------------------------
toggleLiveBtn.addEventListener('click', async () => {
  if (isLiveBroadcast) {
    stopLiveBroadcast();
  } else {
    stopSettingsPreview();
    selectionPurpose = 'live';
    window.electronAPI.openSelector();
  }
});

async function startLiveCaptureSession(sourceId) {
  let serverUrl = joinUrlInput.value;
  if (!isServerRunning) {
    const serverResult = await window.electronAPI.startCollaborationServer();
    if (serverResult.success) {
      isServerRunning = true;
      serverUrl = serverResult.url;
      joinUrlInput.value = serverUrl;
      updateServerUI();
    } else {
      alert(`Could not start stream portal server: ${serverResult.error}`);
      return;
    }
  }

  const fps = appSettings.fps || 30;
  const micId = appSettings.microphoneId || 'default';

  try {
    // 1. Capture screen video track
    liveBroadcastScreenStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: sourceId,
          maxFrameRate: fps
        }
      }
    });

    // 2. Capture mic track
    try {
      liveBroadcastMicStream = await navigator.mediaDevices.getUserMedia({
        audio: micId !== 'none' ? { deviceId: micId ? { exact: micId } : undefined } : false
      });
    } catch (e) {
      console.warn('Could not open selected mic. Trying default audio:', e);
      liveBroadcastMicStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    }

    // 3. Assemble composite MediaStream
    const tracks = [];
    if (liveBroadcastScreenStream) {
      tracks.push(...liveBroadcastScreenStream.getVideoTracks());
    }
    if (liveBroadcastMicStream) {
      tracks.push(...liveBroadcastMicStream.getAudioTracks());
    }
    liveBroadcastStream = new MediaStream(tracks);

    // 4. Update UI Status to live
    isLiveBroadcast = true;
    liveStatusIndicator.className = 'status-indicator-dot on';
    liveStatusText.textContent = 'Live Broadcasting';
    toggleLiveBtn.textContent = 'Stop Live';
    toggleLiveBtn.className = 'btn btn-danger';
    
    // Set Portal URL display
    const portalUrl = serverUrl.replace(/\/$/, '') + '/live';
    liveUrlInput.value = portalUrl;
    liveLinkBox.classList.remove('hidden');

    // Display capture stats
    const videoTrack = liveBroadcastScreenStream.getVideoTracks()[0];
    if (videoTrack) {
      const settings = videoTrack.getSettings();
      liveResolution.textContent = `${settings.width || '1920'}x${settings.height || '1080'}`;
      liveFPS.textContent = `${settings.frameRate || fps} FPS`;
    }

    // Monitor external ending (e.g. Chrome's overlay stop sharing)
    videoTrack.onended = () => {
      stopLiveBroadcast();
    };

    showToastNotification("Live Stream portal active!");

  } catch (err) {
    console.error('Failed to start live broadcast capture:', err);
    alert('Failed to start screen live stream.');
    stopLiveBroadcast();
  }
}

async function stopLiveBroadcast() {
  if (rtmpStreamActive) {
    await stopRtmpBroadcast();
  }

  // 1. Clean up media tracks
  if (liveBroadcastScreenStream) {
    liveBroadcastScreenStream.getTracks().forEach(t => t.stop());
    liveBroadcastScreenStream = null;
  }
  if (liveBroadcastMicStream) {
    liveBroadcastMicStream.getTracks().forEach(t => t.stop());
    liveBroadcastMicStream = null;
  }
  liveBroadcastStream = null;

  // 2. Disconnect and notify all active viewers
  for (let socketId in liveViewers) {
    if (liveViewers[socketId].pc) {
      liveViewers[socketId].pc.close();
    }
    sendSignal('kick', socketId);
  }
  liveViewers = {};
  updateViewerCount();

  // 3. Stop collaboration server if room is also closed
  const isRoomOpen = (serverStatusText.textContent !== 'Room Closed');
  if (isServerRunning && !isRoomOpen) {
    await window.electronAPI.stopCollaborationServer();
    isServerRunning = false;
    updateServerUI();
  }

  // 4. Reset UI Elements
  isLiveBroadcast = false;
  liveStatusIndicator.className = 'status-indicator-dot off';
  liveStatusText.textContent = 'Live Broadcast Closed';
  toggleLiveBtn.textContent = 'Go Live';
  toggleLiveBtn.className = 'btn btn-primary';
  liveLinkBox.classList.add('hidden');
  liveUrlInput.value = '';
  liveResolution.textContent = '--';
  liveFPS.textContent = '--';

  showToastNotification("Live broadcast closed.");
}

// -------------------------------------------------------------
// Viewer WebRTC Connections
// -------------------------------------------------------------
async function handleViewerJoin(socketId) {
  if (!liveBroadcastStream) return;

  const pc = new RTCPeerConnection(rtcConfig);
  liveViewers[socketId] = { pc };
  updateViewerCount();

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      sendSignal('viewer-dashboard-candidate', socketId, { candidate: event.candidate });
    }
  };

  // Add video/audio tracks
  liveBroadcastStream.getTracks().forEach(track => {
    pc.addTrack(track, liveBroadcastStream);
  });

  try {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    sendSignal('viewer-offer', socketId, { sdp: offer });
  } catch (err) {
    console.error('Failed creating WebRTC offer for live viewer:', err);
  }
}

async function handleViewerAnswer(socketId, sdp) {
  const viewer = liveViewers[socketId];
  if (viewer && viewer.pc) {
    try {
      await viewer.pc.setRemoteDescription(new RTCSessionDescription(sdp));
    } catch (err) {
      console.error('Failed setting viewer remote SDP answer:', err);
    }
  }
}

async function handleViewerCandidate(socketId, candidate) {
  const viewer = liveViewers[socketId];
  if (viewer && viewer.pc) {
    try {
      await viewer.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.error('Failed adding viewer ICE candidate:', err);
    }
  }
}

function handleViewerDisconnect(socketId) {
  const viewer = liveViewers[socketId];
  if (viewer) {
    if (viewer.pc) {
      viewer.pc.close();
    }
    delete liveViewers[socketId];
  }
  updateViewerCount();
}

function updateViewerCount() {
  const count = Object.keys(liveViewers).length;
  liveViewersCount.textContent = count;
}

// -------------------------------------------------------------
// RTMP Pipe Streaming
// -------------------------------------------------------------
toggleRtmpBtn.addEventListener('click', async () => {
  if (rtmpStreamActive) {
    await stopRtmpBroadcast();
  } else {
    await startRtmpBroadcast();
  }
});

async function startRtmpBroadcast() {
  if (!isLiveBroadcast || !liveBroadcastStream) {
    alert("Please click 'Go Live' and share your screen before starting an RTMP broadcast.");
    return;
  }

  const rtmpUrl = rtmpUrlInput.value.trim();
  const streamKey = rtmpKeyInput.value.trim();

  if (!rtmpUrl || !streamKey) {
    alert("Please enter both the RTMP Server URL and Stream Key.");
    return;
  }

  toggleRtmpBtn.textContent = "Connecting...";
  toggleRtmpBtn.disabled = true;

  const result = await window.electronAPI.startRtmpStream(rtmpUrl, streamKey);
  toggleRtmpBtn.disabled = false;

  if (result.success) {
    rtmpStreamActive = true;
    toggleRtmpBtn.textContent = "Stop RTMP Broadcast";
    toggleRtmpBtn.className = "btn btn-danger";

    try {
      rtmpRecorder = new MediaRecorder(liveBroadcastStream, {
        mimeType: 'video/webm;codecs=vp8,opus',
        videoBitsPerSecond: 2500000 // 2.5 Mbps
      });

      rtmpRecorder.ondataavailable = async (event) => {
        if (event.data && event.data.size > 0 && rtmpStreamActive) {
          const buffer = await event.data.arrayBuffer();
          window.electronAPI.sendRtmpChunk(buffer);
        }
      };

      rtmpRecorder.start(1000); // 1-second timeslices
      showToastNotification("RTMP broadcast started successfully!");

    } catch (err) {
      console.error('Failed to initialize RTMP MediaRecorder:', err);
      alert('Local MediaRecorder initialization failed: ' + err.message);
      stopRtmpBroadcast();
    }
  } else {
    alert(`Could not start RTMP stream: ${result.error}`);
    toggleRtmpBtn.textContent = "Start RTMP Broadcast";
    toggleRtmpBtn.className = "btn btn-secondary";
  }
}

async function stopRtmpBroadcast() {
  rtmpStreamActive = false;
  if (rtmpRecorder && rtmpRecorder.state !== 'inactive') {
    try {
      rtmpRecorder.stop();
    } catch (e) {}
    rtmpRecorder = null;
  }

  await window.electronAPI.stopRtmpStream();
  toggleRtmpBtn.textContent = "Start RTMP Broadcast";
  toggleRtmpBtn.className = "btn btn-secondary";
  showToastNotification("RTMP broadcast stopped.");
}

copyLiveUrlBtn.addEventListener('click', () => {
  if (liveUrlInput.value) {
    navigator.clipboard.writeText(liveUrlInput.value);
    const prevText = copyLiveUrlBtn.textContent;
    copyLiveUrlBtn.textContent = 'Copied!';
    setTimeout(() => {
      copyLiveUrlBtn.textContent = prevText;
    }, 2000);
  }
});

// Listener for main process spawned stream status changes
window.electronAPI.onRtmpStatus((data) => {
  console.log('RTMP main-process status:', data);
  if (data.status === 'stopped') {
    rtmpStreamActive = false;
    if (rtmpRecorder && rtmpRecorder.state !== 'inactive') {
      try {
        rtmpRecorder.stop();
      } catch (e) {}
    }
    rtmpRecorder = null;
    toggleRtmpBtn.textContent = "Start RTMP Broadcast";
    toggleRtmpBtn.className = "btn btn-secondary";
    showToastNotification("RTMP Stream disconnected from server.");
  }
});
