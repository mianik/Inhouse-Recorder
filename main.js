const { app, BrowserWindow, ipcMain, desktopCapturer, dialog, shell, protocol, net, systemPreferences } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const ws = require('ws');
const os = require('os');
const { spawn } = require('child_process');

let dashboardWindow = null;
let selectorWindow = null;
let cameraBubbleWindow = null;
let controlsWindow = null;
let annotationWindow = null;

// Collaboration Server State
let httpServer = null;
let wsServer = null;
const activeSockets = new Set();

// Paths
const DEFAULT_SAVE_DIR = path.join(app.getPath('videos'), 'InhouseRecorder');
const CONFIG_FILE = path.join(app.getPath('userData'), 'config.json');

// Ensure recordings directory exists
if (!fs.existsSync(DEFAULT_SAVE_DIR)) {
  fs.mkdirSync(DEFAULT_SAVE_DIR, { recursive: true });
}

// Generate random IDs for signaling client tracking
function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

// Load Settings
function loadSettings() {
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
      return JSON.parse(data);
    } catch (e) {
      console.error('Failed to load settings', e);
    }
  }
  return {
    saveDirectory: DEFAULT_SAVE_DIR,
    microphoneId: 'default',
    cameraId: '',
    resolution: '1080p',
    fps: 30
  };
}

// Save Settings
function saveSettings(settings) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(settings, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error('Failed to save settings', e);
    return false;
  }
}

// Get Local Network IP
function getNetworkIP() {
  const interfaces = os.networkInterfaces();
  for (let ifaceName in interfaces) {
    const iface = interfaces[ifaceName];
    for (let i = 0; i < iface.length; i++) {
      const alias = iface[i];
      if (alias.family === 'IPv4' && !alias.internal) {
        return alias.address;
      }
    }
  }
  return 'localhost';
}

// Check and request camera/microphone permissions (macOS specific)
async function checkAndAskPermissions() {
  if (process.platform === 'darwin') {
    try {
      // Camera permission request
      const cameraStatus = systemPreferences.getMediaAccessStatus('camera');
      if (cameraStatus === 'not-determined') {
        await systemPreferences.askForMediaAccess('camera');
      }
      
      // Microphone permission request
      const micStatus = systemPreferences.getMediaAccessStatus('microphone');
      if (micStatus === 'not-determined') {
        await systemPreferences.askForMediaAccess('microphone');
      }
    } catch (error) {
      console.warn('System preferences API for media access check failed:', error);
    }
  }
}

// Create Main Dashboard Window
function createDashboardWindow() {
  dashboardWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    show: false,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  dashboardWindow.loadFile(path.join(__dirname, 'renderer/dashboard.html'));

  dashboardWindow.once('ready-to-show', () => {
    dashboardWindow.show();
  });

  dashboardWindow.on('closed', () => {
    dashboardWindow = null;
    stopCollaborationServer();
    app.quit();
  });
}

