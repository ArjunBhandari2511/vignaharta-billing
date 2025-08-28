import { Storage, STORAGE_KEYS } from './storage';

interface Item {
  id: string;
  productName: string;
  category: 'Primary' | 'Kirana';
  purchasePrice: number;
  salePrice: number;
  openingStock: number; // in bags
  asOfDate: string;
  lowStockAlert: number; // in bags
  createdAt: string;
  updatedAt: string;
}

interface SaleItem {
  id: string;
  itemName: string;
  quantity: number; // in kg
  rate: number;
  total: number;
}

export class StockManager {
  /**
   * Update stock levels when items are sold
   * @param soldItems Array of items that were sold
   */
  static async updateStockOnSale(soldItems: SaleItem[]): Promise<void> {
    try {
      // Load current items
      const items = await Storage.getObject<Item[]>(STORAGE_KEYS.ITEMS);
      if (!items) {
        return;
      }

      // Create a map of sold items by name for quick lookup
      const soldItemsMap = new Map<string, number>();
      soldItems.forEach(item => {
        const currentQty = soldItemsMap.get(item.itemName) || 0;
        soldItemsMap.set(item.itemName, currentQty + item.quantity);
      });

      // Update stock for each item
      const updatedItems = items.map(item => {
        const soldQuantity = soldItemsMap.get(item.productName);
        if (soldQuantity) {
          // Convert kg to bags (1 bag = 30 kg)
          const soldBags = soldQuantity / 30;
          const newStock = Math.max(0, item.openingStock - soldBags);
          
          return {
            ...item,
            openingStock: newStock,
            updatedAt: new Date().toISOString(),
          };
        }
        return item;
      });

      // Save updated items
      await Storage.setObject(STORAGE_KEYS.ITEMS, updatedItems);
    } catch (error) {
      console.error('Error updating stock on sale:', error);
      throw error;
    }
  }

  /**
   * Update stock levels when items are purchased
   * @param purchasedItems Array of items that were purchased
   */
  static async updateStockOnPurchase(purchasedItems: SaleItem[]): Promise<void> {
    try {
      // Load current items
      const items = await Storage.getObject<Item[]>(STORAGE_KEYS.ITEMS);
      if (!items) return;

      // Create a map of purchased items by name for quick lookup
      const purchasedItemsMap = new Map<string, number>();
      purchasedItems.forEach(item => {
        const currentQty = purchasedItemsMap.get(item.itemName) || 0;
        purchasedItemsMap.set(item.itemName, currentQty + item.quantity);
      });

      // Update stock for each item
      const updatedItems = items.map(item => {
        const purchasedQuantity = purchasedItemsMap.get(item.productName);
        if (purchasedQuantity) {
          // Convert kg to bags (1 bag = 30 kg)
          const purchasedBags = purchasedQuantity / 30;
          const newStock = item.openingStock + purchasedBags;
          
          return {
            ...item,
            openingStock: newStock,
            updatedAt: new Date().toISOString(),
          };
        }
        return item;
      });

      // Save updated items
      await Storage.setObject(STORAGE_KEYS.ITEMS, updatedItems);
    } catch (error) {
      console.error('Error updating stock on purchase:', error);
      throw error;
    }
  }

  /**
   * Revert stock changes when an invoice is deleted or cancelled
   * @param soldItems Array of items that were sold (to be reverted)
   */
  static async revertStockOnSale(soldItems: SaleItem[]): Promise<void> {
    try {
      // Load current items
      const items = await Storage.getObject<Item[]>(STORAGE_KEYS.ITEMS);
      if (!items) return;

      // Create a map of sold items by name for quick lookup
      const soldItemsMap = new Map<string, number>();
      soldItems.forEach(item => {
        const currentQty = soldItemsMap.get(item.itemName) || 0;
        soldItemsMap.set(item.itemName, currentQty + item.quantity);
      });

      // Revert stock for each item (add back the sold quantity)
      const updatedItems = items.map(item => {
        const soldQuantity = soldItemsMap.get(item.productName);
        if (soldQuantity) {
          // Convert kg to bags (1 bag = 30 kg)
          const soldBags = soldQuantity / 30;
          const newStock = item.openingStock + soldBags;
          
          return {
            ...item,
            openingStock: newStock,
            updatedAt: new Date().toISOString(),
          };
        }
        return item;
      });

      // Save updated items
      await Storage.setObject(STORAGE_KEYS.ITEMS, updatedItems);
    } catch (error) {
      console.error('Error reverting stock on sale:', error);
      throw error;
    }
  }

  /**
   * Get current stock level for an item
   * @param itemName Name of the item
   * @returns Current stock in kg
   */
  static async getItemStock(itemName: string): Promise<number> {
    try {
      const items = await Storage.getObject<Item[]>(STORAGE_KEYS.ITEMS);
      if (!items) return 0;

      const item = items.find(i => i.productName === itemName);
      if (!item) return 0;

      // Convert bags to kg (1 bag = 30 kg)
      return item.openingStock * 30;
    } catch (error) {
      console.error('Error getting item stock:', error);
      return 0;
    }
  }

  /**
   * Check if item has sufficient stock for sale
   * @param itemName Name of the item
   * @param requiredQuantity Required quantity in kg
   * @returns True if sufficient stock is available
   */
  static async hasSufficientStock(itemName: string, requiredQuantity: number): Promise<boolean> {
    const currentStock = await this.getItemStock(itemName);
    return currentStock >= requiredQuantity;
  }
}
