// Blame Allocation App
// State management with Firebase (cloud) and localStorage (fallback)

const APP_STORAGE_KEY = 'blameAllocationApp';
const FIREBASE_DATA_PATH = 'blameAllocationApp';

// Default titles
const DEFAULT_TITLE = 'מי אשם בנפילת הדמוקרטיה בישראל?';
const DEFAULT_SUBTITLE = 'חלקו 100% אחריות בין הגורמים השונים';

// Application State
let state = {
    options: [], // { id: string, name: string }
    votes: [],   // { allocations: { [optionId]: number }, name: string, email: string }
    votedEmails: [], // List of emails that have already voted
    currentAllocations: {}, // Current user's allocation before submitting
    currentUser: null, // { name: string, email: string }
    title: DEFAULT_TITLE,
    subtitle: DEFAULT_SUBTITLE
};

// Loading overlay element
let loadingOverlay = null;

// Check if admin mode via URL parameter
function isAdminMode() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('admin') === 'true';
}

// DOM Elements
const elements = {
    // Entrance elements
    entrancePanel: document.getElementById('entrancePanel'),
    entranceForm: document.getElementById('entranceForm'),
    userName: document.getElementById('userName'),
    userEmail: document.getElementById('userEmail'),
    emailError: document.getElementById('emailError'),
    enterBtn: document.getElementById('enterBtn'),
    alreadyVotedMessage: document.getElementById('alreadyVotedMessage'),
    mainApp: document.getElementById('mainApp'),

    // Mode toggle (admin only)
    modeToggle: document.getElementById('modeToggle'),
    userModeBtn: document.getElementById('userModeBtn'),
    adminModeBtn: document.getElementById('adminModeBtn'),

    // Panels
    adminPanel: document.getElementById('adminPanel'),
    userPanel: document.getElementById('userPanel'),
    resultsPanel: document.getElementById('resultsPanel'),

    // Admin elements
    editMainTitle: document.getElementById('editMainTitle'),
    editSubtitle: document.getElementById('editSubtitle'),
    saveTitlesBtn: document.getElementById('saveTitlesBtn'),
    mainTitle: document.getElementById('mainTitle'),
    mainSubtitle: document.getElementById('mainSubtitle'),
    newOptionInput: document.getElementById('newOptionInput'),
    addOptionBtn: document.getElementById('addOptionBtn'),
    optionsList: document.getElementById('optionsList'),
    resetResultsBtn: document.getElementById('resetResultsBtn'),
    exportDataBtn: document.getElementById('exportDataBtn'),

    // User elements
    noOptionsMessage: document.getElementById('noOptionsMessage'),
    allocationForm: document.getElementById('allocationForm'),
    sliderContainer: document.getElementById('sliderContainer'),
    totalPercentage: document.getElementById('totalPercentage'),
    totalStatus: document.getElementById('totalStatus'),
    submitVoteBtn: document.getElementById('submitVoteBtn'),

    // Results elements
    resultsContainer: document.getElementById('resultsContainer'),
    voteCount: document.getElementById('voteCount'),

    // Thank you message
    thankYouMessage: document.getElementById('thankYouMessage'),
    voteAgainBtn: document.getElementById('voteAgainBtn')
};

// Initialize the application
async function init() {
    loadingOverlay = document.getElementById('loadingOverlay');

    try {
        await loadState();
    } catch (e) {
        console.error('Error loading state:', e);
    }

    setupEventListeners();
    render();

    // Check if admin mode
    if (isAdminMode()) {
        initAdminMode();
    } else {
        initUserMode();
    }

    // Hide loading overlay
    hideLoading();

    // Setup real-time listener for Firebase
    if (typeof firebaseEnabled !== 'undefined' && firebaseEnabled && db) {
        setupFirebaseListener();
    }
}

// Show loading overlay
function showLoading() {
    if (loadingOverlay) {
        loadingOverlay.classList.remove('hidden');
    }
}

// Hide loading overlay
function hideLoading() {
    if (loadingOverlay) {
        loadingOverlay.classList.add('hidden');
    }
}

// Setup Firebase real-time listener
function setupFirebaseListener() {
    db.ref(FIREBASE_DATA_PATH).on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            state.options = data.options || [];
            state.votes = data.votes || [];
            state.votedEmails = data.votedEmails || [];
            state.title = data.title || DEFAULT_TITLE;
            state.subtitle = data.subtitle || DEFAULT_SUBTITLE;

            // Re-initialize current allocations
            resetCurrentAllocations();
            updateTitlesDisplay();
            render();

            // Re-populate admin fields if in admin mode
            if (isAdminMode()) {
                elements.editMainTitle.value = state.title;
                elements.editSubtitle.value = state.subtitle;
            }
        }
    });
}