// Create Screen/Window Selector Window
function createSelectorWindow() {
  if (selectorWindow) {
    selectorWindow.focus();
    return;
  }

  selectorWindow = new BrowserWindow({
    width: 700,
    height: 550,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    parent: dashboardWindow,
    modal: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  selectorWindow.loadFile(path.join(__dirname, 'renderer/selector.html'));

  selectorWindow.on('closed', () => {
    selectorWindow = null;
  });
}

// Create Floating Camera Bubble Window
function createCameraBubbleWindow() {
  if (cameraBubbleWindow) {
    cameraBubbleWindow.focus();
    return;
  }

  const bubbleSize = 180;
  
  cameraBubbleWindow = new BrowserWindow({
    width: bubbleSize,
    height: bubbleSize,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    hasShadow: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (process.platform === 'darwin') {
    cameraBubbleWindow.setAlwaysOnTop(true, 'screen-saver');
  } else {
    cameraBubbleWindow.setAlwaysOnTop(true);
  }

  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { height } = primaryDisplay.workAreaSize;
  cameraBubbleWindow.setPosition(40, height - bubbleSize - 40);

  cameraBubbleWindow.loadFile(path.join(__dirname, 'renderer/camera.html'));

  cameraBubbleWindow.on('closed', () => {
    cameraBubbleWindow = null;
  });
}

// Create Floating Controls Window
function createControlsWindow() {
  if (controlsWindow) {
    controlsWindow.focus();
    return;
  }

  const width = 500; // Expanded width to fit annotation/spotlight/screenshot buttons
  const height = 75;

  controlsWindow = new BrowserWindow({
    width: width,
    height: height,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    hasShadow: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (process.platform === 'darwin') {
    controlsWindow.setAlwaysOnTop(true, 'screen-saver');
  } else {
    controlsWindow.setAlwaysOnTop(true);
  }

  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const displayHeight = primaryDisplay.workAreaSize.height;
  controlsWindow.setPosition(240, displayHeight - height - 40);

  controlsWindow.loadFile(path.join(__dirname, 'renderer/controls.html'));

  controlsWindow.on('closed', () => {
    controlsWindow = null;
  });
}

// Create Fullscreen Transparent Drawing/Annotation Window
function createAnnotationWindow() {
  if (annotationWindow) return;

  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.bounds;

  annotationWindow = new BrowserWindow({
    x: 0,
    y: 0,
    width: width,
    height: height,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    hasShadow: false,
    skipTaskbar: true,
    enableLargerThanScreen: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (process.platform === 'darwin') {
    annotationWindow.setAlwaysOnTop(true, 'floating');
  } else {
    annotationWindow.setAlwaysOnTop(true);
  }
  annotationWindow.setIgnoreMouseEvents(true, { forward: true });
  annotationWindow.loadFile(path.join(__dirname, 'renderer/annotation.html'));

  annotationWindow.on('closed', () => {
    annotationWindow = null;
  });
}

// -------------------------------------------------------------
// Collaboration Server Implementation
// -------------------------------------------------------------
function startCollaborationServer() {
  if (httpServer) return { success: true, url: `http://${getNetworkIP()}:9090/` };
  
  const port = 9090;
  const ip = getNetworkIP();
  
  try {
    httpServer = http.createServer((req, res) => {
      const url = req.url;
      if (url === '/join' || url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(fs.readFileSync(path.join(__dirname, 'renderer/join.html')));
      } else if (url === '/join.css') {
        res.writeHead(200, { 'Content-Type': 'text/css' });
        res.end(fs.readFileSync(path.join(__dirname, 'renderer/join.css')));
      } else if (url === '/join.js') {
        res.writeHead(200, { 'Content-Type': 'application/javascript' });
        res.end(fs.readFileSync(path.join(__dirname, 'renderer/join.js')));
      } else if (url === '/live') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(fs.readFileSync(path.join(__dirname, 'renderer/live.html')));
      } else if (url === '/live.css') {
        res.writeHead(200, { 'Content-Type': 'text/css' });
        res.end(fs.readFileSync(path.join(__dirname, 'renderer/live.css')));
      } else if (url === '/live.js') {
        res.writeHead(200, { 'Content-Type': 'application/javascript' });
        res.end(fs.readFileSync(path.join(__dirname, 'renderer/live.js')));
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    });

    wsServer = new ws.WebSocketServer({ server: httpServer });

    wsServer.on('connection', (socket) => {
      const socketId = generateId();
      socket.id = socketId;
      activeSockets.add(socket);

      socket.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          data.socketId = socket.id;

          if (['join', 'offer', 'candidate', 'screen-offer', 'screen-candidate', 'viewer-join', 'viewer-answer', 'viewer-candidate'].includes(data.type)) {
            if (dashboardWindow) {
              dashboardWindow.webContents.send('collaboration-event', data);
            }
          } 
          else if (['answer', 'dashboard-candidate', 'screen-answer', 'screen-dashboard-candidate', 'kick', 'viewer-offer', 'viewer-dashboard-candidate'].includes(data.type)) {
            for (let s of activeSockets) {
              if (s.id === data.targetSocketId) {
                s.send(JSON.stringify(data));
                break;
              }
            }
          }
        } catch (err) {
          console.error('Failed processing socket message', err);
        }
      });

      socket.on('close', () => {
        activeSockets.delete(socket);
        if (dashboardWindow) {
          dashboardWindow.webContents.send('collaboration-event', {
            type: 'disconnect',
            socketId: socket.id
          });
        }
      });
    });

    httpServer.listen(port);
    console.log(`Collaboration server running at http://${ip}:${port}`);
    return { success: true, url: `http://${ip}:${port}/` };
  } catch (err) {
    console.error('Failed to start collaboration server', err);
    return { success: false, error: err.message };
  }
}

function stopCollaborationServer() {
  if (wsServer) {
    wsServer.close();
    wsServer = null;
  }
  if (httpServer) {
    httpServer.close();
    httpServer = null;
  }
  
  for (let s of activeSockets) {
    s.close();
  }
  activeSockets.clear();
  return { success: true };
}

// -------------------------------------------------------------
// IPC Handlers
// -------------------------------------------------------------

// Capture Sources
ipcMain.handle('get-sources', async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['window', 'screen'],
      thumbnailSize: { width: 300, height: 200 },
      fetchWindowIcons: true
    });

    return sources.map(source => ({
      id: source.id,
      name: source.name,
      thumbnail: source.thumbnail.toDataURL(),
      appIcon: (source.appIcon && !source.appIcon.isEmpty()) ? source.appIcon.toDataURL() : null
    }));
  } catch (error) {
    console.error('get-sources failed:', error);
    throw new Error('Screen Recording Permission Denied. Please enable Screen Recording permissions in macOS System Settings > Privacy & Security.');
  }
});

// Settings & Dialogs
ipcMain.handle('get-settings', () => {
  return loadSettings();
});

ipcMain.handle('save-settings', (event, settings) => {
  return saveSettings(settings);
});

ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog(dashboardWindow, {
    properties: ['openDirectory', 'createDirectory']
  });
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

// Collaboration IPCs
ipcMain.handle('start-collaboration-server', () => {
  return startCollaborationServer();
});

ipcMain.handle('stop-collaboration-server', () => {
  return stopCollaborationServer();
});

ipcMain.on('send-collaboration-signal', (event, signal) => {
  for (let s of activeSockets) {
    if (s.id === signal.targetSocketId) {
      s.send(JSON.stringify(signal));
      break;
    }
  }
});

// Selector Control
ipcMain.on('open-selector', () => {
  createSelectorWindow();
});

ipcMain.on('close-selector', (event, selectedSourceId) => {
  if (selectorWindow) {
    selectorWindow.close();
  }
  if (dashboardWindow && selectedSourceId) {
    dashboardWindow.webContents.send('recording-action', {
      type: 'SOURCE_SELECTED',
      sourceId: selectedSourceId
    });
  }
});

ipcMain.on('cancel-selector', () => {
  if (selectorWindow) {
    selectorWindow.close();
  }
});

// Recording Control Relay
ipcMain.on('start-recording', (event, sourceId) => {
  if (dashboardWindow) {
    dashboardWindow.hide();
  }
  // Open transparent annotation overlay on start
  createAnnotationWindow();
});

ipcMain.on('countdown-complete', () => {
  if (dashboardWindow) {
    dashboardWindow.webContents.send('countdown-complete');
  }
});

ipcMain.on('stop-recording', () => {
  if (dashboardWindow) {
    dashboardWindow.webContents.send('recording-action', { type: 'STOP' });
  }
});

ipcMain.on('pause-recording', () => {
  if (dashboardWindow) {
    dashboardWindow.webContents.send('recording-action', { type: 'PAUSE' });
  }
});

ipcMain.on('resume-recording', () => {
  if (dashboardWindow) {
    dashboardWindow.webContents.send('recording-action', { type: 'RESUME' });
  }
});

ipcMain.on('cancel-recording', () => {
  if (dashboardWindow) {
    dashboardWindow.webContents.send('recording-action', { type: 'CANCEL' });
  }
  closeRecordingOverlays();
  if (dashboardWindow) {
    dashboardWindow.show();
  }
});

ipcMain.on('toggle-mic', (event, isMuted) => {
  if (dashboardWindow) {
    dashboardWindow.webContents.send('recording-action', { type: 'TOGGLE_MIC', isMuted });
  }
});

// Annotation & Presentation Commands
ipcMain.on('set-annotation-mode', (event, mode) => {
  if (annotationWindow) {
    const active = mode !== 'none';
    // When drawing mode is active, catch mouse events. When inactive, ignore them and click-through.
    annotationWindow.setIgnoreMouseEvents(!active, { forward: !active });
    annotationWindow.webContents.send('annotation-command', { type: 'MODE', mode });
  }
});

ipcMain.on('set-spotlight-mode', (event, active) => {
  if (annotationWindow) {
    // If spotlight is active, ignore events is still toggled to draw highlights or clicks,
    // but typically we can allow it or toggle mouse capture. We'll set it to be click-through.
    annotationWindow.webContents.send('annotation-command', { type: 'SPOTLIGHT', active });
  }
});

ipcMain.on('clear-annotations', () => {
  if (annotationWindow) {
    annotationWindow.webContents.send('annotation-command', { type: 'CLEAR' });
  }
});

ipcMain.on('capture-screenshot', () => {
  if (dashboardWindow) {
    dashboardWindow.webContents.send('screenshot-command');
  }
});

ipcMain.handle('save-screenshot', async (event, arrayBuffer, filename) => {
  try {
    const settings = loadSettings();
    const saveDir = settings.saveDirectory || DEFAULT_SAVE_DIR;
    if (!fs.existsSync(saveDir)) {
      fs.mkdirSync(saveDir, { recursive: true });
    }
    const filePath = path.join(saveDir, filename);
    fs.writeFileSync(filePath, Buffer.from(arrayBuffer));
    return { success: true, filePath };
  } catch (err) {
    console.error('Failed to save screenshot:', err);
    return { success: false, error: err.message };
  }
});

// Close all overlays
function closeRecordingOverlays() {
  if (cameraBubbleWindow) {
    cameraBubbleWindow.close();
    cameraBubbleWindow = null;
  }
  if (controlsWindow) {
    controlsWindow.close();
    controlsWindow = null;
  }
  if (annotationWindow) {
    annotationWindow.close();
    annotationWindow = null;
  }
}

// Camera Bubble control
ipcMain.on('show-camera-bubble', () => {
  createCameraBubbleWindow();
});

ipcMain.on('hide-camera-bubble', () => {
  if (cameraBubbleWindow) {
    cameraBubbleWindow.close();
    cameraBubbleWindow = null;
  }
});

ipcMain.on('set-camera-bubble-size', (event, size) => {
  if (!cameraBubbleWindow) return;
  
  let newSize = 180;
  if (size === 'medium') newSize = 280;
  if (size === 'large') newSize = 400;

  cameraBubbleWindow.setSize(newSize, newSize);
});

// Floating controls control
ipcMain.on('show-controls', () => {
  createControlsWindow();
});

ipcMain.on('hide-controls', () => {
  if (controlsWindow) {
    controlsWindow.close();
    controlsWindow = null;
  }
});

ipcMain.on('update-controls-state', (event, state) => {
  if (controlsWindow) {
    controlsWindow.webContents.send('controls-state-change', state);
  }
});

// Video chunk management
let activeChunks = [];

ipcMain.handle('save-video-chunk', (event, arrayBuffer) => {
  activeChunks.push(Buffer.from(arrayBuffer));
  return true;
});

ipcMain.handle('finalize-recording', async (event, metadata) => {
  try {
    const settings = loadSettings();
    const saveDir = settings.saveDirectory || DEFAULT_SAVE_DIR;

    if (!fs.existsSync(saveDir)) {
      fs.mkdirSync(saveDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `InhouseRecorder_Recording_${timestamp}.webm`;
    const filePath = path.join(saveDir, filename);

    // Concatenate chunks and write file
    const completeBuffer = Buffer.concat(activeChunks);
    fs.writeFileSync(filePath, completeBuffer);
    
    // Clear chunks cache
    activeChunks = [];

    // Save thumbnail image if provided
    let thumbnailPath = '';
    if (metadata.thumbnailData) {
      try {
        const base64Data = metadata.thumbnailData.replace(/^data:image\/jpeg;base64,/, "");
        const thumbFilename = `InhouseRecorder_Recording_${timestamp}.jpg`;
        thumbnailPath = path.join(saveDir, thumbFilename);
        fs.writeFileSync(thumbnailPath, Buffer.from(base64Data, 'base64'));
      } catch (err) {
        console.error('Failed to write thumbnail image to disk:', err);
      }
    }

    // Save metadata entry in a recordings.json inside the app support dir
    const recordingsIndexFile = path.join(app.getPath('userData'), 'recordings.json');
    let recordingsIndex = [];
    if (fs.existsSync(recordingsIndexFile)) {
      try {
        recordingsIndex = JSON.parse(fs.readFileSync(recordingsIndexFile, 'utf-8'));
      } catch (err) {
        console.error('Failed parsing index file', err);
      }
    }

    recordingsIndex.unshift({
      filename: filename,
      path: filePath,
      thumbnailPath: thumbnailPath,
      title: metadata.title || `Recording ${new Date().toLocaleString()}`,
      duration: metadata.duration || '0:00',
      timestamp: new Date().getTime(),
      size: completeBuffer.length
    });

    fs.writeFileSync(recordingsIndexFile, JSON.stringify(recordingsIndex, null, 2), 'utf-8');

    closeRecordingOverlays();
    
    if (dashboardWindow) {
      dashboardWindow.show();
      dashboardWindow.webContents.send('recording-action', { type: 'SAVED' });
    }

    return { success: true, filePath };
  } catch (error) {
    console.error('Error finalising recording:', error);
    activeChunks = [];
    closeRecordingOverlays();
    if (dashboardWindow) {
      dashboardWindow.show();
    }
    return { success: false, error: error.message };
  }
});

// Retrieve list of past recordings
ipcMain.handle('get-recordings', () => {
  const recordingsIndexFile = path.join(app.getPath('userData'), 'recordings.json');
  if (fs.existsSync(recordingsIndexFile)) {
    try {
      const data = fs.readFileSync(recordingsIndexFile, 'utf-8');
      const list = JSON.parse(data);
      const validatedList = list.filter(item => fs.existsSync(item.path));
      if (validatedList.length !== list.length) {
        fs.writeFileSync(recordingsIndexFile, JSON.stringify(validatedList, null, 2), 'utf-8');
      }
      return validatedList;
    } catch (e) {
      console.error(e);
      return [];
    }
  }
  return [];
});

// Delete recording
ipcMain.handle('delete-recording', (event, filename) => {
  const recordingsIndexFile = path.join(app.getPath('userData'), 'recordings.json');
  if (fs.existsSync(recordingsIndexFile)) {
    try {
      let list = JSON.parse(fs.readFileSync(recordingsIndexFile, 'utf-8'));
      const itemToDelete = list.find(item => item.filename === filename);
      if (itemToDelete) {
        if (fs.existsSync(itemToDelete.path)) {
          fs.unlinkSync(itemToDelete.path);
        }
        if (itemToDelete.thumbnailPath && fs.existsSync(itemToDelete.thumbnailPath)) {
          try {
            fs.unlinkSync(itemToDelete.thumbnailPath);
          } catch (err) {
            console.error('Failed to delete thumbnail file:', err);
          }
        }
        list = list.filter(item => item.filename !== filename);
        fs.writeFileSync(recordingsIndexFile, JSON.stringify(list, null, 2), 'utf-8');
        return true;
      }
    } catch (e) {
      console.error(e);
      return false;
    }
  }
  return false;
});

// Open Recording Folder in Finder
ipcMain.handle('open-recording-folder', (event, filename) => {
  const recordingsIndexFile = path.join(app.getPath('userData'), 'recordings.json');
  if (fs.existsSync(recordingsIndexFile)) {
    try {
      const list = JSON.parse(fs.readFileSync(recordingsIndexFile, 'utf-8'));
      const item = list.find(it => it.filename === filename);
      if (item && fs.existsSync(item.path)) {
        shell.showItemInFolder(item.path);
        return true;
      }
    } catch (e) {
      console.error(e);
    }
  }
  return false;
});

// Export recording to user-selected location
ipcMain.handle('export-recording', async (event, filename) => {
  const recordingsIndexFile = path.join(app.getPath('userData'), 'recordings.json');
  if (!fs.existsSync(recordingsIndexFile)) return { success: false, error: 'No recordings database exists.' };
  
  try {
    const list = JSON.parse(fs.readFileSync(recordingsIndexFile, 'utf-8'));
    const item = list.find(it => it.filename === filename);
    if (!item || !fs.existsSync(item.path)) {
      return { success: false, error: 'Recording file does not exist on disk.' };
    }
    
    // Suggest an .mp4 filename
    const suggestedFilename = filename.replace(/\.webm$/, '.mp4');
    
    const result = await dialog.showSaveDialog(dashboardWindow, {
      title: 'Export Recording to MP4',
      defaultPath: path.join(app.getPath('downloads'), suggestedFilename),
      filters: [
        { name: 'MP4 Video', extensions: ['mp4'] }
      ]
    });
    
    if (!result.canceled && result.filePath) {
      // Transcode WebM to high-compatibility H.264/AAC MP4 using FFmpeg
      const transcodeResult = await new Promise((resolve) => {
        const ffmpeg = spawn('ffmpeg', [
          '-i', item.path,
          '-c:v', 'libx264',
          '-preset', 'veryfast',
          '-pix_fmt', 'yuv420p',
          '-c:a', 'aac',
          '-y', // Overwrite if exists
          result.filePath
        ]);
        
        ffmpeg.on('error', (err) => {
          console.warn('FFmpeg transcode failed to spawn. Falling back to copy as webm:', err);
          resolve({ success: false, error: 'FFmpeg not found' });
        });
        
        ffmpeg.on('close', (code) => {
          if (code === 0) {
            resolve({ success: true });
          } else {
            resolve({ success: false, error: `FFmpeg exited with code ${code}` });
          }
        });
      });
      
      if (transcodeResult.success) {
        return { success: true, filePath: result.filePath };
      } else {
        // Fallback: copy WebM file directly if FFmpeg is not found/fails
        const fallbackPath = result.filePath.replace(/\.mp4$/, '.webm');
        fs.copyFileSync(item.path, fallbackPath);
        return { 
          success: true, 
          fallback: true, 
          filePath: fallbackPath, 
          error: 'FFmpeg was not found on your system. The file has been exported in its native WebM format instead.' 
        };
      }
    }
    return { success: false, canceled: true };
  } catch (error) {
    console.error('Failed to export recording:', error);
    return { success: false, error: error.message };
  }
});

let rtmpProcess = null;

ipcMain.handle('start-rtmp-stream', async (event, rtmpUrl, streamKey) => {
  if (rtmpProcess) {
    try {
      rtmpProcess.stdin.end();
      rtmpProcess.kill('SIGINT');
    } catch (e) {}
    rtmpProcess = null;
  }

  const fullUrl = `${rtmpUrl}/${streamKey}`;
  console.log('Starting RTMP Stream to:', rtmpUrl);

  const ffmpegArgs = [
    '-i', '-', // Pipe input from stdin
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-f', 'flv',
    fullUrl
  ];

  try {
    rtmpProcess = spawn('ffmpeg', ffmpegArgs);

    rtmpProcess.stdin.on('error', (err) => {
      console.error('rtmpProcess stdin error:', err);
    });

    rtmpProcess.stderr.on('data', (data) => {
      console.log('FFmpeg stderr:', data.toString());
    });

    rtmpProcess.on('close', (code) => {
      console.log('RTMP Stream FFmpeg process closed with code:', code);
      rtmpProcess = null;
      if (dashboardWindow) {
        dashboardWindow.webContents.send('rtmp-status', { status: 'stopped', code });
      }
    });

    return { success: true };
  } catch (err) {
    console.error('Failed to spawn FFmpeg:', err);
    return { success: false, error: 'Failed to spawn FFmpeg. Is FFmpeg installed on your path?' };
  }
});

ipcMain.on('send-rtmp-chunk', (event, arrayBuffer) => {
  if (rtmpProcess && rtmpProcess.stdin.writable) {
    const buffer = Buffer.from(arrayBuffer);
    rtmpProcess.stdin.write(buffer);
  }
});

ipcMain.handle('stop-rtmp-stream', async () => {
  if (rtmpProcess) {
    try {
      rtmpProcess.stdin.end();
      setTimeout(() => {
        if (rtmpProcess) {
          rtmpProcess.kill('SIGINT');
          rtmpProcess = null;
        }
      }, 500);
    } catch (e) {
      console.error('Failed to stop RTMP process cleanly:', e);
      rtmpProcess = null;
    }
  }
  return { success: true };
});

// Register custom protocol for local video playback
protocol.registerSchemesAsPrivileged([
  { scheme: 'video-stream', privileges: { bypassCSP: true, stream: true, supportFetchAPI: true, secure: true } }
]);

// App Lifecycle
app.whenReady().then(async () => {
  // Set app name
  app.name = "InhouseRecorder";
  
  // Prompt macOS system permissions on start
  await checkAndAskPermissions();
  
  // Register custom protocol handler
  protocol.handle('video-stream', (request) => {
    try {
      const url = new URL(request.url);
      const filePath = decodeURIComponent(url.pathname);
      return net.fetch('file://' + filePath);
    } catch (e) {
      console.error('Failed to stream video', e);
      return new Response('Error loading media', { status: 500 });
    }
  });

  createDashboardWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createDashboardWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
