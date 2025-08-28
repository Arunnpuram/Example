/**
 * Popup script entry point for Skill Gap Analyzer Chrome Extension
 * 
 * This script handles the extension popup interface and user interactions.
 */

import { ProfileManager } from '@/core/profile-manager';
import { HistoryManager } from '@/core/history-manager';
import { validateSkill } from '@/utils/validation';
import { ChromeAnalyticsClient, PerformanceTracker, ErrorTracker } from '@/utils/analytics-client';
import type { 
  Skill, 
  SkillCategory, 
  ProficiencyLevel, 
  AnalysisHistoryEntry,
  ComparisonResult,
  SkillTrendData
} from '@/core/types';
import { SkillCategory as SkillCategoryEnum, ProficiencyLevel as ProficiencyLevelEnum } from '@/core/types';


console.log('🎨 Skill Gap Analyzer popup script loaded');

// DOM elements
let statusElement: HTMLElement | null = null;
let analyzeButton: HTMLElement | null = null;

// Profile management elements
let addSkillForm: HTMLFormElement | null = null;
let skillsList: HTMLElement | null = null;
let categoryFilter: HTMLSelectElement | null = null;
let importModal: HTMLElement | null = null;
let resumeTextArea: HTMLTextAreaElement | null = null;

// Current state
let profileManager: ProfileManager;
let historyManager: HistoryManager;
let currentSkills: Skill[] = [];
let selectedSkillsForImport: Set<string> = new Set();
let currentHistoryEntries: AnalysisHistoryEntry[] = [];
let selectedJobsForComparison: Set<string> = new Set();

// Analytics utilities
const analyticsClient = ChromeAnalyticsClient.getInstance();
const performanceTracker = new PerformanceTracker(analyticsClient);
const errorTracker = new ErrorTracker(analyticsClient);

/**
 * Initialize popup when DOM is ready
 */
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 Popup DOM loaded');
  
  try {
    // Track popup opening
    performanceTracker.start('popup_initialization');
    await analyticsClient.trackEvent('popup_opened', {
      timestamp: Date.now(),
      userAgent: navigator.userAgent
    });
    
    // Initialize managers
    profileManager = ProfileManager.getInstance();
    historyManager = HistoryManager.getInstance();
    
    // Get DOM elements
    initializeDOMElements();
    
    // Set up event listeners
    setupEventListeners();
    
    // Load current state
    await loadCurrentState();
    
    // Update UI based on current tab
    await updateUIForCurrentTab();
    
    // Track successful initialization
    await performanceTracker.end('popup_initialization');
    await analyticsClient.trackEvent('popup_initialized', {
      skillCount: currentSkills.length,
      hasProfile: currentSkills.length > 0
    });
    
  } catch (error) {
    console.error('❌ Error initializing popup:', error);
    
    // Track initialization error
    await errorTracker.trackError(error as Error, 'popup_initialization');
    
    showError('Failed to initialize extension popup');
  }
});

/**
 * Initialize DOM element references
 */
function initializeDOMElements() {
  // Analysis tab elements
  statusElement = document.querySelector('.status');
  analyzeButton = document.querySelector('#analyze-btn');
  // Profile section element (for future use)
  document.querySelector('.profile-section');
  
  // Profile management elements
  addSkillForm = document.querySelector('#add-skill-form');
  skillsList = document.querySelector('#skills-list');
  categoryFilter = document.querySelector('#category-filter');
  importModal = document.querySelector('#import-modal');
  resumeTextArea = document.querySelector('#resume-text');
}

/**
 * Load current extension state
 */
async function loadCurrentState() {
  console.log('📊 Loading current state');
  
  try {
    // Load user profile
    const profileResult = await profileManager.loadProfile();
    
    if (profileResult.success && profileResult.data) {
      currentSkills = profileResult.data.skills;
      updateProfileStatus(`Profile loaded (${currentSkills.length} skills)`, true);
      await renderSkillsList();
    } else {
      // Try to create a new profile if none exists
      const hasProfile = await profileManager.hasProfile();
      if (!hasProfile) {
        const createResult = await profileManager.createProfile();
        if (createResult.success) {
          currentSkills = [];
          updateProfileStatus('New profile created - add your skills below', true);
          await renderSkillsList();
        } else {
          updateProfileStatus('Error creating profile', false);
        }
      } else {
        updateProfileStatus('Error loading profile', false);
      }
    }
    
  } catch (error) {
    console.error('❌ Error loading state:', error);
    updateProfileStatus('Error loading profile', false);
  }
}

/**
 * Set up event listeners for popup interactions
 */
