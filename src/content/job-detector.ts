import { JobSite, JobPageInfo } from '../core/types';

/**
 * JobPageDetector - Detects job posting pages across multiple job sites
 * Handles URL pattern matching and DOM structure analysis
 */
export class JobPageDetector {
  private static readonly JOB_SITE_PATTERNS: Record<JobSite, {
    urlPatterns: RegExp[];
    selectors: {
      jobTitle: string;
      company: string;
      description: string;
    };
  }> = {
    [JobSite.LINKEDIN]: {
      urlPatterns: [
        /linkedin\.com\/jobs\/view\/\d+/,
        /linkedin\.com\/jobs\/collections\/.*\/jobs\/\d+/
      ],
      selectors: {
        jobTitle: 'h1.top-card-layout__title, h1.t-24',
        company: '.topcard__org-name-link, .job-details-jobs-unified-top-card__company-name',
        description: '.description__text, .jobs-description-content__text'
      }
    },
    [JobSite.INDEED]: {
      urlPatterns: [
        /indeed\.com\/viewjob\?jk=/,
        /indeed\.com\/jobs\/view\//
      ],
      selectors: {
        jobTitle: '[data-testid="jobsearch-JobInfoHeader-title"], h1.jobsearch-JobInfoHeader-title',
        company: '[data-testid="inlineHeader-companyName"], .jobsearch-InlineCompanyRating',
        description: '#jobDescriptionText, .jobsearch-jobDescriptionText'
      }
    },
    [JobSite.GLASSDOOR]: {
      urlPatterns: [
        /glassdoor\.com\/job-listing\//,
        /glassdoor\.com\/partner\/jobListing\.htm/
      ],
      selectors: {
        jobTitle: '[data-test="job-title"], .jobHeader h1',
        company: '[data-test="employer-name"], .jobHeader .strong',
        description: '#JobDescriptionContainer, .jobDescriptionContent'
      }
    }
  };

  private currentSite: JobSite | null = null;
  private lastUrl: string = '';
  private observer: MutationObserver | null = null;

  /**
   * Initialize the detector and start monitoring for job pages
   */
  public initialize(): void {
    this.detectCurrentPage();
    this.setupNavigationListener();
    this.setupDOMObserver();
  }

  /**
   * Detect if current page is a job posting
   */
  public detectCurrentPage(): JobPageInfo | null {
    const currentUrl = window.location.href;
    
    // Check if URL has changed (for SPA navigation)
    if (currentUrl !== this.lastUrl) {
      this.lastUrl = currentUrl;
      this.currentSite = this.identifyJobSite(currentUrl);
    }

    if (!this.currentSite) {
      return null;
    }

    return this.extractJobPageInfo();
  }

  /**
   * Check if current page is a job posting page
   */
  public isJobPage(): boolean {
    return this.detectCurrentPage() !== null;
  }

  /**
   * Get the current job site type
   */
  public getCurrentSite(): JobSite | null {
    return this.currentSite;
  }

  /**
   * Clean up observers and listeners
   */
  public destroy(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }

  /**
   * Identify which job site we're on based on URL
   */
  private identifyJobSite(url: string): JobSite | null {
    for (const [site, config] of Object.entries(JobPageDetector.JOB_SITE_PATTERNS)) {
      if (config.urlPatterns.some(pattern => pattern.test(url))) {
        return site as JobSite;
      }
    }
    return null;
  }

  /**
   * Extract job information from the current page
   */
  private extractJobPageInfo(): JobPageInfo | null {
    if (!this.currentSite) {
      return null;
    }

    const config = JobPageDetector.JOB_SITE_PATTERNS[this.currentSite];
    
    // Check if job content elements exist
    const titleElement = this.findElement(config.selectors.jobTitle);
    const companyElement = this.findElement(config.selectors.company);
    const descriptionElement = this.findElement(config.selectors.description);

    if (!titleElement || !descriptionElement) {
      return null;
    }

    return {
      site: this.currentSite,
      url: window.location.href,
      title: titleElement.textContent?.trim() || '',
      company: companyElement?.textContent?.trim() || '',
      hasJobDescription: !!descriptionElement,
      selectors: config.selectors
    };
  }

  /**
   * Find element using multiple selectors
   */
  private findElement(selectors: string): Element | null {
    const selectorList = selectors.split(', ');
    
    for (const selector of selectorList) {
      const element = document.querySelector(selector.trim());
      if (element) {
        return element;
      }
    }
    
    return null;
  }

  /**
   * Setup listener for SPA navigation changes
   */
  private setupNavigationListener(): void {
    // Listen for pushState/replaceState changes (SPA navigation)
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = (...args) => {
      originalPushState.apply(history, args);
      setTimeout(() => this.handleNavigationChange(), 100);
    };

    history.replaceState = (...args) => {
      originalReplaceState.apply(history, args);
      setTimeout(() => this.handleNavigationChange(), 100);
    };

    // Listen for popstate events (back/forward navigation)
    window.addEventListener('popstate', () => {
      setTimeout(() => this.handleNavigationChange(), 100);
    });
  }

  /**
   * Setup DOM observer for dynamic content changes
   */
  private setupDOMObserver(): void {
    this.observer = new MutationObserver((mutations) => {
      // Check if significant DOM changes occurred
      const hasSignificantChanges = mutations.some(mutation => 
        mutation.type === 'childList' && 
        mutation.addedNodes.length > 0 &&
        Array.from(mutation.addedNodes).some(node => 
          node.nodeType === Node.ELEMENT_NODE &&
          (node as Element).tagName !== 'SCRIPT'
        )
      );

      if (hasSignificantChanges) {
        // Debounce the detection to avoid excessive calls
        setTimeout(() => this.handleNavigationChange(), 500);
      }
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  /**
   * Handle navigation changes and re-detect job pages
   */
  private handleNavigationChange(): void {
    const jobInfo = this.detectCurrentPage();
    
    if (jobInfo) {
      // Dispatch custom event for job page detection
      window.dispatchEvent(new CustomEvent('jobPageDetected', {
        detail: jobInfo
      }));
    } else {
      // Dispatch event for non-job page
      window.dispatchEvent(new CustomEvent('jobPageLeft'));
    }
  }
}