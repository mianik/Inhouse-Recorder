let allSources = [];
let selectedSourceId = null;
let currentTab = 'screens'; // 'screens' or 'windows'

const sourceListEl = document.getElementById('sourceList');
const tabScreensBtn = document.getElementById('tabScreens');
const tabWindowsBtn = document.getElementById('tabWindows');
const confirmBtn = document.getElementById('confirmBtn');
const cancelBtn = document.getElementById('cancelBtn');
const closeBtn = document.getElementById('closeBtn');

// Fetch and load sources from main process
async function loadSources() {
  sourceListEl.innerHTML = '<div class="loading">Loading available sources...</div>';
  confirmBtn.disabled = true;
  selectedSourceId = null;
  
  try {
    allSources = await window.electronAPI.getSources();
    renderSources();
  } catch (error) {
    sourceListEl.innerHTML = `<div class="loading">Error loading sources: ${error.message}</div>`;
  }
}

// Render filtered sources
function renderSources() {
  sourceListEl.innerHTML = '';
  
  const filteredSources = allSources.filter(source => {
    if (currentTab === 'screens') {
      return source.id.startsWith('screen:');
    } else {
      return source.id.startsWith('window:');
    }
  });

  if (filteredSources.length === 0) {
    sourceListEl.innerHTML = `<div class="loading">No ${currentTab} found.</div>`;
    return;
  }

  filteredSources.forEach(source => {
    const card = document.createElement('div');
    card.className = `source-card ${selectedSourceId === source.id ? 'selected' : ''}`;
    card.dataset.id = source.id;

    // Thumbnail container
    const thumbContainer = document.createElement('div');
    thumbContainer.className = 'source-thumbnail-container';
    
    const thumbImg = document.createElement('img');
    thumbImg.className = 'source-thumbnail';
    thumbImg.src = source.thumbnail;
    thumbImg.alt = source.name;
    thumbContainer.appendChild(thumbImg);

    // Info section
    const info = document.createElement('div');
    info.className = 'source-info';

    if (source.appIcon) {
      const iconImg = document.createElement('img');
      iconImg.className = 'source-app-icon';
      iconImg.src = source.appIcon;
      info.appendChild(iconImg);
    }

    const name = document.createElement('span');
    name.className = 'source-name';
    name.textContent = source.name;
    info.appendChild(name);

    card.appendChild(thumbContainer);
    card.appendChild(info);

    card.addEventListener('click', () => {
      // Unselect previous card
      const previousSelected = sourceListEl.querySelector('.source-card.selected');
      if (previousSelected) {
        previousSelected.classList.remove('selected');
      }

      // Select this card
      card.classList.add('selected');
      selectedSourceId = source.id;
      confirmBtn.disabled = false;
    });

    // Double click to confirm instantly
    card.addEventListener('dblclick', () => {
      selectedSourceId = source.id;
      confirmSelection();
    });

    sourceListEl.appendChild(card);
  });
}

// Switch tabs
function setTab(tab) {
  if (currentTab === tab) return;
  currentTab = tab;
  
  if (tab === 'screens') {
    tabScreensBtn.classList.add('active');
    tabWindowsBtn.classList.remove('active');
  } else {
    tabWindowsBtn.classList.add('active');
    tabScreensBtn.classList.remove('active');
  }
  
  renderSources();
}

function confirmSelection() {
  if (selectedSourceId) {
    window.electronAPI.closeSelector(selectedSourceId);
  }
}

// Event Listeners
tabScreensBtn.addEventListener('click', () => setTab('screens'));
tabWindowsBtn.addEventListener('click', () => setTab('windows'));
confirmBtn.addEventListener('click', confirmSelection);
cancelBtn.addEventListener('click', () => window.electronAPI.cancelSelector());
closeBtn.addEventListener('click', () => window.electronAPI.cancelSelector());

// Initial load
loadSources();