function setupEventListeners() {
  console.log('🎧 Setting up event listeners');
  
  // Tab navigation
  setupTabNavigation();
  
  // Analysis tab
  analyzeButton?.addEventListener('click', handleAnalyzeClick);
  
  // Profile management
  addSkillForm?.addEventListener('submit', handleAddSkill);
  categoryFilter?.addEventListener('change', handleCategoryFilter);
  
  // Import/Export buttons
  document.querySelector('#import-btn')?.addEventListener('click', showImportModal);
  document.querySelector('#export-btn')?.addEventListener('click', handleExportProfile);
  
  // Import modal
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', hideImportModal);
  });
  document.querySelector('#analyze-resume-btn')?.addEventListener('click', handleAnalyzeResume);
  document.querySelector('#import-skills-btn')?.addEventListener('click', handleImportSkills);
  
  // Close modal on background click
  importModal?.addEventListener('click', (e) => {
    if (e.target === importModal) {
      hideImportModal();
    }
  });
}

/**
 * Update UI based on current active tab
 */
async function updateUIForCurrentTab() {
  console.log('🔄 Updating UI for current tab');
  
  try {
    // Get current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab.id) {
      showError('Cannot access current tab');
      return;
    }
    
    // Send message to content script to get page info
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: 'GET_PAGE_INFO'
    });
    
    if (response.success) {
      const { isJobPage, jobInfo, initialized } = response.data;
      
      if (!initialized) {
        updateStatus('Extension initializing...');
        disableAnalyzeButton();
        return;
      }
      
      if (isJobPage && jobInfo) {
        updateStatus(`Job detected: ${jobInfo.title} at ${jobInfo.company}`);
        enableAnalyzeButton();
      } else {
        updateStatus('Navigate to a job posting to analyze');
        disableAnalyzeButton();
      }
    } else {
      updateStatus('Unable to detect page type');
      disableAnalyzeButton();
    }
    
  } catch (error) {
    console.error('❌ Error updating UI for current tab:', error);
    updateStatus('Error detecting page type');
    disableAnalyzeButton();
  }
}

/**
 * Handle analyze button click
 */
async function handleAnalyzeClick() {
  console.log('🔍 Analyze button clicked');
  
  try {
    // Track analysis start
    performanceTracker.start('popup_job_analysis');
    await analyticsClient.trackEvent('popup_analysis_started', {
      skillCount: currentSkills.length
    });
    
    updateStatus('Analyzing job posting...');
    disableAnalyzeButton();
    
    // Get current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab.id) {
      throw new Error('Cannot access current tab');
    }
    
    // Request job data extraction
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: 'START_ANALYSIS'
    });
    
    if (response.success) {
      updateStatus('Analysis complete!');
      
      // Track successful analysis
      await performanceTracker.end('popup_job_analysis', {
        success: true
      });
      
      await analyticsClient.trackEvent('popup_analysis_completed', {
        skillCount: currentSkills.length,
        success: true
      });
      
      // Display results will be implemented in later tasks
    } else {
      throw new Error(response.error || 'Analysis failed');
    }
    
  } catch (error) {
    console.error('❌ Error during analysis:', error);
    
    // Track analysis error
    await errorTracker.trackError(error as Error, 'popup_job_analysis');
    await performanceTracker.end('popup_job_analysis', {
      success: false,
      error: true
    });
    
    showError('Analysis failed: ' + (error instanceof Error ? error.message : String(error)));
  } finally {
    enableAnalyzeButton();
  }
}

/**
 * Update status message
 */
function updateStatus(message: string) {
  if (statusElement) {
    statusElement.textContent = message;
  }
}

/**
 * Update profile status
 */
function updateProfileStatus(message: string, isValid: boolean) {
  const profileStatus = document.querySelector('.profile-status');
  if (profileStatus) {
    profileStatus.textContent = message;
    profileStatus.className = `profile-status ${isValid ? 'valid' : 'invalid'}`;
  }
}

/**
 * Show error message
 */
function showError(message: string) {
  updateStatus(`Error: ${message}`);
  console.error('Popup error:', message);
}

/**
 * Enable analyze button
 */
function enableAnalyzeButton() {
  if (analyzeButton) {
    analyzeButton.removeAttribute('disabled');
    (analyzeButton as HTMLButtonElement).disabled = false;
  }
}

/**
 * Disable analyze button
 */
function disableAnalyzeButton() {
  if (analyzeButton) {
    analyzeButton.setAttribute('disabled', 'true');
    (analyzeButton as HTMLButtonElement).disabled = true;
  }
}

// Export empty object to make this a module
export {};

// ============================================================================
// Tab Navigation
// ============================================================================

/**
 * Set up tab navigation
 */
function setupTabNavigation() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabName = button.getAttribute('data-tab');
      
      // Remove active class from all tabs and contents
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));
      
      // Add active class to clicked tab and corresponding content
      button.classList.add('active');
      document.querySelector(`#${tabName}-tab`)?.classList.add('active');
      
      // Load tab-specific data
      if (tabName === 'profile') {
        renderSkillsList();
      } else if (tabName === 'history') {
        loadAnalysisHistory();
      }
    });
  });
}

// ============================================================================
// Profile Management Functions
// ============================================================================

/**
 * Handle add skill form submission
 */