// Initialize admin mode - skip entrance, show admin controls
function initAdminMode() {
    elements.entrancePanel.classList.add('hidden');
    elements.mainApp.classList.remove('hidden');
    elements.modeToggle.classList.remove('hidden');
    elements.adminPanel.classList.remove('hidden');
    elements.userPanel.classList.add('hidden');
    elements.adminModeBtn.classList.add('active');
    elements.userModeBtn.classList.remove('active');

    // Populate title edit fields with current values
    elements.editMainTitle.value = state.title;
    elements.editSubtitle.value = state.subtitle;
}

// Initialize user mode - show entrance, hide admin controls
function initUserMode() {
    elements.entrancePanel.classList.remove('hidden');
    elements.mainApp.classList.add('hidden');
    elements.modeToggle.classList.add('hidden');
    elements.adminPanel.classList.add('hidden');
}

// Load state from Firebase or localStorage
async function loadState() {
    // Try Firebase first
    if (typeof firebaseEnabled !== 'undefined' && firebaseEnabled && db) {
        try {
            const snapshot = await db.ref(FIREBASE_DATA_PATH).once('value');
            const data = snapshot.val();
            if (data) {
                state.options = data.options || [];
                state.votes = data.votes || [];
                state.votedEmails = data.votedEmails || [];
                state.title = data.title || DEFAULT_TITLE;
                state.subtitle = data.subtitle || DEFAULT_SUBTITLE;
                console.log('State loaded from Firebase');
            }
        } catch (e) {
            console.error('Error loading from Firebase:', e);
            loadFromLocalStorage();
        }
    } else {
        loadFromLocalStorage();
    }

    // Initialize current allocations
    resetCurrentAllocations();

    // Apply titles to header
    updateTitlesDisplay();
}

// Load from localStorage (fallback)
function loadFromLocalStorage() {
    try {
        const saved = localStorage.getItem(APP_STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            state.options = parsed.options || [];
            state.votes = parsed.votes || [];
            state.votedEmails = parsed.votedEmails || [];
            state.title = parsed.title || DEFAULT_TITLE;
            state.subtitle = parsed.subtitle || DEFAULT_SUBTITLE;
            console.log('State loaded from localStorage');
        }
    } catch (e) {
        console.error('Error loading from localStorage:', e);
    }
}

// Save state to Firebase and localStorage
function saveState() {
    const dataToSave = {
        options: state.options,
        votes: state.votes,
        votedEmails: state.votedEmails,
        title: state.title,
        subtitle: state.subtitle
    };

    // Save to Firebase if available
    if (typeof firebaseEnabled !== 'undefined' && firebaseEnabled && db) {
        db.ref(FIREBASE_DATA_PATH).set(dataToSave)
            .then(() => console.log('State saved to Firebase'))
            .catch((e) => console.error('Error saving to Firebase:', e));
    }

    // Always save to localStorage as backup
    try {
        localStorage.setItem(APP_STORAGE_KEY, JSON.stringify(dataToSave));
    } catch (e) {
        console.error('Error saving to localStorage:', e);
    }
}

// Update titles display in header
function updateTitlesDisplay() {
    elements.mainTitle.textContent = state.title;
    elements.mainSubtitle.textContent = state.subtitle;
    document.title = state.title;
}

// Save titles (admin)
function saveTitles() {
    const newTitle = elements.editMainTitle.value.trim();
    const newSubtitle = elements.editSubtitle.value.trim();

    if (newTitle) {
        state.title = newTitle;
    }
    if (newSubtitle) {
        state.subtitle = newSubtitle;
    }

    saveState();
    updateTitlesDisplay();
}

// Reset current allocations to zero
function resetCurrentAllocations() {
    state.currentAllocations = {};
    state.options.forEach(option => {
        state.currentAllocations[option.id] = 0;
    });
}

