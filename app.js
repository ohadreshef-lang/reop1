// Blame Allocation App
// State management with localStorage persistence

const APP_STORAGE_KEY = 'blameAllocationApp';

// Application State
let state = {
    options: [], // { id: string, name: string }
    votes: [],   // { allocations: { [optionId]: number } }
    currentAllocations: {} // Current user's allocation before submitting
};

// DOM Elements
const elements = {
    // Mode buttons
    userModeBtn: document.getElementById('userModeBtn'),
    adminModeBtn: document.getElementById('adminModeBtn'),

    // Panels
    adminPanel: document.getElementById('adminPanel'),
    userPanel: document.getElementById('userPanel'),
    resultsPanel: document.getElementById('resultsPanel'),

    // Admin elements
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
function init() {
    loadState();
    setupEventListeners();
    render();
}

// Load state from localStorage
function loadState() {
    try {
        const saved = localStorage.getItem(APP_STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            state.options = parsed.options || [];
            state.votes = parsed.votes || [];
        }
    } catch (e) {
        console.error('Error loading state:', e);
    }

    // Initialize current allocations
    resetCurrentAllocations();
}

// Save state to localStorage
function saveState() {
    try {
        localStorage.setItem(APP_STORAGE_KEY, JSON.stringify({
            options: state.options,
            votes: state.votes
        }));
    } catch (e) {
        console.error('Error saving state:', e);
    }
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
    // Mode toggle
    elements.userModeBtn.addEventListener('click', () => switchMode('user'));
    elements.adminModeBtn.addEventListener('click', () => switchMode('admin'));

    // Admin actions
    elements.addOptionBtn.addEventListener('click', addOption);
    elements.newOptionInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addOption();
    });
    elements.resetResultsBtn.addEventListener('click', resetResults);
    elements.exportDataBtn.addEventListener('click', exportData);

    // User actions
    elements.submitVoteBtn.addEventListener('click', submitVote);
    elements.voteAgainBtn.addEventListener('click', voteAgain);
}

// Switch between user and admin mode
function switchMode(mode) {
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

    state.votes.push({
        allocations: { ...state.currentAllocations },
        timestamp: new Date().toISOString()
    });

    saveState();

    // Show thank you message
    elements.userPanel.classList.add('hidden');
    elements.thankYouMessage.classList.remove('hidden');

    renderResults();
}

// Vote again
function voteAgain() {
    resetCurrentAllocations();
    elements.thankYouMessage.classList.add('hidden');
    elements.userPanel.classList.remove('hidden');
    renderSliders();
    updateTotalDisplay();
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

    state.options.forEach(option => {
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

// Make functions available globally for inline handlers
window.updateOptionName = updateOptionName;
window.deleteOption = deleteOption;
window.updateAllocation = updateAllocation;

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', init);