async function handleAddSkill(event: Event) {
  event.preventDefault();
  
  const form = event.target as HTMLFormElement;
  const formData = new FormData(form);
  
  const skillName = (formData.get('skill-name') as string)?.trim();
  const category = formData.get('skill-category') as SkillCategory;
  const proficiency = formData.get('skill-proficiency') as ProficiencyLevel;
  const experience = formData.get('skill-experience') as string;
  
  if (!skillName || !category || !proficiency) {
    showError('Please fill in all required fields');
    return;
  }
  
  try {
    const skill: Skill = {
      name: skillName,
      category,
      proficiency,
      yearsOfExperience: experience ? parseFloat(experience) : undefined,
      synonyms: [skillName.toLowerCase()]
    };
    
    if (!validateSkill(skill)) {
      showError('Invalid skill data');
      return;
    }
    
    const result = await profileManager.addSkill(skill);
    
    if (result.success && result.data) {
      currentSkills = result.data.skills;
      await renderSkillsList();
      form.reset();
      showSuccess('Skill added successfully');
      
      // Track skill addition
      await analyticsClient.trackEvent('skill_added', {
        category: skill.category,
        proficiency: skill.proficiency,
        hasExperience: !!skill.yearsOfExperience,
        totalSkills: currentSkills.length
      });
    } else {
      showError(result.error || 'Failed to add skill');
    }
    
  } catch (error) {
    console.error('❌ Error adding skill:', error);
    showError('Failed to add skill');
  }
}

/**
 * Handle category filter change
 */
async function handleCategoryFilter() {
  await renderSkillsList();
}

/**
 * Render skills list
 */
async function renderSkillsList() {
  if (!skillsList) return;
  
  const selectedCategory = categoryFilter?.value || '';
  const filteredSkills = selectedCategory 
    ? currentSkills.filter(skill => skill.category === selectedCategory)
    : currentSkills;
  
  if (filteredSkills.length === 0) {
    skillsList.innerHTML = `
      <div class="loading-skills">
        ${selectedCategory ? 'No skills in this category' : 'No skills added yet'}
      </div>
    `;
    return;
  }
  
  skillsList.innerHTML = filteredSkills.map(skill => `
    <div class="skill-item" data-skill-name="${skill.name}">
      <div class="skill-info">
        <div class="skill-name">${skill.name}</div>
        <div class="skill-details">
          ${formatSkillCategory(skill.category)} • ${formatProficiency(skill.proficiency)}
          ${skill.yearsOfExperience ? ` • ${skill.yearsOfExperience} years` : ''}
        </div>
      </div>
      <div class="skill-actions">
        <button class="edit-skill-btn" onclick="editSkill('${skill.name}')">Edit</button>
        <button class="delete-skill-btn" onclick="deleteSkill('${skill.name}')">Delete</button>
      </div>
    </div>
  `).join('');
}

/**
 * Delete a skill
 */
async function deleteSkill(skillName: string) {
  if (!confirm(`Are you sure you want to delete "${skillName}"?`)) {
    return;
  }
  
  try {
    const result = await profileManager.removeSkill(skillName);
    
    if (result.success && result.data) {
      currentSkills = result.data.skills;
      await renderSkillsList();
      showSuccess('Skill deleted successfully');
    } else {
      showError(result.error || 'Failed to delete skill');
    }
    
  } catch (error) {
    console.error('❌ Error deleting skill:', error);
    showError('Failed to delete skill');
  }
}

/**
 * Edit a skill (populate form with existing data)
 */
function editSkill(skillName: string) {
  const skill = currentSkills.find(s => s.name === skillName);
  if (!skill || !addSkillForm) return;
  
  // Populate form fields
  const nameInput = addSkillForm.querySelector('#skill-name') as HTMLInputElement;
  const categorySelect = addSkillForm.querySelector('#skill-category') as HTMLSelectElement;
  const proficiencySelect = addSkillForm.querySelector('#skill-proficiency') as HTMLSelectElement;
  const experienceInput = addSkillForm.querySelector('#skill-experience') as HTMLInputElement;
  
  if (nameInput) nameInput.value = skill.name;
  if (categorySelect) categorySelect.value = skill.category;
  if (proficiencySelect) proficiencySelect.value = skill.proficiency;
  if (experienceInput && skill.yearsOfExperience) {
    experienceInput.value = skill.yearsOfExperience.toString();
  }
  
  // Switch to profile tab if not already there
  const profileTab = document.querySelector('[data-tab="profile"]') as HTMLElement;
  profileTab?.click();
  
  // Scroll to form
  addSkillForm.scrollIntoView({ behavior: 'smooth' });
}

// ============================================================================
// Import/Export Functions
// ============================================================================

/**
 * Show import modal
 */
function showImportModal() {
  importModal?.classList.add('show');
  selectedSkillsForImport.clear();
  
  // Clear previous content
  if (resumeTextArea) resumeTextArea.value = '';
  const importPreview = document.querySelector('#import-preview');
  if (importPreview) (importPreview as HTMLElement).style.display = 'none';
}

