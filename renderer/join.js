// UI Elements
const setupPanel = document.getElementById('setupPanel');
const activePanel = document.getElementById('activePanel');
const usernameInput = document.getElementById('username');
const localPreview = document.getElementById('localPreview');
const localActivePreview = document.getElementById('localActivePreview');
const noPreview = document.getElementById('noPreview');
const displayName = document.getElementById('displayName');
const sharingBadge = document.getElementById('sharingBadge');

// Buttons
const toggleCamBtn = document.getElementById('toggleCam');
const toggleMicBtn = document.getElementById('toggleMic');
const toggleScreenBtn = document.getElementById('toggleScreen');
const joinBtn = document.getElementById('joinBtn');

const activeCamBtn = document.getElementById('activeCamBtn');
const activeMicBtn = document.getElementById('activeMicBtn');
const activeScreenBtn = document.getElementById('activeScreenBtn');
const leaveBtn = document.getElementById('leaveBtn');

// Icons
const camOnIcon = document.getElementById('camOn');
const camOffIcon = document.getElementById('camOff');
const micOnIcon = document.getElementById('micOn');
const micOffIcon = document.getElementById('micOff');
const screenOnIcon = document.getElementById('screenOn');
const screenOffIcon = document.getElementById('screenOff');

// State
let localStream = null;
let screenStream = null;
let isCamOn = true;
let isMicOn = true;
let isSharingScreen = false;
let socket = null;
let peerConnection = null;
let screenPeerConnection = null;

// STUN Configuration
const rtcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

// -------------------------------------------------------------
// Media Devices Initialization
// -------------------------------------------------------------
async function initMedia() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 } },
      audio: true
    });
    
    localPreview.srcObject = localStream;
    noPreview.classList.add('hidden');
  } catch (err) {
    console.warn('Could not acquire both video and audio. Trying audio only:', err);
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
      isCamOn = false;
      updateCamUI();
    } catch (e) {
      console.error('Failed to get media devices:', e);
      noPreview.textContent = 'Devices Access Denied';
    }
  }
}

// -------------------------------------------------------------
// Device Toggle Handlers (Pre-join & Active)
// -------------------------------------------------------------
function toggleCamera() {
  if (!localStream) return;
  isCamOn = !isCamOn;
  localStream.getVideoTracks().forEach(track => track.enabled = isCamOn);
  updateCamUI();
}

function updateCamUI() {
  if (isCamOn) {
    camOnIcon.classList.remove('hidden');
    camOffIcon.classList.add('hidden');
    toggleCamBtn.classList.remove('muted');
    activeCamBtn.classList.remove('muted');
    activeCamBtn.textContent = 'Camera On';
    noPreview.classList.add('hidden');
    localPreview.classList.remove('hidden');
    localActivePreview.classList.remove('hidden');
  } else {
    camOnIcon.classList.add('hidden');
    camOffIcon.classList.remove('hidden');
    toggleCamBtn.classList.add('muted');
    activeCamBtn.classList.add('muted');
    activeCamBtn.textContent = 'Camera Off';
    noPreview.classList.remove('hidden');
    localPreview.classList.add('hidden');
    localActivePreview.classList.add('hidden');
  }
}

function toggleMicrophone() {
  if (!localStream) return;
  isMicOn = !isMicOn;
  localStream.getAudioTracks().forEach(track => track.enabled = isMicOn);
  updateMicUI();
}

function updateMicUI() {
  if (isMicOn) {
    micOnIcon.classList.remove('hidden');
    micOffIcon.classList.add('hidden');
    toggleMicBtn.classList.remove('muted');
    activeMicBtn.classList.remove('muted');
    activeMicBtn.textContent = 'Mic On';
  } else {
    micOnIcon.classList.add('hidden');
    micOffIcon.classList.remove('hidden');
    toggleMicBtn.classList.add('muted');
    activeMicBtn.classList.add('muted');
    activeMicBtn.textContent = 'Mic Muted';
  }
}

// Pre-join Toggles Bindings
toggleCamBtn.addEventListener('click', toggleCamera);
toggleMicBtn.addEventListener('click', toggleMicrophone);

// Active Toggles Bindings
activeCamBtn.addEventListener('click', toggleCamera);
activeMicBtn.addEventListener('click', toggleMicrophone);

