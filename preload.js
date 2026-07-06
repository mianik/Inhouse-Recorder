const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Screen Capture Sources
  getSources: () => ipcRenderer.invoke('get-sources'),
  
  // Recording State Sync & Commands
  startRecording: (sourceId) => ipcRenderer.send('start-recording', sourceId),
  stopRecording: () => ipcRenderer.send('stop-recording'),
  pauseRecording: () => ipcRenderer.send('pause-recording'),
  resumeRecording: () => ipcRenderer.send('resume-recording'),
  cancelRecording: () => ipcRenderer.send('cancel-recording'),
  toggleMic: (isMuted) => ipcRenderer.send('toggle-mic', isMuted),
  
  // Save/Retrieve Recording Files
  saveVideoChunk: (arrayBuffer) => ipcRenderer.invoke('save-video-chunk', arrayBuffer),
  finalizeRecording: (metadata) => ipcRenderer.invoke('finalize-recording', metadata),
  getRecordings: () => ipcRenderer.invoke('get-recordings'),
  deleteRecording: (filename) => ipcRenderer.invoke('delete-recording', filename),
  openRecordingFolder: (filename) => ipcRenderer.invoke('open-recording-folder', filename),
  exportRecording: (filename) => ipcRenderer.invoke('export-recording', filename),
  saveScreenshot: (arrayBuffer, filename) => ipcRenderer.invoke('save-screenshot', arrayBuffer, filename),
  
  // Settings & System Dialogs
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  
  // Camera Bubble Control
  showCameraBubble: () => ipcRenderer.send('show-camera-bubble'),
  hideCameraBubble: () => ipcRenderer.send('hide-camera-bubble'),
  setCameraBubbleSize: (size) => ipcRenderer.send('set-camera-bubble-size', size),
  
  // Controls Overlay Control
  showControls: () => ipcRenderer.send('show-controls'),
  hideControls: () => ipcRenderer.send('hide-controls'),
  updateControlsState: (state) => ipcRenderer.send('update-controls-state', state),
  
  // Source Selection Control
  openSelector: () => ipcRenderer.send('open-selector'),
  closeSelector: (selectedSourceId) => ipcRenderer.send('close-selector', selectedSourceId),
  cancelSelector: () => ipcRenderer.send('cancel-selector'),

  // Collaboration Controls
  startCollaborationServer: () => ipcRenderer.invoke('start-collaboration-server'),
  stopCollaborationServer: () => ipcRenderer.invoke('stop-collaboration-server'),
  sendCollaborationSignal: (signal) => ipcRenderer.send('send-collaboration-signal', signal),

  // Annotation Overlay Controls
  setAnnotationMode: (mode) => ipcRenderer.send('set-annotation-mode', mode),
  setSpotlightMode: (active) => ipcRenderer.send('set-spotlight-mode', active),
  clearAnnotations: () => ipcRenderer.send('clear-annotations'),
  captureScreenshot: () => ipcRenderer.send('capture-screenshot'),
  
  // Event Listeners
  onRecordingAction: (callback) => {
    const subscription = (event, action) => callback(action);
    ipcRenderer.on('recording-action', subscription);
    return () => ipcRenderer.removeListener('recording-action', subscription);
  },
  
  onControlsStateChange: (callback) => {
    const subscription = (event, state) => callback(state);
    ipcRenderer.on('controls-state-change', subscription);
    return () => ipcRenderer.removeListener('controls-state-change', subscription);
  },

  onCollaborationEvent: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('collaboration-event', subscription);
    return () => ipcRenderer.removeListener('collaboration-event', subscription);
  },

  onAnnotationCommand: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('annotation-command', subscription);
    return () => ipcRenderer.removeListener('annotation-command', subscription);
  },

  onScreenshotCommand: (callback) => {
    const subscription = (event) => callback();
    ipcRenderer.on('screenshot-command', subscription);
    return () => ipcRenderer.removeListener('screenshot-command', subscription);
  },

  // RTMP Streaming
  startRtmpStream: (rtmpUrl, streamKey) => ipcRenderer.invoke('start-rtmp-stream', rtmpUrl, streamKey),
  sendRtmpChunk: (buffer) => ipcRenderer.send('send-rtmp-chunk', buffer),
  stopRtmpStream: () => ipcRenderer.invoke('stop-rtmp-stream'),
  onRtmpStatus: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('rtmp-status', subscription);
    return () => ipcRenderer.removeListener('rtmp-status', subscription);
  }
});