/**
 * Hide import modal
 */
function hideImportModal() {
  importModal?.classList.remove('show');
}

/**
 * Handle analyze resume text
 */
async function handleAnalyzeResume() {
  const resumeText = resumeTextArea?.value?.trim();
  
  if (!resumeText) {
    showError('Please paste your resume text');
    return;
  }
  
  try {
    const analyzeBtn = document.querySelector('#analyze-resume-btn') as HTMLButtonElement;
    analyzeBtn.disabled = true;
    analyzeBtn.textContent = 'Analyzing...';
    
    const result = await profileManager.importSkillsFromText(resumeText);
    
    if (result.success && result.importedSkills.length > 0) {
      displayDetectedSkills(result.importedSkills);
      
      if (result.errors.length > 0) {
        console.warn('Import warnings:', result.errors);
      }
    } else {
      showError('No skills detected in the text');
    }
    
  } catch (error) {
    console.error('❌ Error analyzing resume:', error);
    showError('Failed to analyze resume text');
  } finally {
    const analyzeBtn = document.querySelector('#analyze-resume-btn') as HTMLButtonElement;
    analyzeBtn.disabled = false;
    analyzeBtn.textContent = 'Analyze Text';
  }
}

/**
 * Display detected skills for selection
 */
function displayDetectedSkills(skills: Skill[]) {
  const importPreview = document.querySelector('#import-preview');
  const detectedSkillsContainer = document.querySelector('#detected-skills');
  const importBtn = document.querySelector('#import-skills-btn') as HTMLButtonElement;
  
  if (!importPreview || !detectedSkillsContainer) return;
  
  detectedSkillsContainer.innerHTML = skills.map(skill => `
    <span class="detected-skill" data-skill-name="${skill.name}">
      ${skill.name} (${formatSkillCategory(skill.category)})
    </span>
  `).join('');
  
  // Add click handlers for skill selection
  detectedSkillsContainer.querySelectorAll('.detected-skill').forEach(element => {
    element.addEventListener('click', () => {
      const skillName = element.getAttribute('data-skill-name');
      if (!skillName) return;
      
      if (selectedSkillsForImport.has(skillName)) {
        selectedSkillsForImport.delete(skillName);
        element.classList.remove('selected');
      } else {
        selectedSkillsForImport.add(skillName);
        element.classList.add('selected');
      }
      
      // Update import button
      (importBtn as HTMLElement).style.display = selectedSkillsForImport.size > 0 ? 'inline-block' : 'none';
      importBtn.textContent = `Import ${selectedSkillsForImport.size} Selected Skills`;
    });
  });
  
  (importPreview as HTMLElement).style.display = 'block';
  (importBtn as HTMLElement).style.display = 'none';
}

/**
 * Handle import selected skills
 */
async function handleImportSkills() {
  if (selectedSkillsForImport.size === 0) {
    showError('Please select skills to import');
    return;
  }
  
  try {
    const importBtn = document.querySelector('#import-skills-btn') as HTMLButtonElement;
    importBtn.disabled = true;
    importBtn.textContent = 'Importing...';
    
    // Get the detected skills from the resume analysis
    const resumeText = resumeTextArea?.value?.trim();
    if (!resumeText) return;
    
    const result = await profileManager.importSkillsFromText(resumeText);
    if (!result.success) return;
    
    // Filter to only selected skills
    const skillsToImport = result.importedSkills.filter(skill => 
      selectedSkillsForImport.has(skill.name)
    );
    
    // Add each selected skill
    let successCount = 0;
    for (const skill of skillsToImport) {
      const addResult = await profileManager.addSkill(skill);
      if (addResult.success) {
        successCount++;
      }
    }
    
    // Update current skills and UI
    const profileResult = await profileManager.loadProfile();
    if (profileResult.success && profileResult.data) {
      currentSkills = profileResult.data.skills;
      await renderSkillsList();
    }
    
    hideImportModal();
    showSuccess(`Successfully imported ${successCount} skills`);
    
  } catch (error) {
    console.error('❌ Error importing skills:', error);
    showError('Failed to import skills');
  } finally {
    const importBtn = document.querySelector('#import-skills-btn') as HTMLButtonElement;
    importBtn.disabled = false;
  }
}

/**
 * Handle export profile
 */