// -------------------------------------------------------------
// Connection & Signaling (WebRTC + WS)
// -------------------------------------------------------------
async function joinSession() {
  const username = usernameInput.value.trim();
  if (!username) {
    alert('Please enter your name.');
    return;
  }

  displayName.textContent = username;

  // 1. Establish WebSocket Connection to Signaling Server
  // Use current host address (running on same local server)
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}`;
  
  socket = new WebSocket(wsUrl);

  socket.onopen = () => {
    // Send join registration
    sendSignal({
      type: 'join',
      name: username
    });

    // Toggle panels
    setupPanel.classList.add('hidden');
    activePanel.classList.remove('hidden');
    
    // Set viewfinder in active screen
    localActivePreview.srcObject = localStream;
    
    // 2. Setup RTCPeerConnection for Camera & Mic
    setupPeerConnection();
  };

  socket.onmessage = async (message) => {
    try {
      const data = JSON.parse(message.data);

      switch (data.type) {
        case 'answer':
          if (peerConnection) {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
          }
          break;
          
        case 'screen-answer':
          if (screenPeerConnection) {
            await screenPeerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
          }
          break;

        case 'dashboard-candidate':
          if (peerConnection) {
            await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
          }
          break;
          
        case 'screen-dashboard-candidate':
          if (screenPeerConnection) {
            await screenPeerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
          }
          break;

        case 'kick':
          alert('You have been disconnected from the session.');
          leaveSession();
          break;
      }
    } catch (err) {
      console.error('Failed processing signaling payload:', err);
    }
  };

  socket.onclose = () => {
    leaveSession();
  };
}

// Setup Peer Connection for Camera + Mic
async function setupPeerConnection() {
  peerConnection = new RTCPeerConnection(rtcConfig);

  // Add tracks from local camera/mic stream
  if (localStream) {
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });
  }

  // Gather and send ICE candidates
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      sendSignal({
        type: 'candidate',
        candidate: event.candidate
      });
    }
  };

  // Create WebRTC Offer
  try {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    
    sendSignal({
      type: 'offer',
      sdp: offer
    });
  } catch (err) {
    console.error('Error creating WebRTC offer:', err);
  }
}

// -------------------------------------------------------------
// Screen Sharing Implementation
// -------------------------------------------------------------
async function toggleScreenShare() {
  if (isSharingScreen) {
    stopScreenShare();
  } else {
    await startScreenShare();
  }
}

async function startScreenShare() {
  try {
    screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: false
    });

    isSharingScreen = true;
    updateScreenUI(true);

    // If stream ends externally (e.g. Chrome's stop sharing button)
    screenStream.getVideoTracks()[0].onended = () => {
      stopScreenShare();
    };

    // Setup a separate Peer Connection for the Screen Share Stream
    setupScreenPeerConnection();

  } catch (err) {
    console.error('Screen sharing failed:', err);
    isSharingScreen = false;
    updateScreenUI(false);
  }
}

function stopScreenShare() {
  if (screenStream) {
    screenStream.getTracks().forEach(track => track.stop());
    screenStream = null;
  }
  
  if (screenPeerConnection) {
    screenPeerConnection.close();
    screenPeerConnection = null;
  }
  
  isSharingScreen = false;
  updateScreenUI(false);

  // Notify host
  sendSignal({
    type: 'screen-stop'
  });
}

async function setupScreenPeerConnection() {
  screenPeerConnection = new RTCPeerConnection(rtcConfig);

  // Add screen sharing track
  if (screenStream) {
    screenStream.getTracks().forEach(track => {
      screenPeerConnection.addTrack(track, screenStream);
    });
  }

  screenPeerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      sendSignal({
        type: 'screen-candidate',
        candidate: event.candidate
      });
    }
  };

  try {
    const offer = await screenPeerConnection.createOffer();
    await screenPeerConnection.setLocalDescription(offer);
    
    sendSignal({
      type: 'screen-offer',
      sdp: offer
    });
  } catch (err) {
    console.error('Error creating screen share WebRTC offer:', err);
  }
}

function updateScreenUI(active) {
  if (active) {
    screenOffIcon.classList.add('hidden');
    screenOnIcon.classList.remove('hidden');
    activeScreenBtn.classList.add('active');
    activeScreenBtn.textContent = 'Stop Sharing';
    sharingBadge.classList.remove('hidden');
  } else {
    screenOnIcon.classList.add('hidden');
    screenOffIcon.classList.remove('hidden');
    activeScreenBtn.classList.remove('active');
    activeScreenBtn.textContent = 'Share Screen';
    sharingBadge.classList.add('hidden');
  }
}

// Bind Screen Share triggers
toggleScreenBtn.addEventListener('click', () => {
  // Toggle UI icon states prior to join
  isSharingScreen = !isSharingScreen;
  if (isSharingScreen) {
    screenOffIcon.classList.add('hidden');
    screenOnIcon.classList.remove('hidden');
    toggleScreenBtn.classList.add('active');
  } else {
    screenOnIcon.classList.add('hidden');
    screenOffIcon.classList.remove('hidden');
    toggleScreenBtn.classList.remove('active');
  }
});

// Active Screen Sharing trigger
activeScreenBtn.addEventListener('click', toggleScreenShare);

// -------------------------------------------------------------
// Helper Methods & Cleanup
// -------------------------------------------------------------
function sendSignal(payload) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
}

function leaveSession() {
  stopScreenShare();

  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }

  if (socket) {
    socket.close();
    socket = null;
  }

  // Restore panels
  setupPanel.classList.remove('hidden');
  activePanel.classList.add('hidden');
  displayName.textContent = '';
  
  // Re-establish local media preview
  initMedia();
}

leaveBtn.addEventListener('click', leaveSession);
joinBtn.addEventListener('click', joinSession);

// Initialize Media preview on page load
initMedia();
