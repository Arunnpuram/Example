/**
 * UI Overlay for displaying skill gap analysis results
 * Renders responsive overlay component that works across job sites
 */

import { SkillGapAnalysis, Priority } from '@/core/types';
import { AnalysisProgress, AnalysisStage } from './analysis-workflow';

export interface OverlayConfig {
  position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  theme: 'light' | 'dark' | 'auto';
  showProgress: boolean;
  autoHide: boolean;
  autoHideDelay: number; // milliseconds
}

export interface OverlayState {
  isVisible: boolean;
  isMinimized: boolean;
  isLoading: boolean;
  analysis: SkillGapAnalysis | null;
  progress: AnalysisProgress | null;
  error: string | null;
}

/**
 * Manages the skill gap analysis overlay UI
 */
export class UIOverlayRenderer {
  private static instance: UIOverlayRenderer | null = null;
  
  private overlayElement: HTMLElement | null = null;
  private shadowRoot: ShadowRoot | null = null;
  private state: OverlayState;
  private config: OverlayConfig;
  
  // Event handlers
  private resizeHandler: (() => void) | null = null;
  private scrollHandler: (() => void) | null = null;
  
  private constructor(config: Partial<OverlayConfig> = {}) {
    this.config = {
      position: 'top-right',
      theme: 'auto',
      showProgress: true,
      autoHide: false,
      autoHideDelay: 10000,
      ...config
    };
    
    this.state = {
      isVisible: false,
      isMinimized: false,
      isLoading: false,
      analysis: null,
      progress: null,
      error: null
    };
  }

  /**
   * Get or create singleton instance
   */
  public static getInstance(config?: Partial<OverlayConfig>): UIOverlayRenderer {
    if (!UIOverlayRenderer.instance) {
      UIOverlayRenderer.instance = new UIOverlayRenderer(config);
    }
    return UIOverlayRenderer.instance;
  }

  /**
   * Initialize the overlay
   */
  public initialize(): void {
    if (this.overlayElement) {
      return; // Already initialized
    }

    this.createOverlayElement();
    this.attachEventListeners();
    this.injectStyles();
    
    console.log('✅ UI Overlay initialized');
  }

  /**
   * Show analysis results
   */
  public showAnalysis(analysis: SkillGapAnalysis): void {
    this.state.analysis = analysis;
    this.state.isLoading = false;
    this.state.error = null;
    this.state.isVisible = true;
    
    this.render();
    
    // Auto-hide if configured
    if (this.config.autoHide) {
      setTimeout(() => {
        this.hide();
      }, this.config.autoHideDelay);
    }
  }

  /**
   * Show loading state with progress
   */
  public showProgress(progress: AnalysisProgress): void {
    this.state.progress = progress;
    this.state.isLoading = true;
    this.state.error = null;
    
    if (progress.stage === AnalysisStage.COMPLETE) {
      this.state.isLoading = false;
    }
    
    if (progress.stage === AnalysisStage.ERROR) {
      this.state.isLoading = false;
      this.state.error = progress.message;
    }
    
    if (!this.state.isVisible && this.config.showProgress) {
      this.state.isVisible = true;
    }
    
    this.render();
  }

  /**
   * Show error message
   */
  public showError(error: string): void {
    this.state.error = error;
    this.state.isLoading = false;
    this.state.isVisible = true;
    
    this.render();
  }

  /**
   * Hide the overlay
   */
  public hide(): void {
    this.state.isVisible = false;
    this.render();
  }

  /**
   * Toggle overlay visibility
   */
  public toggle(): void {
    this.state.isVisible = !this.state.isVisible;
    this.render();
  }

  /**
   * Toggle minimized state
   */
  public toggleMinimized(): void {
    this.state.isMinimized = !this.state.isMinimized;
    this.render();
  }

