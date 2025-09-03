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
  isUniversal?: boolean; // Flag to identify universal items like Bardana
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
   * Initialize the universal Bardana item if it doesn't exist
   */
  static async initializeBardana(): Promise<void> {
    try {
      const items = await Storage.getObject<Item[]>(STORAGE_KEYS.ITEMS);
      if (!items) {
        // Create initial items array with Bardana
        const bardanaItem: Item = {
          id: 'bardana-universal',
          productName: 'Bardana',
          category: 'Primary',
          purchasePrice: 0,
          salePrice: 0,
          openingStock: 0,
          asOfDate: new Date().toISOString().split('T')[0],
          lowStockAlert: 10,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isUniversal: true,
        };
        
        await Storage.setObject(STORAGE_KEYS.ITEMS, [bardanaItem]);
        console.log('Bardana universal item created successfully');
        return;
      }

      // Check if Bardana already exists
      const bardanaExists = items.some(item => item.isUniversal && item.productName === 'Bardana');
      
      if (!bardanaExists) {
        const bardanaItem: Item = {
          id: 'bardana-universal',
          productName: 'Bardana',
          category: 'Primary',
          purchasePrice: 0,
          salePrice: 0,
          openingStock: 0,
          asOfDate: new Date().toISOString().split('T')[0],
          lowStockAlert: 10,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isUniversal: true,
        };
        
        items.push(bardanaItem);
        await Storage.setObject(STORAGE_KEYS.ITEMS, items);
        console.log('Bardana universal item added to existing items');
      } else {
        console.log('Bardana universal item already exists');
      }
    } catch (error) {
      console.error('Error initializing Bardana:', error);
    }
  }

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

      // Calculate total Bardana reduction needed
      let totalBardanaReduction = 0;
      soldItems.forEach(item => {
        // For each kg of item sold, reduce 1 kg of Bardana
        totalBardanaReduction += item.quantity;
      });
      
      console.log(`Total Bardana reduction needed: ${totalBardanaReduction} kg`);

      // Update stock for each item
      const updatedItems = items.map(item => {
        if (item.isUniversal && item.productName === 'Bardana') {
          // Reduce Bardana stock based on total items sold
          const bardanaReductionBags = totalBardanaReduction / 30; // Convert kg to bags
          const newStock = Math.max(0, Math.round((item.openingStock - bardanaReductionBags) * 100) / 100);
          
          console.log(`Bardana stock reduced from ${Math.round(item.openingStock * 100) / 100} bags to ${newStock} bags (${totalBardanaReduction} kg reduction)`);
          
          return {
            ...item,
            openingStock: newStock,
            updatedAt: new Date().toISOString(),
          };
        } else {
          // Handle regular items
          const soldQuantity = soldItemsMap.get(item.productName);
          if (soldQuantity) {
            // Convert kg to bags (1 bag = 30 kg)
            const soldBags = soldQuantity / 30;
            const newStock = Math.max(0, Math.round((item.openingStock - soldBags) * 100) / 100);
            
            return {
              ...item,
              openingStock: newStock,
              updatedAt: new Date().toISOString(),
            };
          }
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

      // Calculate total Bardana addition needed
      let totalBardanaAddition = 0;
      purchasedItems.forEach(item => {
        // For each kg of item purchased, add 1 kg of Bardana
        totalBardanaAddition += item.quantity;
      });

      // Update stock for each item
      const updatedItems = items.map(item => {
        if (item.isUniversal && item.productName === 'Bardana') {
          // Add Bardana stock based on total items purchased
          const bardanaAdditionBags = totalBardanaAddition / 30; // Convert kg to bags
          const newStock = Math.round((item.openingStock + bardanaAdditionBags) * 100) / 100;
          
          return {
            ...item,
            openingStock: newStock,
            updatedAt: new Date().toISOString(),
          };
        } else {
          // Handle regular items
          const purchasedQuantity = purchasedItemsMap.get(item.productName);
          if (purchasedQuantity) {
            // Convert kg to bags (1 bag = 30 kg)
            const purchasedBags = purchasedQuantity / 30;
            const newStock = Math.round((item.openingStock + purchasedBags) * 100) / 100;
            
            return {
              ...item,
              openingStock: newStock,
              updatedAt: new Date().toISOString(),
            };
          }
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

      // Calculate total Bardana restoration needed
      let totalBardanaRestoration = 0;
      soldItems.forEach(item => {
        // For each kg of item restored, restore 1 kg of Bardana
        totalBardanaRestoration += item.quantity;
      });

      // Revert stock for each item (add back the sold quantity)
      const updatedItems = items.map(item => {
        if (item.isUniversal && item.productName === 'Bardana') {
          // Restore Bardana stock based on total items restored
          const bardanaRestorationBags = totalBardanaRestoration / 30; // Convert kg to bags
          const newStock = Math.round((item.openingStock + bardanaRestorationBags) * 100) / 100;
          
          return {
            ...item,
            openingStock: newStock,
            updatedAt: new Date().toISOString(),
          };
        } else {
          // Handle regular items
          const soldQuantity = soldItemsMap.get(item.productName);
          if (soldQuantity) {
            // Convert kg to bags (1 bag = 30 kg)
            const soldBags = soldQuantity / 30;
            const newStock = Math.round((item.openingStock + soldBags) * 100) / 100;
            
            return {
              ...item,
              openingStock: newStock,
              updatedAt: new Date().toISOString(),
            };
          }
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
      return Math.round(item.openingStock * 30);
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
