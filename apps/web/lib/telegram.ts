// Type declarations for Telegram WebApp
declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp;
    };
  }
}

export interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    query_id?: string;
    user?: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
      language_code?: string;
      is_premium?: boolean;
      photo_url?: string;
    };
    auth_date?: string;
    hash?: string;
  };
  version: string;
  platform: string;
  colorScheme: 'light' | 'dark';
  themeParams: {
    bg_color?: string;
    text_color?: string;
    hint_color?: string;
    link_color?: string;
    button_color?: string;
    button_text_color?: string;
  };
  isExpanded: boolean;
  viewportHeight: number;
  viewportStableHeight: number;
  
  // Methods
  ready(): void;
  expand(): void;
  close(): void;
  showAlert(message: string): void;
  showConfirm(message: string, callback?: (confirmed: boolean) => void): void;
  showPopup(params: {
    title?: string;
    message: string;
    buttons?: Array<{
      id?: string;
      type?: 'default' | 'ok' | 'close' | 'cancel' | 'destructive';
      text?: string;
    }>;
  }): void;
  
  // Back button
  BackButton: {
    isVisible: boolean;
    show(): void;
    hide(): void;
    onClick(callback: () => void): void;
    offClick(callback: () => void): void;
  };
  
  // Main button
  MainButton: {
    text: string;
    color: string;
    textColor: string;
    isVisible: boolean;
    isActive: boolean;
    isProgressVisible: boolean;
    setText(text: string): void;
    setColor(color: string): void;
    show(): void;
    hide(): void;
    enable(): void;
    disable(): void;
    showProgress(leaveActive?: boolean): void;
    hideProgress(): void;
    onClick(callback: () => void): void;
    offClick(callback: () => void): void;
  };
  
  // Haptic feedback
  HapticFeedback: {
    impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void;
    notificationOccurred(type: 'error' | 'success' | 'warning'): void;
    selectionChanged(): void;
  };
  
  // Clipboard
  readTextFromClipboard(callback?: (text: string) => void): void;
  
  // Events
  onEvent(eventType: string, callback: () => void): void;
  offEvent(eventType: string, callback: () => void): void;
  sendData(data: any): void;
  
  // Settings
  setHeaderColor(color: string): void;
  setBackgroundColor(color: string): void;
  setBottomBarColor(color: string): void;
  enableClosingConfirmation(): void;
  disableClosingConfirmation(): void;
}

// Get Telegram WebApp instance with type safety
export function getTelegramWebApp(): TelegramWebApp | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.Telegram?.WebApp;
}

// Check if running in Telegram
export function isTelegramWebApp(): boolean {
  return !!getTelegramWebApp();
}

// Get initialization data
export function getInitData(): string {
  try {
    const tg = getTelegramWebApp();
    return tg?.initData || "";
  } catch (error) {
    console.error('Failed to get init data:', error);
    return "";
  }
}

// Get unsafe initialization data (parsed)
export function getInitDataUnsafe() {
  try {
    const tg = getTelegramWebApp();
    return tg?.initDataUnsafe || {};
  } catch (error) {
    console.error('Failed to get unsafe init data:', error);
    return {};
  }
}

// Get current user
export function getCurrentUser() {
  const unsafe = getInitDataUnsafe();
  return unsafe.user || null;
}

// Mark the WebApp as ready
export function ready(): void {
  try {
    const tg = getTelegramWebApp();
    tg?.ready();
  } catch (error) {
    console.error('Failed to call ready():', error);
  }
}

// Expand the WebApp to full height
export function expand(): void {
  try {
    const tg = getTelegramWebApp();
    tg?.expand();
  } catch (error) {
    console.error('Failed to call expand():', error);
  }
}

// Close the WebApp
export function close(): void {
  try {
    const tg = getTelegramWebApp();
    tg?.close();
  } catch (error) {
    console.error('Failed to call close():', error);
  }
}

// Show alert message
export function showAlert(message: string): Promise<void> {
  return new Promise((resolve) => {
    try {
      const tg = getTelegramWebApp();
      if (tg?.showAlert) {
        tg.showAlert(message);
      } else {
        // Fallback for development
        window.alert(message);
      }
      resolve();
    } catch (error) {
      console.error('Failed to show alert:', error);
      resolve();
    }
  });
}