  /**
   * Create the overlay DOM element
   */
  private createOverlayElement(): void {
    // Create overlay container
    this.overlayElement = document.createElement('div');
    this.overlayElement.id = 'skill-gap-analyzer-overlay';
    this.overlayElement.setAttribute('data-sga-overlay', 'true');
    
    // Create shadow DOM for style isolation
    this.shadowRoot = this.overlayElement.attachShadow({ mode: 'closed' });
    
    // Add to page
    document.body.appendChild(this.overlayElement);
  }

  /**
   * Attach event listeners
   */
  private attachEventListeners(): void {
    // Handle window resize
    this.resizeHandler = () => this.handleResize();
    window.addEventListener('resize', this.resizeHandler);
    
    // Handle scroll
    this.scrollHandler = () => this.handleScroll();
    window.addEventListener('scroll', this.scrollHandler, { passive: true });
  }

  /**
   * Handle window resize
   */
  private handleResize(): void {
    if (this.state.isVisible) {
      this.updatePosition();
    }
  }

  /**
   * Handle scroll
   */
  private handleScroll(): void {
    if (this.state.isVisible) {
      this.updatePosition();
    }
  }

  /**
   * Update overlay position
   */
  private updatePosition(): void {
    if (!this.overlayElement) return;
    
    const overlay = this.overlayElement;
    const rect = overlay.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Ensure overlay stays within viewport
    let left = parseInt(overlay.style.left) || 0;
    let top = parseInt(overlay.style.top) || 0;
    
    if (left + rect.width > viewportWidth) {
      left = viewportWidth - rect.width - 20;
    }
    
    if (top + rect.height > viewportHeight) {
      top = viewportHeight - rect.height - 20;
    }
    
    if (left < 20) left = 20;
    if (top < 20) top = 20;
    
    overlay.style.left = `${left}px`;
    overlay.style.top = `${top}px`;
  }

  /**
   * Render the overlay content
   */
  private render(): void {
    if (!this.shadowRoot) return;
    
    const content = this.state.isVisible ? this.renderContent() : '';
    
    this.shadowRoot.innerHTML = `
      <style>${this.getStyles()}</style>
      ${content}
    `;
    
    if (this.state.isVisible) {
      this.attachOverlayEventListeners();
      this.updatePosition();
    }
  }

  /**
   * Render overlay content based on current state
   */
  private renderContent(): string {
    const { isMinimized, isLoading } = this.state;
    
    const baseClasses = [
      'sga-overlay',
      `sga-position-${this.config.position}`,
      `sga-theme-${this.config.theme}`,
      isMinimized ? 'sga-minimized' : '',
      isLoading ? 'sga-loading' : ''
    ].filter(Boolean).join(' ');
    
    return `
      <div class="${baseClasses}">
        ${this.renderHeader()}
        ${!isMinimized ? this.renderBody() : ''}
      </div>
    `;
  }

  /**
   * Render overlay header
   */
  private renderHeader(): string {
    const { isMinimized, isLoading } = this.state;
    
    return `
      <div class="sga-header">
        <div class="sga-title">
          <span class="sga-icon">${isLoading ? '⏳' : '🎯'}</span>
          <span class="sga-title-text">Skill Gap Analysis</span>
        </div>
        <div class="sga-controls">
          <button class="sga-btn sga-btn-minimize" title="${isMinimized ? 'Expand' : 'Minimize'}">
            ${isMinimized ? '⬆️' : '⬇️'}
          </button>
          <button class="sga-btn sga-btn-close" title="Close">✕</button>
        </div>
      </div>
    `;
  }

  /**
   * Render overlay body
   */
  private renderBody(): string {
    const { isLoading, analysis, progress, error } = this.state;
    
    if (error) {
      return this.renderError(error);
    }
    
    if (isLoading && progress) {
      return this.renderProgress(progress);
    }
    
    if (analysis) {
      return this.renderAnalysis(analysis);
    }
    
    return this.renderEmpty();
  }

