import AsyncStorage from '@react-native-async-storage/async-storage';

export class Storage {
  static async getItem(key: string): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(key);
    } catch (error) {
      console.error('Error getting item from storage:', error);
      return null;
    }
  }

  static async setItem(key: string, value: string): Promise<void> {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (error) {
      console.error('Error setting item in storage:', error);
    }
  }

  static async removeItem(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error('Error removing item from storage:', error);
    }
  }

  static async clear(): Promise<void> {
    try {
      await AsyncStorage.clear();
    } catch (error) {
      console.error('Error clearing storage:', error);
    }
  }

  static async getObject<T>(key: string): Promise<T | null> {
    try {
      const item = await AsyncStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch (error) {
      console.error('Error getting object from storage:', error);
      return null;
    }
  }

  static async setObject<T>(key: string, value: T): Promise<void> {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error('Error setting object in storage:', error);
    }
  }
}

// Storage keys for the app
export const STORAGE_KEYS = {
  SALES_DATA: 'vignaharta_sales_data',
  SALES_INVOICES: 'vignaharta_sales_invoices',
  SALES_PAYMENTS: 'vignaharta_sales_payments',
  PURCHASE_DATA: 'vignaharta_purchase_data',
  PURCHASE_BILLS: 'vignaharta_purchase_bills',
  PURCHASE_PAYMENTS: 'vignaharta_purchase_payments',
  ITEMS: 'vignaharta_items',
  SETTINGS: 'vignaharta_settings',
  USER_PREFERENCES: 'vignaharta_user_preferences',
  COMPANY_DETAILS: 'vignaharta_company_details',
} as const;
