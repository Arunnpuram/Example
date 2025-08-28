/**
 * Recommendation Display System
 * Handles detailed view of learning resource suggestions with expandable sections
 */

import { SkillGapAnalysis, LearningRecommendation, Priority, ResourceType, DifficultyLevel } from '@/core/types';

export interface RecommendationDisplayConfig {
  maxVisible: number;
  groupByPriority: boolean;
  showTimeEstimates: boolean;
  showDifficulty: boolean;
  expandable: boolean;
}

export interface RecommendationSection {
  priority: Priority;
  recommendations: LearningRecommendation[];
  isExpanded: boolean;
  totalTime: number;
}

/**
 * Manages the detailed recommendation display system
 */
export class RecommendationDisplayManager {
  private static instance: RecommendationDisplayManager | null = null;
  
  private containerElement: HTMLElement | null = null;
  private shadowRoot: ShadowRoot | null = null;
  private config: RecommendationDisplayConfig;
  private sections: Map<Priority, RecommendationSection> = new Map();
  private currentAnalysis: SkillGapAnalysis | null = null;
  
  private constructor(config: Partial<RecommendationDisplayConfig> = {}) {
    this.config = {
      maxVisible: 10,
      groupByPriority: true,
      showTimeEstimates: true,
      showDifficulty: true,
      expandable: true,
      ...config
    };
  }

  /**
   * Get or create singleton instance
   */
  public static getInstance(config?: Partial<RecommendationDisplayConfig>): RecommendationDisplayManager {
    if (!RecommendationDisplayManager.instance) {
      RecommendationDisplayManager.instance = new RecommendationDisplayManager(config);
    }
    return RecommendationDisplayManager.instance;
  }

  /**
   * Initialize the recommendation display
   */
  public initialize(containerId: string = 'sga-recommendations-container'): void {
    if (this.containerElement) {
      return; // Already initialized
    }

    this.createContainer(containerId);
    this.injectStyles();
    
    console.log('✅ Recommendation Display initialized');
  }

  /**
   * Display recommendations from analysis
   */
  public displayRecommendations(analysis: SkillGapAnalysis): void {
    this.currentAnalysis = analysis;
    this.processRecommendations(analysis.recommendations);
    this.render();
  }

  /**
   * Show detailed view for specific recommendation
   */
  public showRecommendationDetails(recommendationId: string): void {
    if (!this.currentAnalysis) return;
    
    const recommendation = this.findRecommendationById(recommendationId);
    if (recommendation) {
      this.renderDetailedView(recommendation);
    }
  }

  /**
   * Toggle section expansion
   */
  public toggleSection(priority: Priority): void {
    const section = this.sections.get(priority);
    if (section) {
      section.isExpanded = !section.isExpanded;
      this.render();
    }
  }

  /**
   * Filter recommendations by criteria
   */
  public filterRecommendations(criteria: {
    priority?: Priority[];
    maxTime?: number;
    difficulty?: DifficultyLevel[];
    resourceType?: ResourceType[];
  }): void {
    if (!this.currentAnalysis) return;
    
    let filtered = this.currentAnalysis.recommendations;
    
    if (criteria.priority) {
      filtered = filtered.filter(rec => criteria.priority!.includes(rec.priority));
    }
    
    if (criteria.maxTime) {
      filtered = filtered.filter(rec => rec.estimatedTimeToLearn <= criteria.maxTime!);
    }
    
    if (criteria.difficulty) {
      filtered = filtered.filter(rec => 
        rec.resources.some(resource => criteria.difficulty!.includes(resource.difficulty))
      );
    }
    
    if (criteria.resourceType) {
      filtered = filtered.filter(rec =>
        rec.resources.some(resource => criteria.resourceType!.includes(resource.type))
      );
    }
    
    this.processRecommendations(filtered);
    this.render();
  }

  /**
   * Create container element
   */
  private createContainer(containerId: string): void {
    this.containerElement = document.createElement('div');
    this.containerElement.id = containerId;
    this.containerElement.setAttribute('data-sga-recommendations', 'true');
    
    // Create shadow DOM for style isolation
    this.shadowRoot = this.containerElement.attachShadow({ mode: 'closed' });
  }

