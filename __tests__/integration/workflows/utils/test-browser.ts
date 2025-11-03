/**
 * Test Browser Utility for End-to-End Testing
 * 
 * Provides browser automation capabilities for testing user workflows
 * without requiring a real browser instance.
 */

export interface PageState {
  title: string;
  url: string;
  isAuthenticated: boolean;
  isSetupWizard: boolean;
}

export interface WidgetData {
  loaded: boolean;
  lastRefresh: number;
  items: unknown[];
}

export class TestBrowser {
  private baseUrl: string;
  private currentPage: PageState | null = null;
  private sessionData: Map<string, unknown> = new Map();
  private refreshIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    this.baseUrl = 'http://localhost:3000';
  }

  /**
   * Navigate to a URL and simulate page load
   */
  async goto(url: string): Promise<TestPage> {
    this.currentPage = {
      title: 'Hyperpage',
      url: url,
      isAuthenticated: this.sessionData.has('authenticated'),
      isSetupWizard: url.includes('/setup')
    };
    return new TestPage(this);
  }

  /**
   * Get current URL
   */
  async getCurrentUrl(): Promise<string> {
    return this.currentPage?.url || this.baseUrl;
  }

  /**
   * Check if authentication is required
   */
  async isAuthenticationRequired(): Promise<boolean> {
    return !this.sessionData.has('authenticated');
  }

  /**
   * Clear current session
   */
  async clearSession(): Promise<void> {
    this.sessionData.clear();
    this.refreshIntervals.forEach(interval => clearInterval(interval));
    this.refreshIntervals.clear();
  }

  /**
   * Simulate browser restart
   */
  async restart(): Promise<void> {
    await this.clearSession();
    this.currentPage = null;
  }

  /**
   * Wait for a specified duration
   */
  async wait(duration: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, duration));
  }

  /**
   * Get session data
   */
  getSessionData(key: string): unknown {
    return this.sessionData.get(key);
  }

  /**
   * Set session data
   */
  setSessionData(key: string, value: unknown): void {
    this.sessionData.set(key, value);
  }

  /**
   * Enable auto refresh for a widget
   */
  enableAutoRefresh(widgetId: string, interval: number): void {
    // Clear existing interval if any
    const existing = this.refreshIntervals.get(widgetId);
    if (existing) {
      clearInterval(existing);
    }

    // Set up new refresh interval
    const newInterval = setInterval(() => {
      // Simulate data refresh
      this.setSessionData(`widget_${widgetId}_lastRefresh`, Date.now());
    }, interval);

    this.refreshIntervals.set(widgetId, newInterval);
  }

  /**
   * Clean up browser resources
   */
  async cleanup(): Promise<void> {
    this.refreshIntervals.forEach(interval => clearInterval(interval));
    this.refreshIntervals.clear();
    this.sessionData.clear();
    this.currentPage = null;
  }
}

/**
 * Mock Page Object for Test Browser
 */
export class TestPage {
  constructor(private browser: TestBrowser) {}

  title(): string {
    const title = this.browser.getSessionData('pageTitle');
    return (typeof title === 'string' ? title : 'Hyperpage');
  }

  url(): string {
    const url = this.browser.getSessionData('currentUrl');
    return (typeof url === 'string' ? url : 'http://localhost:3000');
  }

  async isAuthenticated(): Promise<boolean> {
    const auth = this.browser.getSessionData('authenticated');
    return (typeof auth === 'boolean' ? auth : false);
  }

  async isSetupWizard(): Promise<boolean> {
    const url = this.url();
    return url.includes('/setup');
  }

  async isTabActive(tabName: string): Promise<boolean> {
    const activeTab = this.browser.getSessionData('activeTab');
    return activeTab === tabName;
  }

  async clickTab(tabName: string): Promise<void> {
    this.browser.setSessionData('activeTab', tabName);
  }

  async getWidgetData(widgetId: string): Promise<WidgetData> {
    const lastRefresh = this.browser.getSessionData(`widget_${widgetId}_lastRefresh`);
    const items = this.browser.getSessionData(`widget_${widgetId}_items`);
    
    return {
      loaded: true,
      lastRefresh: (typeof lastRefresh === 'number' ? lastRefresh : Date.now()),
      items: (Array.isArray(items) ? items : [])
    };
  }

  async clickRefreshButton(widgetId: string): Promise<void> {
    this.browser.setSessionData(`widget_${widgetId}_lastRefresh`, Date.now());
  }

  async enableAutoRefresh(widgetId: string, interval: number): Promise<void> {
    this.browser.enableAutoRefresh(widgetId, interval);
  }
}