// Show confirm dialog
export function showConfirm(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const tg = getTelegramWebApp();
      if (tg?.showConfirm) {
        tg.showConfirm(message, resolve);
      } else {
        // Fallback for development
        resolve(window.confirm(message));
      }
    } catch (error) {
      console.error('Failed to show confirm:', error);
      resolve(false);
    }
  });
}

// Show popup
export function showPopup(params: {
  title?: string;
  message: string;
  buttons?: Array<{
    id?: string;
    type?: 'default' | 'ok' | 'close' | 'cancel' | 'destructive';
    text?: string;
  }>;
}): Promise<string | undefined> {
  return new Promise((resolve) => {
    try {
      const tg = getTelegramWebApp();
      if (tg?.showPopup) {
        tg.showPopup({
          ...params,
          buttons: params.buttons?.map(button => ({
            ...button,
            id: button.id || `btn_${Date.now()}_${Math.random()}`
          }))
        });
        // Note: Telegram doesn't provide a callback for popup result
        resolve(undefined);
      } else {
        // Fallback for development
        const confirmed = window.confirm(params.message);
        resolve(confirmed ? 'ok' : 'cancel');
      }
    } catch (error) {
      console.error('Failed to show popup:', error);
      resolve(undefined);
    }
  });
}

// Back button management
export const backButton = {
  show(): void {
    try {
      const tg = getTelegramWebApp();
      tg?.BackButton?.show();
    } catch (error) {
      console.error('Failed to show back button:', error);
    }
  },

  hide(): void {
    try {
      const tg = getTelegramWebApp();
      tg?.BackButton?.hide();
    } catch (error) {
      console.error('Failed to hide back button:', error);
    }
  },

  onClick(callback: () => void): void {
    try {
      const tg = getTelegramWebApp();
      tg?.BackButton?.onClick(callback);
    } catch (error) {
      console.error('Failed to set back button click handler:', error);
    }
  },

  offClick(callback: () => void): void {
    try {
      const tg = getTelegramWebApp();
      tg?.BackButton?.offClick(callback);
    } catch (error) {
      console.error('Failed to remove back button click handler:', error);
    }
  }
};

// Main button management
export const mainButton = {
  setText(text: string): void {
    try {
      const tg = getTelegramWebApp();
      tg?.MainButton?.setText(text);
    } catch (error) {
      console.error('Failed to set main button text:', error);
    }
  },

  setColor(color: string): void {
    try {
      const tg = getTelegramWebApp();
      tg?.MainButton?.setColor(color);
    } catch (error) {
      console.error('Failed to set main button color:', error);
    }
  },

  show(): void {
    try {
      const tg = getTelegramWebApp();
      tg?.MainButton?.show();
    } catch (error) {
      console.error('Failed to show main button:', error);
    }
  },

  hide(): void {
    try {
      const tg = getTelegramWebApp();
      tg?.MainButton?.hide();
    } catch (error) {
      console.error('Failed to hide main button:', error);
    }
  },

  enable(): void {
    try {
      const tg = getTelegramWebApp();
      tg?.MainButton?.enable();
    } catch (error) {
      console.error('Failed to enable main button:', error);
    }
  },

  disable(): void {
    try {
      const tg = getTelegramWebApp();
      tg?.MainButton?.disable();
    } catch (error) {
      console.error('Failed to disable main button:', error);
    }
  },

  showProgress(leaveActive?: boolean): void {
    try {
      const tg = getTelegramWebApp();
      tg?.MainButton?.showProgress(leaveActive);
    } catch (error) {
      console.error('Failed to show progress:', error);
    }
  },

  hideProgress(): void {
    try {
      const tg = getTelegramWebApp();
      tg?.MainButton?.hideProgress();
    } catch (error) {
      console.error('Failed to hide progress:', error);
    }
  },

  onClick(callback: () => void): void {
    try {
      const tg = getTelegramWebApp();
      tg?.MainButton?.onClick(callback);
    } catch (error) {
      console.error('Failed to set main button click handler:', error);
    }
  },

  offClick(callback: () => void): void {
    try {
      const tg = getTelegramWebApp();
      tg?.MainButton?.offClick(callback);
    } catch (error) {
      console.error('Failed to remove main button click handler:', error);
    }
  }
};

