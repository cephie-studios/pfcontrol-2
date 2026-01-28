export const storage = {
  getItem: async (key: string): Promise<string | null> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        try {
          resolve(localStorage.getItem(key));
        } catch (error) {
          console.warn(`Failed to get localStorage item ${key}:`, error);
          resolve(null);
        }
      }, 0);
    });
  },

  setItem: async (key: string, value: string): Promise<void> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        try {
          localStorage.setItem(key, value);
        } catch (error) {
          console.warn(`Failed to set localStorage item ${key}:`, error);
        }
        resolve();
      }, 0);
    });
  },

  removeItem: async (key: string): Promise<void> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        try {
          localStorage.removeItem(key);
        } catch (error) {
          console.warn(`Failed to remove localStorage item ${key}:`, error);
        }
        resolve();
      }, 0);
    });
  },

  getItemSync: (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      console.warn(`Failed to get localStorage item ${key}:`, error);
      return null;
    }
  },

  setItemSync: (key: string, value: string): void => {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      console.warn(`Failed to set localStorage item ${key}:`, error);
    }
  },
};