async function handleExportProfile() {
  try {
    const result = await profileManager.exportProfile();
    
    if (result.success && result.data) {
      // Create and download file
      const blob = new Blob([result.data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `skill-profile-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      showSuccess('Profile exported successfully');
    } else {
      showError(result.error || 'Failed to export profile');
    }
    
  } catch (error) {
    console.error('❌ Error exporting profile:', error);
    showError('Failed to export profile');
  }
}

// ============================================================================
// History Functions
// ============================================================================

/**
 * Load analysis history
 */
async function loadAnalysisHistory() {
  const historyList = document.querySelector('#history-list');
  if (!historyList) return;
  
  try {
    historyList.innerHTML = '<div class="loading-history">Loading history...</div>';
    
    const historyResult = await historyManager.getHistory();
    
    if (!historyResult.success || !historyResult.data) {
      historyList.innerHTML = `
        <div class="loading-history">
          ${historyResult.error || 'No analysis history found'}
        </div>
      `;
      return;
    }
    
    currentHistoryEntries = historyResult.data;
    
    if (currentHistoryEntries.length === 0) {
      historyList.innerHTML = `
        <div class="loading-history">
          No job analyses yet. Analyze some jobs to see history here.
        </div>
      `;
      return;
    }
    
    await renderHistoryList();
    
  } catch (error) {
    console.error('❌ Error loading history:', error);
    historyList.innerHTML = `
      <div class="loading-history">
        Error loading history
      </div>
    `;
  }
}

/**
 * Render history list with comparison features
 */
async function renderHistoryList() {
  const historyList = document.querySelector('#history-list');
  if (!historyList) return;
  
  const comparisonControls = selectedJobsForComparison.size > 1 ? `
    <div class="comparison-controls">
      <button id="compare-jobs-btn" class="btn-primary">
        Compare ${selectedJobsForComparison.size} Selected Jobs
      </button>
      <button id="clear-selection-btn" class="btn-secondary">Clear Selection</button>
    </div>
  ` : '';
  
  const historyItems = currentHistoryEntries.map(entry => {
    const isSelected = selectedJobsForComparison.has(entry.id);
    const matchScoreClass = getMatchScoreClass(entry.analysis.overallMatch);
    const matchPercentage = Math.round(entry.analysis.overallMatch * 100);
    
    return `
      <div class="history-item ${isSelected ? 'selected' : ''}" data-job-id="${entry.id}">
        <div class="history-item-header">
          <div class="history-selection">
            <input type="checkbox" 
                   class="job-checkbox" 
                   data-job-id="${entry.id}"
                   ${isSelected ? 'checked' : ''}>
          </div>
          <div class="history-job-info">
            <div class="history-job-title">${entry.jobPosting.title}</div>
            <div class="history-date">${formatDate(entry.timestamp)}</div>
          </div>
          <div class="history-match-score ${matchScoreClass}">
            ${matchPercentage}% match
          </div>
        </div>
        <div class="history-company">${entry.jobPosting.company}</div>
        <div class="history-skills">
          <strong>Required Skills:</strong> ${entry.jobPosting.extractedSkills.slice(0, 3).map(s => s.name).join(', ')}
          ${entry.jobPosting.extractedSkills.length > 3 ? ` +${entry.jobPosting.extractedSkills.length - 3} more` : ''}
        </div>
        <div class="history-actions">
          <button class="btn-secondary view-details-btn" data-job-id="${entry.id}">View Details</button>
          <button class="btn-secondary delete-history-btn" data-job-id="${entry.id}">Delete</button>
        </div>
      </div>
    `;
  }).join('');
  
  historyList.innerHTML = `
    ${comparisonControls}
    <div class="history-controls">
      <div class="history-filters">
        <input type="text" id="history-search" placeholder="Search by company or skill..." class="search-input">
        <select id="match-score-filter" class="filter-select">
          <option value="">All Match Scores</option>
          <option value="high">High (80%+)</option>
          <option value="medium">Medium (50-79%)</option>
          <option value="low">Low (<50%)</option>
        </select>
      </div>
      <div class="history-actions-bar">
        <button id="show-trends-btn" class="btn-secondary">Show Skill Trends</button>
        <button id="clear-history-btn" class="btn-secondary">Clear All History</button>
      </div>
    </div>
    <div class="history-items">
      ${historyItems}
    </div>
  `;
  
  // Add event listeners for history interactions
  setupHistoryEventListeners();
}

/**
 * Set up event listeners for history functionality
 */
function setupHistoryEventListeners() {
  // Job selection checkboxes
  document.querySelectorAll('.job-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', handleJobSelection);
  });
  
  // Compare jobs button
  document.querySelector('#compare-jobs-btn')?.addEventListener('click', handleCompareJobs);
  
  // Clear selection button
  document.querySelector('#clear-selection-btn')?.addEventListener('click', handleClearSelection);
  
  // View details buttons
  document.querySelectorAll('.view-details-btn').forEach(btn => {
    btn.addEventListener('click', handleViewJobDetails);
  });
  
  // Delete history buttons
  document.querySelectorAll('.delete-history-btn').forEach(btn => {
    btn.addEventListener('click', handleDeleteHistoryEntry);
  });
  
  // Search and filter
  document.querySelector('#history-search')?.addEventListener('input', handleHistorySearch);
  document.querySelector('#match-score-filter')?.addEventListener('change', handleMatchScoreFilter);
  
  // Trends and clear buttons
  document.querySelector('#show-trends-btn')?.addEventListener('click', handleShowTrends);
  document.querySelector('#clear-history-btn')?.addEventListener('click', handleClearHistory);
}

/**
 * Handle job selection for comparison
 */
function handleJobSelection(event: Event) {
  const checkbox = event.target as HTMLInputElement;
  const jobId = checkbox.getAttribute('data-job-id');
  
  if (!jobId) return;
  
  if (checkbox.checked) {
    selectedJobsForComparison.add(jobId);
  } else {
    selectedJobsForComparison.delete(jobId);
  }
  
  renderHistoryList();
}

/**
 * Handle compare jobs action
 */
async function handleCompareJobs() {
  if (selectedJobsForComparison.size < 2) {
    showError('Please select at least 2 jobs to compare');
    return;
  }
  
  try {
    const jobIds = Array.from(selectedJobsForComparison);
    const comparisonResult = await historyManager.compareJobs(jobIds);
    
    if (comparisonResult.success && comparisonResult.data) {
      showJobComparison(comparisonResult.data);
    } else {
      showError(comparisonResult.error || 'Failed to compare jobs');
    }
    
  } catch (error) {
    console.error('❌ Error comparing jobs:', error);
    showError('Failed to compare jobs');
  }
}

/**
 * Handle clear selection
 */
function handleClearSelection() {
  selectedJobsForComparison.clear();
  renderHistoryList();
}

/**
 * Handle view job details
 */
function handleViewJobDetails(event: Event) {
  const button = event.target as HTMLButtonElement;
  const jobId = button.getAttribute('data-job-id');
  
  if (!jobId) return;
  
  const entry = currentHistoryEntries.find(e => e.id === jobId);
  if (!entry) return;
  
  showJobDetails(entry);
}

/**
 * Handle delete history entry
 */
async function handleDeleteHistoryEntry(event: Event) {
  const button = event.target as HTMLButtonElement;
  const jobId = button.getAttribute('data-job-id');
  
  if (!jobId) return;
  
  const entry = currentHistoryEntries.find(e => e.id === jobId);
  if (!entry) return;
  
  if (!confirm(`Delete analysis for "${entry.jobPosting.title}" at ${entry.jobPosting.company}?`)) {
    return;
  }
  
  try {
    const result = await historyManager.deleteHistoryEntry(jobId);
    
    if (result.success) {
      selectedJobsForComparison.delete(jobId);
      await loadAnalysisHistory();
      showSuccess('History entry deleted');
    } else {
      showError(result.error || 'Failed to delete history entry');
    }
    
  } catch (error) {
    console.error('❌ Error deleting history entry:', error);
    showError('Failed to delete history entry');
  }
}

/**
 * Handle history search
 */
async function handleHistorySearch(event: Event) {
  const input = event.target as HTMLInputElement;
  const query = input.value.trim().toLowerCase();
  
  if (!query) {
    await renderHistoryList();
    return;
  }
  
  const filteredEntries = currentHistoryEntries.filter(entry =>
    entry.jobPosting.company.toLowerCase().includes(query) ||
    entry.jobPosting.title.toLowerCase().includes(query) ||
    entry.jobPosting.extractedSkills.some(skill =>
      skill.name.toLowerCase().includes(query)
    )
  );
  
  const originalEntries = currentHistoryEntries;
  currentHistoryEntries = filteredEntries;
  await renderHistoryList();
  currentHistoryEntries = originalEntries;
}

/**
 * Handle match score filter
 */
async function handleMatchScoreFilter(event: Event) {
  const select = event.target as HTMLSelectElement;
  const filterValue = select.value;
  
  if (!filterValue) {
    await renderHistoryList();
    return;
  }
  
  let filteredEntries: AnalysisHistoryEntry[] = [];
  
  switch (filterValue) {
    case 'high':
      filteredEntries = currentHistoryEntries.filter(entry => entry.analysis.overallMatch >= 0.8);
      break;
    case 'medium':
      filteredEntries = currentHistoryEntries.filter(entry => 
        entry.analysis.overallMatch >= 0.5 && entry.analysis.overallMatch < 0.8
      );
      break;
    case 'low':
      filteredEntries = currentHistoryEntries.filter(entry => entry.analysis.overallMatch < 0.5);
      break;
    default:
      filteredEntries = currentHistoryEntries;
  }
  
  const originalEntries = currentHistoryEntries;
  currentHistoryEntries = filteredEntries;
  await renderHistoryList();
  currentHistoryEntries = originalEntries;
}

/**
 * Handle show skill trends
 */
async function handleShowTrends() {
  try {
    const trendsResult = await historyManager.getSkillTrends(15);
    
    if (trendsResult.success && trendsResult.data) {
      showSkillTrends(trendsResult.data);
    } else {
      showError(trendsResult.error || 'Failed to load skill trends');
    }
    
  } catch (error) {
    console.error('❌ Error loading trends:', error);
    showError('Failed to load skill trends');
  }
}

/**
 * Handle clear all history
 */
async function handleClearHistory() {
  if (!confirm('Are you sure you want to clear all analysis history? This cannot be undone.')) {
    return;
  }
  
  try {
    const result = await historyManager.clearHistory();
    
    if (result.success) {
      selectedJobsForComparison.clear();
      currentHistoryEntries = [];
      await loadAnalysisHistory();
      showSuccess('History cleared');
    } else {
      showError(result.error || 'Failed to clear history');
    }
    
  } catch (error) {
    console.error('❌ Error clearing history:', error);
    showError('Failed to clear history');
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format skill category for display
 */
function formatSkillCategory(category: SkillCategory): string {
  const categoryMap: Record<SkillCategory, string> = {
    [SkillCategoryEnum.TECHNICAL]: 'Technical',
    [SkillCategoryEnum.SOFT_SKILLS]: 'Soft Skills',
    [SkillCategoryEnum.TOOLS]: 'Tools',
    [SkillCategoryEnum.FRAMEWORKS]: 'Frameworks',
    [SkillCategoryEnum.LANGUAGES]: 'Languages',
    [SkillCategoryEnum.CERTIFICATIONS]: 'Certifications',
    [SkillCategoryEnum.METHODOLOGIES]: 'Methodologies'
  };
  
  return categoryMap[category] || category;
}

/**
 * Format proficiency level for display
 */
function formatProficiency(proficiency: ProficiencyLevel): string {
  const proficiencyMap: Record<ProficiencyLevel, string> = {
    [ProficiencyLevelEnum.BEGINNER]: 'Beginner',
    [ProficiencyLevelEnum.INTERMEDIATE]: 'Intermediate',
    [ProficiencyLevelEnum.ADVANCED]: 'Advanced',
    [ProficiencyLevelEnum.EXPERT]: 'Expert'
  };
  
  return proficiencyMap[proficiency] || proficiency;
}

/**
 * Show success message
 */
function showSuccess(message: string) {
  // Create a temporary success indicator
  const successDiv = document.createElement('div');
  successDiv.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: #38a169;
    color: white;
    padding: 8px 12px;
    border-radius: 4px;
    font-size: 12px;
    z-index: 1001;
    animation: slideIn 0.3s ease;
  `;
  successDiv.textContent = message;
  
  document.body.appendChild(successDiv);
  
  setTimeout(() => {
    successDiv.remove();
  }, 3000);
}

// Make functions available globally for onclick handlers
(window as any).editSkill = editSkill;
(window as any).deleteSkill = deleteSkill;

// ============================================================================
// Job Details and Comparison Display Functions
// ============================================================================








function showJobDetails(entry: AnalysisHistoryEntry) {
  const modal = createModal('Job Analysis Details');
  
  const matchPercentage = Math.round(entry.analysis.overallMatch * 100);
  const matchScoreClass = getMatchScoreClass(entry.analysis.overallMatch);
  
  const modalBody = modal.querySelector('.modal-body');
  if (!modalBody) return;
  
  modalBody.innerHTML = `
    <div class="job-details">
      <div class="job-header">
        <h4>${entry.jobPosting.title}</h4>
        <p class="job-company">${entry.jobPosting.company}</p>
        <p class="job-location">${entry.jobPosting.location}</p>
        <div class="job-match-score ${matchScoreClass}">
          Overall Match: ${matchPercentage}%
        </div>
      </div>
      
      <div class="job-analysis-section">
        <h5>Matching Skills (${entry.analysis.matchingSkills.length})</h5>
        <div class="skills-grid">
          ${entry.analysis.matchingSkills.map(match => `
            <div class="skill-match-item">
              <span class="skill-name">${match.jobSkill.name}</span>
              <span class="match-score">${Math.round(match.matchScore * 100)}%</span>
            </div>
          `).join('')}
        </div>
      </div>
      
      <div class="job-analysis-section">
        <h5>Missing Skills (${entry.analysis.missingSkills.length})</h5>
        <div class="skills-grid">
          ${entry.analysis.missingSkills.map(skill => `
            <div class="missing-skill-item">
              <span class="skill-name">${skill.name}</span>
              <span class="skill-importance">${skill.isRequired ? 'Required' : 'Preferred'}</span>
            </div>
          `).join('')}
        </div>
      </div>
      
      <div class="job-analysis-section">
        <h5>Learning Recommendations (${entry.analysis.recommendations.length})</h5>
        <div class="recommendations-list">
          ${entry.analysis.recommendations.map(rec => `
            <div class="recommendation-item">
              <div class="rec-skill">${rec.skill.name}</div>
              <div class="rec-priority priority-${rec.priority}">${rec.priority.toUpperCase()}</div>
              <div class="rec-time">${rec.estimatedTimeToLearn}h estimated</div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
  
  showModal(modal);
}

/**
 * Show job comparison results
 */
function showJobComparison(comparison: ComparisonResult) {
  const modal = createModal('Job Comparison');
  
  const modalBody = modal.querySelector('.modal-body');
  if (!modalBody) return;
  
  modalBody.innerHTML = `
    <div class="job-comparison">
      <div class="comparison-overview">
        <h4>Comparing ${comparison.jobs.length} Jobs</h4>
        <div class="jobs-overview">
          ${comparison.jobs.map(job => {
            const matchPercentage = Math.round(comparison.matchScoreComparison.get(job.id)! * 100);
            const matchScoreClass = getMatchScoreClass(comparison.matchScoreComparison.get(job.id)!);
            return `
              <div class="job-overview-item">
                <div class="job-title">${job.jobPosting.title}</div>
                <div class="job-company">${job.jobPosting.company}</div>
                <div class="job-match ${matchScoreClass}">${matchPercentage}% match</div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
      
      <div class="comparison-section">
        <h5>Common Skills (${comparison.commonSkills.length})</h5>
        <div class="skills-grid">
          ${comparison.commonSkills.map(skill => `
            <div class="common-skill-item">
              <span class="skill-name">${skill.name}</span>
              <span class="skill-confidence">${Math.round(skill.confidence * 100)}% confidence</span>
            </div>
          `).join('')}
        </div>
      </div>
      
      <div class="comparison-section">
        <h5>Unique Skills by Job</h5>
        ${Array.from(comparison.uniqueSkills.entries()).map(([jobId, skills]) => {
          const job = comparison.jobs.find(j => j.id === jobId);
          return `
            <div class="unique-skills-section">
              <h6>${job?.jobPosting.title} - ${job?.jobPosting.company}</h6>
              <div class="skills-grid">
                ${skills.map(skill => `
                  <div class="unique-skill-item">
                    <span class="skill-name">${skill.name}</span>
                    <span class="skill-type">${skill.isRequired ? 'Required' : 'Preferred'}</span>
                  </div>
                `).join('')}
              </div>
            </div>
          `;
        }).join('')}
      </div>
      
      <div class="comparison-section">
        <h5>Skill Trends in Selection</h5>
        <div class="trends-list">
          ${comparison.trendAnalysis.slice(0, 10).map(trend => `
            <div class="trend-item">
              <span class="trend-skill">${trend.skillName}</span>
              <span class="trend-frequency">${trend.frequency}/${comparison.jobs.length} jobs</span>
              <span class="trend-importance">${Math.round(trend.averageImportance * 100)}% avg importance</span>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
  
  showModal(modal);
}

/**
 * Show skill trends analysis
 */
function showSkillTrends(trends: SkillTrendData[]) {
  const modal = createModal('Skill Trends Analysis');
  
  const modalBody = modal.querySelector('.modal-body');
  if (!modalBody) return;
  
  modalBody.innerHTML = `
    <div class="skill-trends">
      <div class="trends-header">
        <h4>Most Frequently Requested Skills</h4>
        <p>Based on your job analysis history</p>
      </div>
      
      <div class="trends-list">
        ${trends.map((trend, index) => `
          <div class="trend-item-detailed">
            <div class="trend-rank">#${index + 1}</div>
            <div class="trend-info">
              <div class="trend-skill-name">${trend.skillName}</div>
              <div class="trend-stats">
                <span class="trend-frequency">Appears in ${trend.frequency} job${trend.frequency !== 1 ? 's' : ''}</span>
                <span class="trend-importance">Avg importance: ${Math.round(trend.averageImportance * 100)}%</span>
              </div>
            </div>
            <div class="trend-bar">
              <div class="trend-fill" style="width: ${(trend.frequency / trends[0].frequency) * 100}%"></div>
            </div>
          </div>
        `).join('')}
      </div>
      
      <div class="trends-insights">
        <h5>Insights</h5>
        <ul>
          <li>Focus on the top skills to maximize your job match scores</li>
          <li>Skills with high frequency and importance should be prioritized for learning</li>
          <li>Consider adding trending skills to your profile</li>
        </ul>
      </div>
    </div>
  `;
  
  showModal(modal);
}

/**
 * Create a modal element
 */
function createModal(title: string): HTMLElement {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>${title}</h3>
        <button class="modal-close">&times;</button>
      </div>
      <div class="modal-body">
        <!-- Content will be inserted here -->
      </div>
      <div class="modal-footer">
        <button class="modal-close btn-secondary">Close</button>
      </div>
    </div>
  `;
  
  // Add close event listeners
  modal.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
      modal.remove();
    });
  });
  
  // Close on background click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
  
  return modal;
}

/**
 * Show modal
 */
function showModal(modal: HTMLElement) {
  document.body.appendChild(modal);
  modal.classList.add('show');
}

/**
 * Get match score CSS class
 */
function getMatchScoreClass(score: number): string {
  if (score >= 0.8) return 'match-score-high';
  if (score >= 0.5) return 'match-score-medium';
  return 'match-score-low';
}

/**
 * Format date for display
 */
function formatDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    return 'Today';
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString();
  }
}