// Generate unique ID
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Setup event listeners
function setupEventListeners() {
    // Entrance form
    elements.entranceForm.addEventListener('submit', handleEntranceSubmit);
    elements.userEmail.addEventListener('input', clearEmailError);

    // Mode toggle
    elements.userModeBtn.addEventListener('click', () => switchMode('user'));
    elements.adminModeBtn.addEventListener('click', () => switchMode('admin'));

    // Admin actions - titles
    elements.saveTitlesBtn.addEventListener('click', saveTitles);

    // Admin actions - options
    elements.addOptionBtn.addEventListener('click', addOption);
    elements.newOptionInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addOption();
    });
    elements.resetResultsBtn.addEventListener('click', resetResults);
    elements.exportDataBtn.addEventListener('click', exportData);

    // User actions
    elements.submitVoteBtn.addEventListener('click', submitVote);
}

// Validate email format
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Check if email has already voted
function hasAlreadyVoted(email) {
    const normalizedEmail = email.toLowerCase().trim();
    return state.votedEmails.includes(normalizedEmail);
}

// Clear email error message
function clearEmailError() {
    elements.emailError.classList.add('hidden');
    elements.emailError.textContent = '';
    elements.userEmail.classList.remove('error');
    elements.alreadyVotedMessage.classList.add('hidden');
    elements.entranceForm.classList.remove('hidden');
}

// Handle entrance form submission
function handleEntranceSubmit(e) {
    e.preventDefault();

    const name = elements.userName.value.trim();
    const email = elements.userEmail.value.trim();

    // Validate email format
    if (!isValidEmail(email)) {
        elements.emailError.textContent = 'אנא הזינו כתובת אימייל תקינה';
        elements.emailError.classList.remove('hidden');
        elements.userEmail.classList.add('error');
        return;
    }

    // Check if email has already voted
    if (hasAlreadyVoted(email)) {
        elements.entranceForm.classList.add('hidden');
        elements.alreadyVotedMessage.classList.remove('hidden');
        return;
    }

    // Store current user and proceed to voting
    state.currentUser = {
        name: name,
        email: email.toLowerCase().trim()
    };

    // Show main app
    elements.entrancePanel.classList.add('hidden');
    elements.mainApp.classList.remove('hidden');
}

// Switch between user and admin mode (admin only)
function switchMode(mode) {
    if (!isAdminMode()) return; // Only allow mode switch in admin mode

    if (mode === 'user') {
        elements.userModeBtn.classList.add('active');
        elements.adminModeBtn.classList.remove('active');
        elements.adminPanel.classList.add('hidden');
        elements.userPanel.classList.remove('hidden');
    } else {
        elements.adminModeBtn.classList.add('active');
        elements.userModeBtn.classList.remove('active');
        elements.userPanel.classList.add('hidden');
        elements.adminPanel.classList.remove('hidden');
    }
}

// Add new option (admin)
function addOption() {
    const name = elements.newOptionInput.value.trim();
    if (!name) return;

    const option = {
        id: generateId(),
        name: name
    };

    state.options.push(option);
    state.currentAllocations[option.id] = 0;
    elements.newOptionInput.value = '';

    saveState();
    render();
}

// Delete option (admin)
function deleteOption(id) {
    if (!confirm('האם למחוק אפשרות זו?')) return;

    state.options = state.options.filter(o => o.id !== id);
    delete state.currentAllocations[id];

    // Remove from existing votes
    state.votes.forEach(vote => {
        delete vote.allocations[id];
    });

    saveState();
    render();
}

// Update option name (admin)
function updateOptionName(id, newName) {
    const option = state.options.find(o => o.id === id);
    if (option) {
        option.name = newName.trim();
        saveState();
    }
}

// Reset all results (admin)
function resetResults() {
    if (!confirm('האם לאפס את כל התוצאות? פעולה זו לא ניתנת לביטול.')) return;

    state.votes = [];
    saveState();
    renderResults();
}

