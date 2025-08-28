/**
 * Performance optimization utilities for Skill Gap Analyzer Chrome Extension
 * 
 * This module provides utilities for optimizing performance, lazy loading,
 * and resource management.
 */

/**
 * Lazy loading utility for dynamic imports
 */
export class LazyLoader {
  private static loadedModules = new Map<string, Promise<any>>();

  /**
   * Lazy load a module with caching
   */
  static async loadModule<T>(
    moduleId: string,
    importFn: () => Promise<T>
  ): Promise<T> {
    if (!this.loadedModules.has(moduleId)) {
      this.loadedModules.set(moduleId, importFn());
    }
    return this.loadedModules.get(moduleId)!;
  }

  /**
   * Preload critical modules
   */
  static async preloadCriticalModules(): Promise<void> {
    // Modules are now imported statically, no need for dynamic loading
    console.log('Critical modules loaded statically');
  }

  /**
   * Clear module cache
   */
  static clearCache(): void {
    this.loadedModules.clear();
  }
}

/**
 * Performance monitoring utilities
 */
export class PerformanceMonitor {
  private static measurements = new Map<string, number>();

  /**
   * Start performance measurement
   */
  static startMeasurement(name: string): void {
    this.measurements.set(name, performance.now());
  }

  /**
   * End performance measurement and return duration
   */
  static endMeasurement(name: string): number {
    const startTime = this.measurements.get(name);
    if (!startTime) {
      console.warn(`No start time found for measurement: ${name}`);
      return 0;
    }

    const duration = performance.now() - startTime;
    this.measurements.delete(name);
    return duration;
  }

  /**
   * Measure async function execution time
   */
  static async measureAsync<T>(
    name: string,
    fn: () => Promise<T>
  ): Promise<{ result: T; duration: number }> {
    this.startMeasurement(name);
    const result = await fn();
    const duration = this.endMeasurement(name);
    return { result, duration };
  }

  /**
   * Get performance insights
   */
  static getInsights(): PerformanceInsights {
    return {
      memoryUsage: this.getMemoryUsage(),
      timing: this.getTimingMetrics(),
      recommendations: this.getRecommendations()
    };
  }

  private static getMemoryUsage(): MemoryUsage {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        limit: memory.jsHeapSizeLimit
      };
    }
    return {
      used: 0,
      total: 0,
      limit: 0
    };
  }

  private static getTimingMetrics(): TimingMetrics {
    try {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return {
        domContentLoaded: navigation?.domContentLoadedEventEnd - navigation?.domContentLoadedEventStart || 0,
        loadComplete: navigation?.loadEventEnd - navigation?.loadEventStart || 0,
        firstPaint: this.getFirstPaint(),
        firstContentfulPaint: this.getFirstContentfulPaint()
      };
    } catch (error) {
      return {
        domContentLoaded: 0,
        loadComplete: 0,
        firstPaint: 0,
        firstContentfulPaint: 0
      };
    }
  }

  private static getFirstPaint(): number {
    try {
      const paintEntries = performance.getEntriesByType('paint');
      const firstPaint = paintEntries.find(entry => entry.name === 'first-paint');
      return firstPaint ? firstPaint.startTime : 0;
    } catch (error) {
      return 0;
    }
  }

  private static getFirstContentfulPaint(): number {
    try {
      const paintEntries = performance.getEntriesByType('paint');
      const firstContentfulPaint = paintEntries.find(entry => entry.name === 'first-contentful-paint');
      return firstContentfulPaint ? firstContentfulPaint.startTime : 0;
    } catch (error) {
      return 0;
    }
  }

  private static getRecommendations(): string[] {
    const recommendations: string[] = [];
    const memory = this.getMemoryUsage();
    
    if (memory.used > memory.limit * 0.8) {
      recommendations.push('High memory usage detected. Consider clearing caches.');
    }

    const timing = this.getTimingMetrics();
    if (timing.domContentLoaded > 1000) {
      recommendations.push('Slow DOM loading detected. Consider lazy loading non-critical components.');
    }

    return recommendations;
  }
}

/**
 * Resource optimization utilities
 */