  /**
   * Render error state
   */
  private renderError(error: string): string {
    return `
      <div class="sga-body">
        <div class="sga-error">
          <div class="sga-error-icon">⚠️</div>
          <div class="sga-error-message">${this.escapeHtml(error)}</div>
          <button class="sga-btn sga-btn-retry">Try Again</button>
        </div>
      </div>
    `;
  }

  /**
   * Render progress state
   */
  private renderProgress(progress: AnalysisProgress): string {
    return `
      <div class="sga-body">
        <div class="sga-progress">
          <div class="sga-progress-message">${this.escapeHtml(progress.message)}</div>
          <div class="sga-progress-bar">
            <div class="sga-progress-fill" style="width: ${progress.progress}%"></div>
          </div>
          <div class="sga-progress-percent">${Math.round(progress.progress)}%</div>
        </div>
      </div>
    `;
  }

  /**
   * Render analysis results
   */
  private renderAnalysis(analysis: SkillGapAnalysis): string {
    const matchPercentage = Math.round(analysis.overallMatch * 100);
    
    return `
      <div class="sga-body">
        <div class="sga-analysis">
          ${this.renderOverallScore(matchPercentage)}
          ${this.renderSkillMatches(analysis)}
          ${this.renderMissingSkills(analysis)}
          ${this.renderRecommendations(analysis)}
        </div>
      </div>
    `;
  }

  /**
   * Render overall match score
   */
  private renderOverallScore(percentage: number): string {
    const scoreClass = percentage >= 80 ? 'high' : percentage >= 60 ? 'medium' : 'low';
    
    return `
      <div class="sga-score">
        <div class="sga-score-circle sga-score-${scoreClass}">
          <span class="sga-score-value">${percentage}%</span>
        </div>
        <div class="sga-score-label">Overall Match</div>
      </div>
    `;
  }

  /**
   * Render skill matches
   */
  private renderSkillMatches(analysis: SkillGapAnalysis): string {
    if (!analysis.matchingSkills.length) {
      return '';
    }
    
    const matchedSkills = analysis.matchingSkills
      .filter(match => match.matchScore >= 0.7)
      .slice(0, 5);
    
    return `
      <div class="sga-section">
        <h3 class="sga-section-title">✅ Matching Skills (${matchedSkills.length})</h3>
        <div class="sga-skills-list">
          ${matchedSkills.map(match => `
            <div class="sga-skill sga-skill-matched">
              <span class="sga-skill-name">${this.escapeHtml(match.userSkill.name)}</span>
              <span class="sga-skill-score">${Math.round(match.matchScore * 100)}%</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  /**
   * Render missing skills
   */
  private renderMissingSkills(analysis: SkillGapAnalysis): string {
    if (!analysis.missingSkills.length) {
      return '';
    }
    
    const topMissing = analysis.missingSkills
      .filter(skill => skill.isRequired)
      .slice(0, 5);
    
    return `
      <div class="sga-section">
        <h3 class="sga-section-title">❌ Missing Skills (${topMissing.length})</h3>
        <div class="sga-skills-list">
          ${topMissing.map(skill => `
            <div class="sga-skill sga-skill-missing">
              <span class="sga-skill-name">${this.escapeHtml(skill.name)}</span>
              <span class="sga-skill-category">${skill.category}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  /**
   * Render recommendations preview
   */
  private renderRecommendations(analysis: SkillGapAnalysis): string {
    if (!analysis.recommendations.length) {
      return '';
    }
    
    const topRecommendations = analysis.recommendations
      .filter(rec => rec.priority === Priority.HIGH || rec.priority === Priority.CRITICAL)
      .slice(0, 3);
    
    return `
      <div class="sga-section">
        <h3 class="sga-section-title">💡 Top Recommendations</h3>
        <div class="sga-recommendations-preview">
          ${topRecommendations.map(rec => `
            <div class="sga-recommendation">
              <span class="sga-rec-skill">${this.escapeHtml(rec.skill.name)}</span>
              <span class="sga-rec-time">${rec.estimatedTimeToLearn}h</span>
            </div>
          `).join('')}
        </div>
        <button class="sga-btn sga-btn-primary sga-btn-view-all">
          View All Recommendations
        </button>
      </div>
    `;
  }

  /**
   * Render empty state
   */
  private renderEmpty(): string {
    return `
      <div class="sga-body">
        <div class="sga-empty">
          <div class="sga-empty-icon">🔍</div>
          <div class="sga-empty-message">No analysis available</div>
        </div>
      </div>
    `;
  }

  /**
   * Attach event listeners to overlay elements
   */
  private attachOverlayEventListeners(): void {
    if (!this.shadowRoot) return;
    
    // Minimize/expand button
    const minimizeBtn = this.shadowRoot.querySelector('.sga-btn-minimize');
    if (minimizeBtn) {
      minimizeBtn.addEventListener('click', () => this.toggleMinimized());
    }
    
    // Close button
    const closeBtn = this.shadowRoot.querySelector('.sga-btn-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hide());
    }
    
    // Retry button
    const retryBtn = this.shadowRoot.querySelector('.sga-btn-retry');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => this.handleRetry());
    }
    
    // View all recommendations button
    const viewAllBtn = this.shadowRoot.querySelector('.sga-btn-view-all');
    if (viewAllBtn) {
      viewAllBtn.addEventListener('click', () => this.handleViewAllRecommendations());
    }
  }