  /**
   * Process recommendations into sections
   */
  private processRecommendations(recommendations: LearningRecommendation[]): void {
    this.sections.clear();
    
    if (this.config.groupByPriority) {
      this.groupByPriority(recommendations);
    } else {
      // Single section with all recommendations
      const section: RecommendationSection = {
        priority: Priority.MEDIUM,
        recommendations: recommendations.slice(0, this.config.maxVisible),
        isExpanded: true,
        totalTime: this.calculateTotalTime(recommendations)
      };
      this.sections.set(Priority.MEDIUM, section);
    }
  }

  /**
   * Group recommendations by priority
   */
  private groupByPriority(recommendations: LearningRecommendation[]): void {
    const priorityOrder = [Priority.CRITICAL, Priority.HIGH, Priority.MEDIUM, Priority.LOW];
    
    for (const priority of priorityOrder) {
      const priorityRecs = recommendations.filter(rec => rec.priority === priority);
      
      if (priorityRecs.length > 0) {
        const section: RecommendationSection = {
          priority,
          recommendations: priorityRecs,
          isExpanded: priority === Priority.CRITICAL || priority === Priority.HIGH,
          totalTime: this.calculateTotalTime(priorityRecs)
        };
        this.sections.set(priority, section);
      }
    }
  }

  /**
   * Calculate total learning time
   */
  private calculateTotalTime(recommendations: LearningRecommendation[]): number {
    return recommendations.reduce((total, rec) => total + rec.estimatedTimeToLearn, 0);
  }

  /**
   * Find recommendation by ID
   */
  private findRecommendationById(id: string): LearningRecommendation | null {
    if (!this.currentAnalysis) return null;
    
    return this.currentAnalysis.recommendations.find(rec => 
      this.generateRecommendationId(rec) === id
    ) || null;
  }

  /**
   * Generate unique ID for recommendation
   */
  private generateRecommendationId(recommendation: LearningRecommendation): string {
    return `rec_${recommendation.skill.name.toLowerCase().replace(/\s+/g, '_')}_${recommendation.priority}`;
  }

  /**
   * Render the recommendations display
   */
  private render(): void {
    if (!this.shadowRoot) return;
    
    const content = this.renderContent();
    
    this.shadowRoot.innerHTML = `
      <style>${this.getStyles()}</style>
      ${content}
    `;
    
    this.attachEventListeners();
  }

  /**
   * Render main content
   */
  private renderContent(): string {
    if (this.sections.size === 0) {
      return this.renderEmptyState();
    }
    
    return `
      <div class="sga-rec-display">
        ${this.renderHeader()}
        ${this.renderSections()}
      </div>
    `;
  }

  /**
   * Render header with summary
   */
  private renderHeader(): string {
    const totalRecommendations = Array.from(this.sections.values())
      .reduce((total, section) => total + section.recommendations.length, 0);
    
    const totalTime = Array.from(this.sections.values())
      .reduce((total, section) => total + section.totalTime, 0);
    
    return `
      <div class="sga-rec-header">
        <h2 class="sga-rec-title">Learning Recommendations</h2>
        <div class="sga-rec-summary">
          <span class="sga-rec-count">${totalRecommendations} skills to learn</span>
          ${this.config.showTimeEstimates ? `
            <span class="sga-rec-time">~${totalTime} hours total</span>
          ` : ''}
        </div>
      </div>
    `;
  }

  /**
   * Render all sections
   */
  private renderSections(): string {
    return Array.from(this.sections.entries())
      .map(([priority, section]) => this.renderSection(priority, section))
      .join('');
  }