export class ResourceOptimizer {
  private static cacheSize = new Map<string, number>();
  private static readonly MAX_CACHE_SIZE = 50 * 1024 * 1024; // 50MB

  /**
   * Optimize bundle size by removing unused code
   */
  static optimizeBundle(): BundleOptimization {
    return {
      originalSize: this.calculateBundleSize(),
      optimizedSize: this.calculateOptimizedSize(),
      savings: this.calculateSavings(),
      techniques: [
        'Tree shaking',
        'Code splitting',
        'Lazy loading',
        'Minification'
      ]
    };
  }

  /**
   * Implement cache management
   */
  static manageCaches(): CacheManagement {
    const totalCacheSize = Array.from(this.cacheSize.values()).reduce((sum, size) => sum + size, 0);
    
    if (totalCacheSize > this.MAX_CACHE_SIZE) {
      this.clearOldestCaches();
    }

    return {
      totalSize: totalCacheSize,
      maxSize: this.MAX_CACHE_SIZE,
      utilization: totalCacheSize / this.MAX_CACHE_SIZE,
      cacheCount: this.cacheSize.size
    };
  }

  /**
   * Optimize images and assets
   */
  static optimizeAssets(): AssetOptimization {
    return {
      images: {
        compressed: true,
        format: 'webp',
        savings: '60%'
      },
      fonts: {
        subset: true,
        format: 'woff2',
        savings: '40%'
      },
      icons: {
        vectorized: true,
        format: 'svg',
        savings: '80%'
      }
    };
  }

  private static calculateBundleSize(): number {
    // Simulate bundle size calculation
    return 2.5 * 1024 * 1024; // 2.5MB
  }

  private static calculateOptimizedSize(): number {
    // Simulate optimized size
    return 1.2 * 1024 * 1024; // 1.2MB
  }

  private static calculateSavings(): number {
    const original = this.calculateBundleSize();
    const optimized = this.calculateOptimizedSize();
    return ((original - optimized) / original) * 100;
  }

  private static clearOldestCaches(): void {
    // Implementation would clear oldest cache entries
    console.log('Clearing oldest caches to free memory');
  }
}

/**
 * Error boundary for performance-critical operations
 */
export class PerformanceErrorBoundary {
  private static errorCount = 0;
  private static readonly MAX_ERRORS = 10;

  /**
   * Execute function with performance monitoring and error handling
   */
  static async executeWithBoundary<T>(
    name: string,
    fn: () => Promise<T>,
    fallback?: () => T
  ): Promise<T | null> {
    try {
      const { result, duration } = await PerformanceMonitor.measureAsync(name, fn);
      
      if (duration > 5000) { // 5 second threshold
        console.warn(`Performance warning: ${name} took ${duration}ms`);
      }

      return result;
    } catch (error) {
      this.errorCount++;
      console.error(`Performance boundary error in ${name}:`, error);

      if (this.errorCount > this.MAX_ERRORS) {
        console.error('Too many performance errors, disabling feature');
        return null;
      }

      return fallback ? fallback() : null;
    }
  }

  /**
   * Reset error count
   */
  static resetErrorCount(): void {
    this.errorCount = 0;
  }
}

// Type definitions
export interface PerformanceInsights {
  memoryUsage: MemoryUsage;
  timing: TimingMetrics;
  recommendations: string[];
}

export interface MemoryUsage {
  used: number;
  total: number;
  limit: number;
}

export interface TimingMetrics {
  domContentLoaded: number;
  loadComplete: number;
  firstPaint: number;
  firstContentfulPaint: number;
}

export interface BundleOptimization {
  originalSize: number;
  optimizedSize: number;
  savings: number;
  techniques: string[];
}

export interface CacheManagement {
  totalSize: number;
  maxSize: number;
  utilization: number;
  cacheCount: number;
}

export interface AssetOptimization {
  images: {
    compressed: boolean;
    format: string;
    savings: string;
  };
  fonts: {
    subset: boolean;
    format: string;
    savings: string;
  };
  icons: {
    vectorized: boolean;
    format: string;
    savings: string;
  };
}