  /**
   * Handle retry action
   */
  private handleRetry(): void {
    this.state.error = null;
    this.render();
    
    // Emit retry event
    window.dispatchEvent(new CustomEvent('sga-retry-analysis'));
  }

  /**
   * Handle view all recommendations
   */
  private handleViewAllRecommendations(): void {
    // Emit event to show detailed recommendations
    window.dispatchEvent(new CustomEvent('sga-show-recommendations', {
      detail: { analysis: this.state.analysis }
    }));
  }

  /**
   * Escape HTML to prevent XSS
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Inject CSS styles
   */
  private injectStyles(): void {
    // Styles will be injected via shadow DOM in render method
  }

  /**
   * Get CSS styles for the overlay
   */
  private getStyles(): string {
    return `
      .sga-overlay {
        position: fixed;
        top: 20px;
        right: 20px;
        width: 320px;
        max-width: calc(100vw - 40px);
        background: #ffffff;
        border: 1px solid #e1e5e9;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        line-height: 1.4;
        z-index: 2147483647;
        transition: all 0.3s ease;
      }
      
      .sga-overlay.sga-minimized {
        height: auto;
      }
      
      .sga-overlay.sga-position-top-left {
        top: 20px;
        left: 20px;
        right: auto;
      }
      
      .sga-overlay.sga-position-bottom-right {
        top: auto;
        bottom: 20px;
        right: 20px;
      }
      
      .sga-overlay.sga-position-bottom-left {
        top: auto;
        bottom: 20px;
        left: 20px;
        right: auto;
      }
      
      .sga-overlay.sga-theme-dark {
        background: #2d3748;
        border-color: #4a5568;
        color: #e2e8f0;
      }
      
      .sga-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        border-bottom: 1px solid #e1e5e9;
        background: #f7fafc;
        border-radius: 8px 8px 0 0;
      }
      
      .sga-theme-dark .sga-header {
        background: #1a202c;
        border-bottom-color: #4a5568;
      }
      
      .sga-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 600;
        color: #2d3748;
      }
      
      .sga-theme-dark .sga-title {
        color: #e2e8f0;
      }
      
      .sga-icon {
        font-size: 16px;
      }
      
      .sga-controls {
        display: flex;
        gap: 4px;
      }
      
      .sga-btn {
        background: none;
        border: none;
        padding: 4px 8px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        transition: background-color 0.2s;
      }
      
      .sga-btn:hover {
        background: #e2e8f0;
      }
      
      .sga-theme-dark .sga-btn:hover {
        background: #4a5568;
      }
      
      .sga-btn-primary {
        background: #3182ce;
        color: white;
        padding: 8px 16px;
        font-size: 14px;
        font-weight: 500;
      }
      
      .sga-btn-primary:hover {
        background: #2c5aa0;
      }
      
      .sga-body {
        padding: 16px;
        max-height: 400px;
        overflow-y: auto;
      }
      
      .sga-score {
        text-align: center;
        margin-bottom: 16px;
      }
      
      .sga-score-circle {
        width: 60px;
        height: 60px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 8px;
        font-weight: bold;
        font-size: 16px;
      }
      
      .sga-score-high {
        background: #c6f6d5;
        color: #22543d;
      }
      
      .sga-score-medium {
        background: #fef5e7;
        color: #c05621;
      }
      
      .sga-score-low {
        background: #fed7d7;
        color: #c53030;
      }
      
      .sga-section {
        margin-bottom: 16px;
      }
      
      .sga-section:last-child {
        margin-bottom: 0;
      }
      
      .sga-section-title {
        font-size: 14px;
        font-weight: 600;
        margin: 0 0 8px 0;
        color: #2d3748;
      }
      
      .sga-theme-dark .sga-section-title {
        color: #e2e8f0;
      }
      
      .sga-skills-list {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      
      .sga-skill {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 6px 8px;
        border-radius: 4px;
        font-size: 13px;
      }
      
      .sga-skill-matched {
        background: #f0fff4;
        border: 1px solid #c6f6d5;
      }
      
      .sga-skill-missing {
        background: #fff5f5;
        border: 1px solid #fed7d7;
      }
      
      .sga-skill-name {
        font-weight: 500;
      }
      
      .sga-skill-score {
        font-size: 12px;
        color: #22543d;
      }
      
      .sga-skill-category {
        font-size: 11px;
        color: #718096;
        text-transform: uppercase;
      }
      
      .sga-recommendations-preview {
        margin-bottom: 12px;
      }
      
      .sga-recommendation {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 6px 0;
        border-bottom: 1px solid #e2e8f0;
      }
      
      .sga-recommendation:last-child {
        border-bottom: none;
      }
      
      .sga-rec-skill {
        font-weight: 500;
      }
      
      .sga-rec-time {
        font-size: 12px;
        color: #718096;
      }
      
      .sga-progress {
        text-align: center;
      }
      
      .sga-progress-message {
        margin-bottom: 12px;
        color: #4a5568;
      }
      
      .sga-progress-bar {
        width: 100%;
        height: 8px;
        background: #e2e8f0;
        border-radius: 4px;
        overflow: hidden;
        margin-bottom: 8px;
      }
      
      .sga-progress-fill {
        height: 100%;
        background: #3182ce;
        transition: width 0.3s ease;
      }
      
      .sga-progress-percent {
        font-size: 12px;
        color: #718096;
      }
      
      .sga-error {
        text-align: center;
      }
      
      .sga-error-icon {
        font-size: 24px;
        margin-bottom: 8px;
      }
      
      .sga-error-message {
        color: #c53030;
        margin-bottom: 12px;
      }
      
      .sga-empty {
        text-align: center;
        padding: 20px;
      }
      
      .sga-empty-icon {
        font-size: 24px;
        margin-bottom: 8px;
      }
      
      .sga-empty-message {
        color: #718096;
      }
      
      @media (max-width: 480px) {
        .sga-overlay {
          width: calc(100vw - 20px);
          left: 10px !important;
          right: 10px !important;
        }
      }
    `;
  }

  /**
   * Destroy the overlay
   */
  public destroy(): void {
    // Remove event listeners
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
    }
    
    if (this.scrollHandler) {
      window.removeEventListener('scroll', this.scrollHandler);
    }
    
    // Remove overlay element
    if (this.overlayElement && this.overlayElement.parentNode) {
      this.overlayElement.parentNode.removeChild(this.overlayElement);
    }
    
    // Reset instance
    UIOverlayRenderer.instance = null;
  }
}