  /**
   * Render individual section
   */
  private renderSection(priority: Priority, section: RecommendationSection): string {
    const priorityLabel = this.getPriorityLabel(priority);
    const priorityIcon = this.getPriorityIcon(priority);
    
    return `
      <div class="sga-rec-section sga-priority-${priority}">
        <div class="sga-rec-section-header" data-priority="${priority}">
          <div class="sga-rec-section-title">
            <span class="sga-priority-icon">${priorityIcon}</span>
            <span class="sga-priority-label">${priorityLabel}</span>
            <span class="sga-rec-section-count">(${section.recommendations.length})</span>
          </div>
          ${this.config.expandable ? `
            <button class="sga-expand-btn" data-priority="${priority}">
              ${section.isExpanded ? '▼' : '▶'}
            </button>
          ` : ''}
        </div>
        
        ${section.isExpanded ? `
          <div class="sga-rec-section-content">
            ${section.recommendations.map(rec => this.renderRecommendation(rec)).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * Render individual recommendation
   */
  private renderRecommendation(recommendation: LearningRecommendation): string {
    const recId = this.generateRecommendationId(recommendation);
    
    return `
      <div class="sga-recommendation" data-rec-id="${recId}">
        <div class="sga-rec-main">
          <div class="sga-rec-skill">
            <span class="sga-skill-name">${this.escapeHtml(recommendation.skill.name)}</span>
            <span class="sga-skill-category">${recommendation.skill.category}</span>
          </div>
          
          <div class="sga-rec-meta">
            ${this.config.showTimeEstimates ? `
              <span class="sga-rec-time">
                <span class="sga-time-icon">⏱️</span>
                ${recommendation.estimatedTimeToLearn}h
              </span>
            ` : ''}
            
            <span class="sga-rec-priority sga-priority-${recommendation.priority}">
              ${this.getPriorityLabel(recommendation.priority)}
            </span>
          </div>
        </div>
        
        ${recommendation.resources.length > 0 ? `
          <div class="sga-rec-resources">
            <div class="sga-resources-header">
              <span class="sga-resources-title">Learning Resources (${recommendation.resources.length})</span>
              <button class="sga-toggle-resources" data-rec-id="${recId}">
                Show Resources
              </button>
            </div>
            
            <div class="sga-resources-list" data-rec-id="${recId}" style="display: none;">
              ${recommendation.resources.slice(0, 3).map(resource => this.renderResource(resource)).join('')}
              ${recommendation.resources.length > 3 ? `
                <div class="sga-more-resources">
                  +${recommendation.resources.length - 3} more resources
                </div>
              ` : ''}
            </div>
          </div>
        ` : ''}
        
        ${recommendation.prerequisites && recommendation.prerequisites.length > 0 ? `
          <div class="sga-rec-prerequisites">
            <span class="sga-prereq-label">Prerequisites:</span>
            <span class="sga-prereq-list">${recommendation.prerequisites.join(', ')}</span>
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * Render learning resource
   */
  private renderResource(resource: any): string {
    return `
      <div class="sga-resource">
        <div class="sga-resource-main">
          <a href="${resource.url}" target="_blank" class="sga-resource-title">
            ${this.escapeHtml(resource.title)}
          </a>
          <span class="sga-resource-provider">${this.escapeHtml(resource.provider)}</span>
        </div>
        
        <div class="sga-resource-meta">
          <span class="sga-resource-type sga-type-${resource.type}">${resource.type}</span>
          
          ${this.config.showDifficulty ? `
            <span class="sga-resource-difficulty sga-diff-${resource.difficulty}">
              ${resource.difficulty}
            </span>
          ` : ''}
          
          ${resource.duration ? `
            <span class="sga-resource-duration">${resource.duration}h</span>
          ` : ''}
          
          ${resource.rating ? `
            <span class="sga-resource-rating">
              ${'★'.repeat(Math.floor(resource.rating))}${'☆'.repeat(5 - Math.floor(resource.rating))}
            </span>
          ` : ''}
        </div>
      </div>
    `;
  }

  /**
   * Render detailed view for recommendation
   */
  private renderDetailedView(recommendation: LearningRecommendation): void {
    // This would open a modal or expanded view
    // For now, just log the detailed information
    console.log('📋 Detailed view for:', recommendation.skill.name, recommendation);
  }

  /**
   * Render empty state
   */
  private renderEmptyState(): string {
    return `
      <div class="sga-rec-empty">
        <div class="sga-empty-icon">📚</div>
        <div class="sga-empty-title">No Recommendations Available</div>
        <div class="sga-empty-message">
          Complete a skill gap analysis to see personalized learning recommendations.
        </div>
      </div>
    `;
  }

  /**
   * Get priority label
   */
  private getPriorityLabel(priority: Priority): string {
    const labels = {
      [Priority.CRITICAL]: 'Critical',
      [Priority.HIGH]: 'High Priority',
      [Priority.MEDIUM]: 'Medium Priority',
      [Priority.LOW]: 'Low Priority'
    };
    return labels[priority];
  }

  /**
   * Get priority icon
   */
  private getPriorityIcon(priority: Priority): string {
    const icons = {
      [Priority.CRITICAL]: '🔥',
      [Priority.HIGH]: '⚡',
      [Priority.MEDIUM]: '📈',
      [Priority.LOW]: '📝'
    };
    return icons[priority];
  }

  /**
   * Attach event listeners
   */
  private attachEventListeners(): void {
    if (!this.shadowRoot) return;
    
    // Section expand/collapse
    const expandBtns = this.shadowRoot.querySelectorAll('.sga-expand-btn');
    expandBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const priority = (e.target as HTMLElement).getAttribute('data-priority') as Priority;
        this.toggleSection(priority);
      });
    });
    
