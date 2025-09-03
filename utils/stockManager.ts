
import { itemsApi, stockTransactionsApi } from './apiService';

interface Item {
  _id: string;
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
  _id: string;
  itemName: string;
  quantity: number; // in kg
  rate: number;
  total: number;
}

export class StockManager {
  // Track processed invoices to prevent duplicate stock updates
  private static processedInvoices = new Set<string>();

  /**
   * Initialize the universal Bardana item if it doesn't exist
   */
  static async initializeBardana(): Promise<void> {
    try {
      // Get all items from backend
      const items = await itemsApi.getAll();
      
      // Check if Bardana already exists
      const bardanaExists = items.some((item: Item) => item.isUniversal && item.productName === 'Bardana');
      
      if (!bardanaExists) {
        // Create Bardana item in backend
        const bardanaItemData = {
          productName: 'Bardana',
          category: 'Primary' as 'Primary' | 'Kirana',
          purchasePrice: 0,
          salePrice: 0,
          openingStock: 0, // in bags
          asOfDate: new Date().toISOString().split('T')[0],
          lowStockAlert: 10, // in bags
          isUniversal: true,
        };
        
        const createdBardana = await itemsApi.create(bardanaItemData);
        console.log('Bardana universal item created successfully in backend');
        
        // Create opening stock transaction for Bardana
        if (createdBardana._id) {
          await this.createOpeningStockTransaction(createdBardana._id, 'Bardana', 0);
        }
      } else {
        console.log('Bardana universal item already exists');
      }
    } catch (error) {
      console.error('Error initializing Bardana:', error);
    }
  }

  /**
   * Create opening stock transaction for a new item
   * @param itemId Item ID
   * @param itemName Item name
   * @param openingStockBags Opening stock in bags
   */
  static async createOpeningStockTransaction(itemId: string, itemName: string, openingStockBags: number): Promise<void> {
    try {
      if (openingStockBags > 0) {
        const transactionData = {
          transactionId: await this.generateTransactionId(),
          itemId: itemId,
          itemName: itemName,
          transactionType: 'opening_stock',
          quantity: openingStockBags * 30, // in kg
          quantityInBags: openingStockBags, // in bags
          previousStock: 0,
          newStock: openingStockBags,
          referenceType: 'OpeningStock',
          referenceId: itemId,
          referenceNumber: 'opening_stock',
          rate: 0,
          totalValue: 0,
          partyType: undefined,
          date: new Date().toISOString(),
          userId: 'system',
          notes: 'Initial opening stock',
          status: 'completed'
        };

        await stockTransactionsApi.create(transactionData);
        console.log(`Opening stock transaction created for ${itemName}: ${openingStockBags} bags`);
      }
    } catch (error) {
      console.error('Error creating opening stock transaction:', error);
    }
  }

  /**
   * Update opening stock for an existing item
   * @param itemId Item ID
   * @param itemName Item name
   * @param oldStockBags Old stock in bags
   * @param newStockBags New stock in bags
   */
  static async updateOpeningStock(itemId: string, itemName: string, oldStockBags: number, newStockBags: number): Promise<void> {
    try {
      if (oldStockBags !== newStockBags) {
        const stockDifference = newStockBags - oldStockBags;
        const transactionType = stockDifference > 0 ? 'adjustment' : 'adjustment';
        
        const transactionData = {
          transactionId: await this.generateTransactionId(),
          itemId: itemId,
          itemName: itemName,
          transactionType: transactionType,
          quantity: Math.abs(stockDifference) * 30, // in kg
          quantityInBags: Math.abs(stockDifference), // in bags
          previousStock: oldStockBags,
          newStock: newStockBags,
          referenceType: 'Adjustment',
          referenceId: itemId,
          referenceNumber: 'stock_adjustment',
          rate: 0,
          totalValue: 0,
          partyType: undefined,
          date: new Date().toISOString(),
          userId: 'system',
          notes: stockDifference > 0 ? 'Stock increase adjustment' : 'Stock decrease adjustment',
          status: 'completed'
        };

        await stockTransactionsApi.create(transactionData);
        console.log(`Stock adjustment transaction created for ${itemName}: ${stockDifference > 0 ? '+' : ''}${stockDifference} bags`);
      }
    } catch (error) {
      console.error('Error creating stock adjustment transaction:', error);
    }
  }

