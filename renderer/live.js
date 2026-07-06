// UI Elements
const liveVideo = document.getElementById('liveVideo');
const noStreamMessage = document.getElementById('noStreamMessage');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');

// State
let socket = null;
let peerConnection = null;
let hostSocketId = null;

// STUN Configuration
const rtcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

// -------------------------------------------------------------
// Establish Signaling WebSocket Connection
// -------------------------------------------------------------
function connectToHost() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}`;
  
  socket = new WebSocket(wsUrl);

  socket.onopen = () => {
    statusDot.className = 'status-dot';
    statusText.textContent = 'Waiting for broadcast...';
    
    // Register as a viewer
    sendSignal({
      type: 'viewer-join'
    });
  };

  socket.onmessage = async (message) => {
    try {
      const data = JSON.parse(message.data);

      switch (data.type) {
        case 'viewer-offer':
          // Host sends broadcast WebRTC offer
          hostSocketId = data.socketId; // Track dashboard socket ID to send answers/candidates back
          await handleHostOffer(data.sdp);
          break;

        case 'viewer-dashboard-candidate':
          // Host sends an ICE candidate
          if (peerConnection) {
            await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
          }
          break;

        case 'kick':
          statusDot.className = 'status-dot off';
          statusText.textContent = 'Disconnected';
          resetUI();
          break;
      }
    } catch (err) {
      console.error('Error processing signaling message:', err);
    }
  };

  socket.onclose = () => {
    statusDot.className = 'status-dot off';
    statusText.textContent = 'Offline';
    resetUI();
    // Try to reconnect after a delay
    setTimeout(connectToHost, 3000);
  };
}

// -------------------------------------------------------------
// WebRTC Handshake & Playback
// -------------------------------------------------------------
async function handleHostOffer(sdp) {
  if (peerConnection) {
    peerConnection.close();
  }

  peerConnection = new RTCPeerConnection(rtcConfig);

  // Send our gathered ICE candidates to the host
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      sendSignal({
        type: 'viewer-candidate',
        targetSocketId: hostSocketId,
        candidate: event.candidate
      });
    }
  };

  // Play incoming broadcast tracks
  peerConnection.ontrack = (event) => {
    console.log('Received live stream track:', event.track.kind);
    if (event.streams && event.streams[0]) {
      liveVideo.srcObject = event.streams[0];
      
      // Update UI to playing
      noStreamMessage.style.display = 'none';
      liveVideo.classList.add('active');
      
      statusDot.className = 'status-dot live';
      statusText.textContent = 'LIVE';
    }
  };

  try {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    sendSignal({
      type: 'viewer-answer',
      targetSocketId: hostSocketId,
      sdp: answer
    });
  } catch (err) {
    console.error('Failed to handle WebRTC offer:', err);
  }
}

// Helper signaling method
function sendSignal(payload) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
}

function resetUI() {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  liveVideo.srcObject = null;
  liveVideo.classList.remove('active');
  noStreamMessage.style.display = 'flex';
}

// Start connection on page load
connectToHost();