    // Resource toggle
    const resourceBtns = this.shadowRoot.querySelectorAll('.sga-toggle-resources');
    resourceBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const recId = (e.target as HTMLElement).getAttribute('data-rec-id');
        this.toggleResources(recId!);
      });
    });
    
    // Recommendation details
    const recommendations = this.shadowRoot.querySelectorAll('.sga-recommendation');
    recommendations.forEach(rec => {
      rec.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).tagName !== 'BUTTON' && (e.target as HTMLElement).tagName !== 'A') {
          const recId = (e.currentTarget as HTMLElement).getAttribute('data-rec-id');
          this.showRecommendationDetails(recId!);
        }
      });
    });
  }

  /**
   * Toggle resource visibility
   */
  private toggleResources(recId: string): void {
    if (!this.shadowRoot) return;
    
    const resourcesList = this.shadowRoot.querySelector(`[data-rec-id="${recId}"].sga-resources-list`) as HTMLElement;
    const toggleBtn = this.shadowRoot.querySelector(`[data-rec-id="${recId}"].sga-toggle-resources`) as HTMLElement;
    
    if (resourcesList && toggleBtn) {
      const isVisible = resourcesList.style.display !== 'none';
      resourcesList.style.display = isVisible ? 'none' : 'block';
      toggleBtn.textContent = isVisible ? 'Show Resources' : 'Hide Resources';
    }
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
   * Get CSS styles
   */
  private getStyles(): string {
    return `
      .sga-rec-display {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        line-height: 1.5;
        color: #2d3748;
        background: #ffffff;
        border-radius: 8px;
        overflow: hidden;
      }
      
      .sga-rec-header {
        padding: 20px;
        background: #f7fafc;
        border-bottom: 1px solid #e2e8f0;
      }
      
      .sga-rec-title {
        margin: 0 0 8px 0;
        font-size: 20px;
        font-weight: 600;
        color: #1a202c;
      }
      
      .sga-rec-summary {
        display: flex;
        gap: 16px;
        font-size: 14px;
        color: #4a5568;
      }
      
      .sga-rec-count {
        font-weight: 500;
      }
      
      .sga-rec-time {
        color: #718096;
      }
      
      .sga-rec-section {
        border-bottom: 1px solid #e2e8f0;
      }
      
      .sga-rec-section:last-child {
        border-bottom: none;
      }
      
      .sga-rec-section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 20px;
        background: #f8f9fa;
        cursor: pointer;
        transition: background-color 0.2s;
      }
      
      .sga-rec-section-header:hover {
        background: #e9ecef;
      }
      
      .sga-rec-section-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 600;
      }
      
      .sga-priority-icon {
        font-size: 16px;
      }
      
      .sga-rec-section-count {
        color: #718096;
        font-weight: normal;
      }
      
      .sga-expand-btn {
        background: none;
        border: none;
        font-size: 12px;
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        transition: background-color 0.2s;
      }
      
      .sga-expand-btn:hover {
        background: #e2e8f0;
      }
      
      .sga-rec-section-content {
        padding: 0;
      }
      
      .sga-recommendation {
        padding: 16px 20px;
        border-bottom: 1px solid #f1f3f4;
        cursor: pointer;
        transition: background-color 0.2s;
      }
      
      .sga-recommendation:hover {
        background: #f8f9fa;
      }
      
      .sga-recommendation:last-child {
        border-bottom: none;
      }
      
      .sga-rec-main {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 12px;
      }
      
      .sga-rec-skill {
        flex: 1;
      }
      
      .sga-skill-name {
        font-weight: 600;
        font-size: 16px;
        color: #1a202c;
        display: block;
        margin-bottom: 4px;
      }
      
      .sga-skill-category {
        font-size: 12px;
        color: #718096;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      
      .sga-rec-meta {
        display: flex;
        gap: 12px;
        align-items: center;
      }
      
      .sga-rec-time {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 13px;
        color: #4a5568;
      }
      
      .sga-time-icon {
        font-size: 12px;
      }
      
      .sga-rec-priority {
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 11px;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      
      .sga-priority-critical {
        background: #fed7d7;
        color: #c53030;
      }
      
      .sga-priority-high {
        background: #fef5e7;
        color: #c05621;
      }
      
      .sga-priority-medium {
        background: #e6fffa;
        color: #234e52;
      }
      
      .sga-priority-low {
        background: #f0f4f8;
        color: #4a5568;
      }
      
      .sga-rec-resources {
        margin-top: 12px;
        padding-top: 12px;
        border-top: 1px solid #e2e8f0;
      }
      
      .sga-resources-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
      }
      
      .sga-resources-title {
        font-weight: 500;
        color: #4a5568;
      }
      
      .sga-toggle-resources {
        background: #3182ce;
        color: white;
        border: none;
        padding: 4px 12px;
        border-radius: 4px;
        font-size: 12px;
        cursor: pointer;
        transition: background-color 0.2s;
      }
      
      .sga-toggle-resources:hover {
        background: #2c5aa0;
      }
      
      .sga-resources-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      
      .sga-resource {
        padding: 8px 12px;
        background: #f8f9fa;
        border-radius: 6px;
        border: 1px solid #e9ecef;
      }
      
      .sga-resource-main {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 4px;
      }
      
      .sga-resource-title {
        color: #3182ce;
        text-decoration: none;
        font-weight: 500;
        font-size: 14px;
      }
      
      .sga-resource-title:hover {
        text-decoration: underline;
      }
      
      .sga-resource-provider {
        font-size: 12px;
        color: #718096;
      }
      
      .sga-resource-meta {
        display: flex;
        gap: 8px;
        align-items: center;
        flex-wrap: wrap;
      }
      
      .sga-resource-type {
        padding: 1px 6px;
        border-radius: 8px;
        font-size: 10px;
        font-weight: 500;
        text-transform: uppercase;
        background: #e2e8f0;
        color: #4a5568;
      }
      
      .sga-type-course {
        background: #c6f6d5;
        color: #22543d;
      }
      
      .sga-type-tutorial {
        background: #bee3f8;
        color: #2a4365;
      }
      
      .sga-type-video {
        background: #fbb6ce;
        color: #702459;
      }
      
      .sga-resource-difficulty {
        font-size: 11px;
        color: #718096;
      }
      
      .sga-diff-beginner {
        color: #22543d;
      }
      
      .sga-diff-intermediate {
        color: #c05621;
      }
      
      .sga-diff-advanced {
        color: #c53030;
      }
      
      .sga-resource-duration {
        font-size: 11px;
        color: #718096;
      }
      
      .sga-resource-rating {
        font-size: 12px;
        color: #f6ad55;
      }
      
      .sga-more-resources {
        padding: 8px 12px;
        text-align: center;
        color: #718096;
        font-size: 12px;
        font-style: italic;
      }
      
      .sga-rec-prerequisites {
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px solid #e2e8f0;
        font-size: 12px;
      }
      
      .sga-prereq-label {
        font-weight: 500;
        color: #4a5568;
      }
      
      .sga-prereq-list {
        color: #718096;
      }
      
      .sga-rec-empty {
        text-align: center;
        padding: 60px 20px;
      }
      
      .sga-empty-icon {
        font-size: 48px;
        margin-bottom: 16px;
      }
      
      .sga-empty-title {
        font-size: 18px;
        font-weight: 600;
        color: #1a202c;
        margin-bottom: 8px;
      }
      
      .sga-empty-message {
        color: #718096;
        max-width: 300px;
        margin: 0 auto;
      }
    `;
  }

  /**
   * Destroy the recommendation display
   */
  public destroy(): void {
    if (this.containerElement && this.containerElement.parentNode) {
      this.containerElement.parentNode.removeChild(this.containerElement);
    }
    
    this.sections.clear();
    this.currentAnalysis = null;
    RecommendationDisplayManager.instance = null;
  }
}