// Haptic feedback
export const haptic = {
  impact(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft' = 'medium'): void {
    try {
      const tg = getTelegramWebApp();
      tg?.HapticFeedback?.impactOccurred(style);
    } catch (error) {
      console.error('Failed to trigger haptic impact:', error);
    }
  },

  notification(type: 'error' | 'success' | 'warning' = 'success'): void {
    try {
      const tg = getTelegramWebApp();
      tg?.HapticFeedback?.notificationOccurred(type);
    } catch (error) {
      console.error('Failed to trigger haptic notification:', error);
    }
  },

  selection(): void {
    try {
      const tg = getTelegramWebApp();
      tg?.HapticFeedback?.selectionChanged();
    } catch (error) {
      console.error('Failed to trigger haptic selection:', error);
    }
  }
};

// Theme management
export function getTheme() {
  try {
    const tg = getTelegramWebApp();
    return {
      colorScheme: tg?.colorScheme || 'light',
      themeParams: tg?.themeParams || {}
    };
  } catch (error) {
    console.error('Failed to get theme:', error);
    return {
      colorScheme: 'light',
      themeParams: {}
    };
  }
}

// Set header color
export function setHeaderColor(color: string): void {
  try {
    const tg = getTelegramWebApp();
    tg?.setHeaderColor(color);
  } catch (error) {
    console.error('Failed to set header color:', error);
  }
}

// Set background color
export function setBackgroundColor(color: string): void {
  try {
    const tg = getTelegramWebApp();
    tg?.setBackgroundColor(color);
  } catch (error) {
    console.error('Failed to set background color:', error);
  }
}

// Read from clipboard
export function readClipboard(): Promise<string> {
  return new Promise((resolve) => {
    try {
      const tg = getTelegramWebApp();
      if (tg?.readTextFromClipboard) {
        tg.readTextFromClipboard(resolve);
      } else {
        resolve('');
      }
    } catch (error) {
      console.error('Failed to read clipboard:', error);
      resolve('');
    }
  });
}

// Send data to bot
export function sendData(data: any): void {
  try {
    const tg = getTelegramWebApp();
    tg?.sendData(data);
  } catch (error) {
    console.error('Failed to send data:', error);
  }
}

// Enable closing confirmation
export function enableClosingConfirmation(): void {
  try {
    const tg = getTelegramWebApp();
    tg?.enableClosingConfirmation();
  } catch (error) {
    console.error('Failed to enable closing confirmation:', error);
  }
}

// Disable closing confirmation
export function disableClosingConfirmation(): void {
  try {
    const tg = getTelegramWebApp();
    tg?.disableClosingConfirmation();
  } catch (error) {
    console.error('Failed to disable closing confirmation:', error);
  }
}

// Get platform info
export function getPlatform(): string {
  try {
    const tg = getTelegramWebApp();
    return tg?.platform || 'unknown';
  } catch (error) {
    console.error('Failed to get platform:', error);
    return 'unknown';
  }
}

// Check if running on mobile
export function isMobile(): boolean {
  const platform = getPlatform();
  return platform.includes('ios') || platform.includes('android');
}

// Version check
export function getVersion(): string {
  try {
    const tg = getTelegramWebApp();
    return tg?.version || '0.0.0';
  } catch (error) {
    console.error('Failed to get version:', error);
    return '0.0.0';
  }
}

// Check if version meets minimum requirement
export function meetsVersion(minVersion: string): boolean {
  const current = getVersion();
  const [cMajor, cMinor, cPatch] = current.split('.').map(Number);
  const [mMajor, mMinor, mPatch] = minVersion.split('.').map(Number);
  
  if (cMajor > mMajor) return true;
  if (cMajor < mMajor) return false;
  if (cMinor > mMinor) return true;
  if (cMinor < mMinor) return false;
  return cPatch >= mPatch;
}