// Export data (admin)
function exportData() {
    const data = {
        options: state.options,
        votes: state.votes,
        results: calculateResults(),
        exportDate: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `blame-allocation-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

// Update allocation from slider with auto-balancing
function updateAllocation(id, value) {
    const newValue = parseInt(value) || 0;
    const oldValue = state.currentAllocations[id] || 0;
    const difference = newValue - oldValue;

    // Set the new value for the changed slider
    state.currentAllocations[id] = newValue;

    // Calculate total of OTHER sliders (excluding the one being changed)
    const otherIds = Object.keys(state.currentAllocations).filter(key => key !== id);
    const otherTotal = otherIds.reduce((sum, key) => sum + state.currentAllocations[key], 0);

    // Calculate total after change
    const total = newValue + otherTotal;

    // If total exceeds 100%, reduce other sliders proportionally
    if (total > 100 && otherTotal > 0) {
        const excess = total - 100;
        const reductionRatio = Math.min(excess / otherTotal, 1);

        otherIds.forEach(otherId => {
            const currentVal = state.currentAllocations[otherId];
            const reduction = Math.round(currentVal * reductionRatio);
            state.currentAllocations[otherId] = Math.max(0, currentVal - reduction);
        });

        // Fix rounding errors - ensure total is exactly 100
        const newTotal = Object.values(state.currentAllocations).reduce((sum, val) => sum + val, 0);
        if (newTotal > 100) {
            // Find the largest other slider and reduce it
            const largestOther = otherIds.reduce((max, key) =>
                state.currentAllocations[key] > state.currentAllocations[max] ? key : max
            , otherIds[0]);
            if (largestOther) {
                state.currentAllocations[largestOther] -= (newTotal - 100);
                state.currentAllocations[largestOther] = Math.max(0, state.currentAllocations[largestOther]);
            }
        }

        // Update all slider displays and inputs
        updateAllSliders();
    } else {
        updateSliderDisplay(id, newValue);
    }

    updateTotalDisplay();
}

// Update all sliders UI to match state
function updateAllSliders() {
    Object.entries(state.currentAllocations).forEach(([id, value]) => {
        updateSliderDisplay(id, value);
        // Update the actual slider input
        const slider = document.querySelector(`input[type="range"][oninput*="${id}"]`);
        if (slider) {
            slider.value = value;
        }
    });
}

// Update total display
function updateTotalDisplay() {
    const total = Object.values(state.currentAllocations).reduce((sum, val) => sum + val, 0);

    elements.totalPercentage.textContent = total + '%';

    if (total === 100) {
        elements.totalPercentage.className = 'total-value valid';
        elements.totalStatus.textContent = '✓';
        elements.totalStatus.className = 'total-status valid';
        elements.submitVoteBtn.disabled = false;
    } else if (total > 100) {
        elements.totalPercentage.className = 'total-value invalid';
        elements.totalStatus.textContent = `(${total - 100}% עודף)`;
        elements.totalStatus.className = 'total-status invalid';
        elements.submitVoteBtn.disabled = true;
    } else {
        elements.totalPercentage.className = 'total-value invalid';
        elements.totalStatus.textContent = `(חסרים ${100 - total}%)`;
        elements.totalStatus.className = 'total-status invalid';
        elements.submitVoteBtn.disabled = true;
    }
}

// Update slider display value
function updateSliderDisplay(id, value) {
    const valueDisplay = document.querySelector(`[data-value-for="${id}"]`);
    if (valueDisplay) {
        valueDisplay.textContent = value + '%';
    }
}

// Submit vote
function submitVote() {
    const total = Object.values(state.currentAllocations).reduce((sum, val) => sum + val, 0);
    if (total !== 100) return;
    if (!state.currentUser) return;

    // Add vote with user info
    state.votes.push({
        allocations: { ...state.currentAllocations },
        name: state.currentUser.name,
        email: state.currentUser.email,
        timestamp: new Date().toISOString()
    });

    // Mark email as voted
    state.votedEmails.push(state.currentUser.email);

    saveState();

    // Show thank you message
    elements.userPanel.classList.add('hidden');
    elements.thankYouMessage.classList.remove('hidden');

    renderResults();
}

// Calculate aggregated results
function calculateResults() {
    if (state.votes.length === 0 || state.options.length === 0) {
        return [];
    }

    const totals = {};
    state.options.forEach(option => {
        totals[option.id] = 0;
    });

    state.votes.forEach(vote => {
        Object.entries(vote.allocations).forEach(([id, value]) => {
            if (totals.hasOwnProperty(id)) {
                totals[id] += value;
            }
        });
    });

    const voteCount = state.votes.length;
    const results = state.options.map(option => ({
        id: option.id,
        name: option.name,
        average: voteCount > 0 ? (totals[option.id] / voteCount).toFixed(1) : 0
    }));

    // Sort by average descending
    results.sort((a, b) => parseFloat(b.average) - parseFloat(a.average));

    return results;
}

// Render functions
function render() {
    renderOptions();
    renderSliders();
    renderResults();
    updateTotalDisplay();
}

// Render admin options list
function renderOptions() {
    elements.optionsList.innerHTML = '';

    state.options.forEach(option => {
        const item = document.createElement('div');
        item.className = 'option-item';
        item.innerHTML = `
            <input type="text" value="${escapeHtml(option.name)}"
                   onchange="updateOptionName('${option.id}', this.value)"
                   onblur="updateOptionName('${option.id}', this.value)">
            <button class="delete-btn" onclick="deleteOption('${option.id}')" title="מחק">×</button>
        `;
        elements.optionsList.appendChild(item);
    });
}

// Shuffle array (Fisher-Yates algorithm)
function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// Render user sliders
function renderSliders() {
    if (state.options.length === 0) {
        elements.noOptionsMessage.classList.remove('hidden');
        elements.allocationForm.classList.add('hidden');
        return;
    }

    elements.noOptionsMessage.classList.add('hidden');
    elements.allocationForm.classList.remove('hidden');

    elements.sliderContainer.innerHTML = '';

    // Shuffle options for regular users, keep original order for admin
    const displayOptions = isAdminMode() ? state.options : shuffleArray(state.options);

    displayOptions.forEach(option => {
        const value = state.currentAllocations[option.id] || 0;
        const item = document.createElement('div');
        item.className = 'slider-item';
        item.innerHTML = `
            <div class="slider-header">
                <span class="slider-label">${escapeHtml(option.name)}</span>
                <span class="slider-value" data-value-for="${option.id}">${value}%</span>
            </div>
            <div class="slider-wrapper">
                <input type="range" min="0" max="100" value="${value}"
                       oninput="updateAllocation('${option.id}', this.value)">
            </div>
        `;
        elements.sliderContainer.appendChild(item);
    });
}

// Render results
function renderResults() {
    const results = calculateResults();

    if (results.length === 0 || state.votes.length === 0) {
        elements.resultsContainer.innerHTML = '<p class="message">אין תוצאות עדיין</p>';
        elements.voteCount.textContent = '';
        return;
    }

    elements.resultsContainer.innerHTML = '';

    results.forEach(result => {
        const item = document.createElement('div');
        item.className = 'result-item';
        item.innerHTML = `
            <div class="result-header">
                <span class="result-label">${escapeHtml(result.name)}</span>
                <span class="result-percentage">${result.average}%</span>
            </div>
            <div class="result-bar-container">
                <div class="result-bar" style="width: ${result.average}%"></div>
            </div>
        `;
        elements.resultsContainer.appendChild(item);
    });

    elements.voteCount.textContent = `סה"כ ${state.votes.length} הצבעות`;
}

// Utility: Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Social Media Sharing Functions
function getShareUrl() {
    // Remove admin parameter if present
    const url = new URL(window.location.href);
    url.searchParams.delete('admin');
    return url.toString();
}

function getShareText() {
    return `${state.title} - בואו להצביע גם אתם!`;
}

function shareOnWhatsApp() {
    const url = encodeURIComponent(getShareUrl());
    const text = encodeURIComponent(getShareText());
    window.open(`https://wa.me/?text=${text}%20${url}`, '_blank');
}

function shareOnFacebook() {
    const url = encodeURIComponent(getShareUrl());
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank', 'width=600,height=400');
}

function shareOnTwitter() {
    const url = encodeURIComponent(getShareUrl());
    const text = encodeURIComponent(getShareText());
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank', 'width=600,height=400');
}

function shareOnTelegram() {
    const url = encodeURIComponent(getShareUrl());
    const text = encodeURIComponent(getShareText());
    window.open(`https://t.me/share/url?url=${url}&text=${text}`, '_blank');
}

function copyShareLink() {
    const url = getShareUrl();
    navigator.clipboard.writeText(url).then(() => {
        // Show feedback
        const feedback = document.querySelector('.copy-feedback');
        if (feedback) {
            feedback.classList.remove('hidden');
            setTimeout(() => {
                feedback.classList.add('hidden');
            }, 2000);
        }
    }).catch(err => {
        console.error('Failed to copy:', err);
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = url;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);

        const feedback = document.querySelector('.copy-feedback');
        if (feedback) {
            feedback.classList.remove('hidden');
            setTimeout(() => {
                feedback.classList.add('hidden');
            }, 2000);
        }
    });
}

// Make functions available globally for inline handlers
window.updateOptionName = updateOptionName;
window.deleteOption = deleteOption;
window.updateAllocation = updateAllocation;
window.shareOnWhatsApp = shareOnWhatsApp;
window.shareOnFacebook = shareOnFacebook;
window.shareOnTwitter = shareOnTwitter;
window.shareOnTelegram = shareOnTelegram;
window.copyShareLink = copyShareLink;

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', init);