  /**
   * Update stock levels when items are sold
   * @param soldItems Array of items that were sold
   * @param invoiceId Optional invoice ID to prevent duplicate processing
   */
  static async updateStockOnSale(soldItems: SaleItem[], invoiceId?: string): Promise<void> {
    try {
      // Validate input
      if (!soldItems || soldItems.length === 0) {
        console.log('No items to update stock for');
        return;
      }

      // Check if this invoice has already been processed
      if (invoiceId && this.processedInvoices.has(invoiceId)) {
        console.log(`Invoice ${invoiceId} has already been processed for stock update`);
        return;
      }

      // Load current items from backend
      const items = await itemsApi.getAll();
      if (!items || items.length === 0) {
        return;
      }

      console.log(`Updating stock for ${soldItems.length} sold items`);
      soldItems.forEach((item: SaleItem) => {
        console.log(`- ${item.itemName}: ${item.quantity} kg`);
      });

      // Create stock transactions for each sold item
      for (const soldItem of soldItems) {
        const item = items.find((i: Item) => i.productName === soldItem.itemName);
        if (item) {
          // Get current stock level
          const currentStockBags = item.openingStock;
          const newStockBags = Math.max(0, currentStockBags - (soldItem.quantity / 30));

          // Create stock transaction record
          const transactionData = {
            transactionId: await this.generateTransactionId(),
            itemId: item._id,
            itemName: item.productName,
            transactionType: 'sale',
            quantity: soldItem.quantity, // in kg
            quantityInBags: soldItem.quantity / 30, // in bags
            previousStock: currentStockBags,
            newStock: newStockBags,
            referenceType: 'SaleInvoice',
            referenceId: invoiceId,
            referenceNumber: invoiceId,
            rate: soldItem.rate,
            totalValue: soldItem.total,
            partyType: 'customer',
            date: new Date().toISOString(),
            userId: 'system',
            notes: `Sale transaction from invoice ${invoiceId}`,
            status: 'completed'
          };

          // Create stock transaction
          await stockTransactionsApi.create(transactionData);

          // Update item stock level
          await itemsApi.update(item._id, {
            ...item,
            openingStock: newStockBags,
            updatedAt: new Date().toISOString(),
          });

          console.log(`Stock transaction created for ${item.productName}: ${soldItem.quantity} kg sold`);
        }
      }

      // Handle Bardana reduction
      const bardanaItem = items.find((i: Item) => i.isUniversal && i.productName === 'Bardana');
      if (bardanaItem) {
        const totalBardanaReduction = soldItems.reduce((total, item) => total + item.quantity, 0);
        const bardanaReductionBags = totalBardanaReduction / 30;
        const newBardanaStock = Math.max(0, bardanaItem.openingStock - bardanaReductionBags);

        // Create Bardana transaction
        const bardanaTransactionData = {
          transactionId: await this.generateTransactionId(),
          itemId: bardanaItem._id,
          itemName: 'Bardana',
          transactionType: 'sale',
          quantity: totalBardanaReduction,
          quantityInBags: bardanaReductionBags,
          previousStock: bardanaItem.openingStock,
          newStock: newBardanaStock,
          referenceType: 'SaleInvoice',
          referenceId: invoiceId,
          referenceNumber: invoiceId,
          rate: 0,
          totalValue: 0,
          partyType: 'customer',
          date: new Date().toISOString(),
          userId: 'system',
          notes: `Bardana reduction for sale invoice ${invoiceId}`,
          status: 'completed'
        };

        await stockTransactionsApi.create(bardanaTransactionData);

        // Update Bardana stock
        await itemsApi.update(bardanaItem._id, {
          ...bardanaItem,
          openingStock: newBardanaStock,
          updatedAt: new Date().toISOString(),
        });

        console.log(`Bardana stock reduced by ${bardanaReductionBags} bags for invoice ${invoiceId}`);
      }

      // Mark this invoice as processed if ID was provided
      if (invoiceId) {
        this.processedInvoices.add(invoiceId);
        console.log(`Invoice ${invoiceId} marked as processed for stock update`);
      }
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
      // Validate input
      if (!purchasedItems || purchasedItems.length === 0) {
        console.log('No items to update stock for');
        return;
      }

      // Load current items from backend
      const items = await itemsApi.getAll();
      if (!items || items.length === 0) return;

      console.log(`Updating stock for ${purchasedItems.length} purchased items`);
      purchasedItems.forEach((item: SaleItem) => {
        console.log(`- ${item.itemName}: ${item.quantity} kg`);
      });

      // Create stock transactions for each purchased item
      for (const purchasedItem of purchasedItems) {
        const item = items.find((i: Item) => i.productName === purchasedItem.itemName);
        if (item) {
          // Get current stock level
          const currentStockBags = item.openingStock;
          const newStockBags = currentStockBags + (purchasedItem.quantity / 30);

          // Create stock transaction record
          const transactionData = {
            transactionId: await this.generateTransactionId(),
            itemId: item._id,
            itemName: item.productName,
            transactionType: 'purchase',
            quantity: purchasedItem.quantity, // in kg
            quantityInBags: purchasedItem.quantity / 30, // in bags
            previousStock: currentStockBags,
            newStock: newStockBags,
            referenceType: 'PurchaseBill',
            referenceId: 'purchase_bill', // You might want to pass actual bill ID
            referenceNumber: 'purchase_bill',
            rate: purchasedItem.rate,
            totalValue: purchasedItem.total,
            partyType: 'supplier',
            date: new Date().toISOString(),
            userId: 'system',
            notes: 'Purchase transaction',
            status: 'completed'
          };

          // Create stock transaction
          await stockTransactionsApi.create(transactionData);

          // Update item stock level
          await itemsApi.update(item._id, {
            ...item,
            openingStock: newStockBags,
            updatedAt: new Date().toISOString(),
          });

          console.log(`Stock transaction created for ${item.productName}: ${purchasedItem.quantity} kg purchased`);
        }
      }

      // Handle Bardana addition
      const bardanaItem = items.find((i: Item) => i.isUniversal && i.productName === 'Bardana');
      if (bardanaItem) {
        const totalBardanaAddition = purchasedItems.reduce((total, item) => total + item.quantity, 0);
        const bardanaAdditionBags = totalBardanaAddition / 30;
        const newBardanaStock = bardanaItem.openingStock + bardanaAdditionBags;

        // Create Bardana transaction
        const bardanaTransactionData = {
          transactionId: await this.generateTransactionId(),
          itemId: bardanaItem._id,
          itemName: 'Bardana',
          transactionType: 'purchase',
          quantity: totalBardanaAddition,
          quantityInBags: bardanaAdditionBags,
          previousStock: bardanaItem.openingStock,
          newStock: newBardanaStock,
          referenceType: 'PurchaseBill',
          referenceId: 'purchase_bill',
          referenceNumber: 'purchase_bill',
          rate: 0,
          totalValue: 0,
          partyType: 'supplier',
          date: new Date().toISOString(),
          userId: 'system',
          notes: 'Bardana addition for purchase',
          status: 'completed'
        };

        await stockTransactionsApi.create(bardanaTransactionData);

        // Update Bardana stock
        await itemsApi.update(bardanaItem._id, {
          ...bardanaItem,
          openingStock: newBardanaStock,
          updatedAt: new Date().toISOString(),
        });

        console.log(`Bardana stock increased by ${bardanaAdditionBags} bags`);
      }
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
      // Load current items from backend
      const items = await itemsApi.getAll();
      if (!items || items.length === 0) return;

      console.log(`Reverting stock for ${soldItems.length} sold items`);

      // Create reversal transactions for each sold item
      for (const soldItem of soldItems) {
        const item = items.find((i: Item) => i.productName === soldItem.itemName);
        if (item) {
          // Get current stock level
          const currentStockBags = item.openingStock;
          const newStockBags = currentStockBags + (soldItem.quantity / 30);

          // Create reversal stock transaction record
          const transactionData = {
            transactionId: await this.generateTransactionId(),
            itemId: item._id,
            itemName: item.productName,
            transactionType: 'return',
            quantity: soldItem.quantity, // in kg
            quantityInBags: soldItem.quantity / 30, // in bags
            previousStock: currentStockBags,
            newStock: newStockBags,
            referenceType: 'SaleInvoice',
            referenceId: 'reversal',
            referenceNumber: 'reversal',
            rate: soldItem.rate,
            totalValue: soldItem.total,
            partyType: 'customer',
            date: new Date().toISOString(),
            userId: 'system',
            notes: 'Stock reversion for cancelled sale',
            status: 'completed'
          };

          // Create stock transaction
          await stockTransactionsApi.create(transactionData);

          // Update item stock level
          await itemsApi.update(item._id, {
            ...item,
            openingStock: newStockBags,
            updatedAt: new Date().toISOString(),
          });

          console.log(`Stock reversion transaction created for ${item.productName}: ${soldItem.quantity} kg restored`);
        }
      }

      // Handle Bardana restoration
      const bardanaItem = items.find((i: Item) => i.isUniversal && i.productName === 'Bardana');
      if (bardanaItem) {
        const totalBardanaRestoration = soldItems.reduce((total, item) => total + item.quantity, 0);
        const bardanaRestorationBags = totalBardanaRestoration / 30;
        const newBardanaStock = bardanaItem.openingStock + bardanaRestorationBags;

        // Create Bardana restoration transaction
        const bardanaTransactionData = {
          transactionId: await this.generateTransactionId(),
          itemId: bardanaItem._id,
          itemName: 'Bardana',
          transactionType: 'return',
          quantity: totalBardanaRestoration,
          quantityInBags: bardanaRestorationBags,
          previousStock: bardanaItem.openingStock,
          newStock: newBardanaStock,
          referenceType: 'SaleInvoice',
          referenceId: 'reversal',
          referenceNumber: 'reversal',
          rate: 0,
          totalValue: 0,
          partyType: 'customer',
          date: new Date().toISOString(),
          userId: 'system',
          notes: 'Bardana restoration for cancelled sale',
          status: 'completed'
        };

        await stockTransactionsApi.create(bardanaTransactionData);

        // Update Bardana stock
        await itemsApi.update(bardanaItem._id, {
          ...bardanaItem,
          openingStock: newBardanaStock,
          updatedAt: new Date().toISOString(),
        });

        console.log(`Bardana stock restored by ${bardanaRestorationBags} bags`);
      }
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
      const items = await itemsApi.getAll();
      if (!items || items.length === 0) return 0;

      const item = items.find((i: Item) => i.productName === itemName);
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

  /**
   * Clear processed invoices tracking (useful for app restart or testing)
   */
  static clearProcessedInvoices(): void {
    this.processedInvoices.clear();
    console.log('Processed invoices tracking cleared');
  }

  /**
   * Check if an invoice has been processed for stock update
   * @param invoiceId Invoice ID to check
   * @returns True if invoice has been processed
   */
  static isInvoiceProcessed(invoiceId: string): boolean {
    return this.processedInvoices.has(invoiceId);
  }

  /**
   * Remove an invoice from processed list (useful for testing or reprocessing)
   * @param invoiceId Invoice ID to remove
   */
  static removeProcessedInvoice(invoiceId: string): void {
    this.processedInvoices.delete(invoiceId);
    console.log(`Invoice ${invoiceId} removed from processed list`);
  }

  /**
   * Get count of processed invoices (useful for debugging)
   * @returns Number of processed invoices
   */
  static getProcessedInvoicesCount(): number {
    return this.processedInvoices.size;
  }

  /**
   * Get all processed invoice IDs (useful for debugging)
   * @returns Array of processed invoice IDs
   */
  static getProcessedInvoiceIds(): string[] {
    return Array.from(this.processedInvoices);
  }

  /**
   * Generate a unique transaction ID
   */
  private static async generateTransactionId(): Promise<string> {
    const date = new Date();
    const dateStr = date.getFullYear().toString() + 
                    (date.getMonth() + 1).toString().padStart(2, '0') + 
                    date.getDate().toString().padStart(2, '0');
    
    const timestamp = Date.now().toString().slice(-6);
    return `ST-${dateStr}-${timestamp}`;
  }
}
