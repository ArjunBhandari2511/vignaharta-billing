import { Storage, STORAGE_KEYS } from './storage';

export interface Party {
  id: string;
  name: string;
  phoneNumber: string;
  type: 'customer' | 'supplier';
  totalInvoiced: number;  // For customers: invoices, for suppliers: bills
  totalPaid: number;      // For customers: payments received, for suppliers: payments made
  balance: number;         // For customers: they owe us, for suppliers: we owe them
  lastTransactionDate: string;
}

export interface PartyTransaction {
  id: string;
  partyId: string;
  type: 'invoice' | 'bill' | 'payment';
  amount: number;
  date: string;
  reference: string; // Invoice No, Bill No, or Payment No
}

export class PartyManager {
  /**
   * Get party balance based on type
   * @param partyName - Party name
   * @param phoneNumber - Phone number
   * @param partyType - 'customer' or 'supplier'
   */
  static async getPartyBalance(partyName: string, phoneNumber: string, partyType: 'customer' | 'supplier'): Promise<number> {
    try {
      if (partyType === 'customer') {
        const invoices = await Storage.getObject<any[]>(STORAGE_KEYS.SALES_INVOICES);
        const payments = await Storage.getObject<any[]>(STORAGE_KEYS.SALES_PAYMENTS);
        
        if (!invoices && !payments) return 0;
        
        const customerInvoices = invoices?.filter(invoice => 
          invoice.customerName.toLowerCase() === partyName.toLowerCase() &&
          invoice.phoneNumber === phoneNumber
        ) || [];
        
        const customerPayments = payments?.filter(payment => 
          payment.customerName.toLowerCase() === partyName.toLowerCase() &&
          payment.phoneNumber === phoneNumber
        ) || [];
        
        const totalInvoiced = customerInvoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0);
        const totalPaid = customerPayments.reduce((sum, payment) => sum + payment.received, 0);
        
        return totalInvoiced - totalPaid; // Positive means they owe us
      } else {
        const bills = await Storage.getObject<any[]>(STORAGE_KEYS.PURCHASE_BILLS);
        const payments = await Storage.getObject<any[]>(STORAGE_KEYS.PURCHASE_PAYMENTS);
        
        if (!bills && !payments) return 0;
        
        const supplierBills = bills?.filter(bill => 
          bill.supplierName.toLowerCase() === partyName.toLowerCase() &&
          bill.phoneNumber === phoneNumber
        ) || [];
        
        const supplierPayments = payments?.filter(payment => 
          payment.supplierName.toLowerCase() === partyName.toLowerCase() &&
          payment.phoneNumber === phoneNumber
        ) || [];
        
        const totalBilled = supplierBills.reduce((sum, bill) => sum + bill.totalAmount, 0);
        const totalPaid = supplierPayments.reduce((sum, payment) => sum + payment.paid, 0);
        
        return totalBilled - totalPaid; // Positive means we owe them
      }
    } catch (error) {
      console.error('Error calculating party balance:', error);
      return 0;
    }
  }

  /**
   * Get all parties (customers and suppliers)
   */
  static async getAllParties(): Promise<Party[]> {
    try {
      const customers = await this.getAllCustomers();
      const suppliers = await this.getAllSuppliers();
      
      return [...customers, ...suppliers].sort((a, b) => 
        new Date(b.lastTransactionDate).getTime() - new Date(a.lastTransactionDate).getTime()
      );
    } catch (error) {
      console.error('Error getting all parties:', error);
      return [];
    }
  }

  /**
   * Get all customers
   */
  static async getAllCustomers(): Promise<Party[]> {
    try {
      const invoices = await Storage.getObject<any[]>(STORAGE_KEYS.SALES_INVOICES);
      const payments = await Storage.getObject<any[]>(STORAGE_KEYS.SALES_PAYMENTS);
      
      if (!invoices && !payments) return [];
      
      const customerMap = new Map<string, Party>();
      
      // Process invoices
      invoices?.forEach(invoice => {
        const key = `${invoice.customerName.toLowerCase()}-${invoice.phoneNumber}`;
        const existing = customerMap.get(key);
        
        if (existing) {
          existing.totalInvoiced += invoice.totalAmount;
          existing.balance = existing.totalInvoiced - existing.totalPaid;
          if (new Date(invoice.date) > new Date(existing.lastTransactionDate)) {
            existing.lastTransactionDate = invoice.date;
          }
        } else {
          customerMap.set(key, {
            id: key,
            name: invoice.customerName,
            phoneNumber: invoice.phoneNumber,
            type: 'customer',
            totalInvoiced: invoice.totalAmount,
            totalPaid: 0,
            balance: invoice.totalAmount,
            lastTransactionDate: invoice.date,
          });
        }
      });
      
      // Process payments
      payments?.forEach(payment => {
        const key = `${payment.customerName.toLowerCase()}-${payment.phoneNumber}`;
        const existing = customerMap.get(key);
        
        if (existing) {
          existing.totalPaid += payment.received;
          existing.balance = existing.totalInvoiced - existing.totalPaid;
          if (new Date(payment.date) > new Date(existing.lastTransactionDate)) {
            existing.lastTransactionDate = payment.date;
          }
        } else {
          customerMap.set(key, {
            id: key,
            name: payment.customerName,
            phoneNumber: payment.phoneNumber,
            type: 'customer',
            totalInvoiced: 0,
            totalPaid: payment.received,
            balance: -payment.received,
            lastTransactionDate: payment.date,
          });
        }
      });
      
      return Array.from(customerMap.values());
    } catch (error) {
      console.error('Error getting all customers:', error);
      return [];
    }
  }

  /**
   * Get all suppliers
   */
  static async getAllSuppliers(): Promise<Party[]> {
    try {
      const bills = await Storage.getObject<any[]>(STORAGE_KEYS.PURCHASE_BILLS);
      const payments = await Storage.getObject<any[]>(STORAGE_KEYS.PURCHASE_PAYMENTS);
      
      if (!bills && !payments) return [];
      
      const supplierMap = new Map<string, Party>();
      
      // Process bills
      bills?.forEach(bill => {
        const key = `${bill.supplierName.toLowerCase()}-${bill.phoneNumber}`;
        const existing = supplierMap.get(key);
        
        if (existing) {
          existing.totalInvoiced += bill.totalAmount;
          existing.balance = existing.totalInvoiced - existing.totalPaid;
          if (new Date(bill.date) > new Date(existing.lastTransactionDate)) {
            existing.lastTransactionDate = bill.date;
          }
        } else {
          supplierMap.set(key, {
            id: key,
            name: bill.supplierName,
            phoneNumber: bill.phoneNumber,
            type: 'supplier',
            totalInvoiced: bill.totalAmount,
            totalPaid: 0,
            balance: bill.totalAmount,
            lastTransactionDate: bill.date,
          });
        }
      });
      
      // Process payments
      payments?.forEach(payment => {
        const key = `${payment.supplierName.toLowerCase()}-${payment.phoneNumber}`;
        const existing = supplierMap.get(key);
        
        if (existing) {
          existing.totalPaid += payment.paid;
          existing.balance = existing.totalInvoiced - existing.totalPaid;
          if (new Date(payment.date) > new Date(existing.lastTransactionDate)) {
            existing.lastTransactionDate = payment.date;
          }
        } else {
          supplierMap.set(key, {
            id: key,
            name: payment.supplierName,
            phoneNumber: payment.phoneNumber,
            type: 'supplier',
            totalInvoiced: 0,
            totalPaid: payment.paid,
            balance: -payment.paid,
            lastTransactionDate: payment.date,
          });
        }
      });
      
      return Array.from(supplierMap.values());
    } catch (error) {
      console.error('Error getting all suppliers:', error);
      return [];
    }
  }

  /**
   * Get party transactions
   */
  static async getPartyTransactions(partyName: string, phoneNumber: string, partyType: 'customer' | 'supplier'): Promise<PartyTransaction[]> {
    try {
      const transactions: PartyTransaction[] = [];
      const partyId = `${partyName.toLowerCase()}-${phoneNumber}`;
      
      if (partyType === 'customer') {
        const invoices = await Storage.getObject<any[]>(STORAGE_KEYS.SALES_INVOICES);
        const payments = await Storage.getObject<any[]>(STORAGE_KEYS.SALES_PAYMENTS);
        
        // Add invoices
        invoices?.forEach(invoice => {
          if (invoice.customerName.toLowerCase() === partyName.toLowerCase() && 
              invoice.phoneNumber === phoneNumber) {
            transactions.push({
              id: invoice.id,
              partyId,
              type: 'invoice',
              amount: invoice.totalAmount,
              date: invoice.date,
              reference: invoice.invoiceNo,
            });
          }
        });
        
        // Add payments
        payments?.forEach(payment => {
          if (payment.customerName.toLowerCase() === partyName.toLowerCase() && 
              payment.phoneNumber === phoneNumber) {
            transactions.push({
              id: payment.id,
              partyId,
              type: 'payment',
              amount: payment.received,
              date: payment.date,
              reference: payment.paymentNo,
            });
          }
        });
      } else {
        const bills = await Storage.getObject<any[]>(STORAGE_KEYS.PURCHASE_BILLS);
        const payments = await Storage.getObject<any[]>(STORAGE_KEYS.PURCHASE_PAYMENTS);
        
        // Add bills
        bills?.forEach(bill => {
          if (bill.supplierName.toLowerCase() === partyName.toLowerCase() && 
              bill.phoneNumber === phoneNumber) {
            transactions.push({
              id: bill.id,
              partyId,
              type: 'bill',
              amount: bill.totalAmount,
              date: bill.date,
              reference: bill.billNo,
            });
          }
        });
        
        // Add payments
        payments?.forEach(payment => {
          if (payment.supplierName.toLowerCase() === partyName.toLowerCase() && 
              payment.phoneNumber === phoneNumber) {
            transactions.push({
              id: payment.id,
              partyId,
              type: 'payment',
              amount: payment.paid,
              date: payment.date,
              reference: payment.paymentNo,
            });
          }
        });
      }
      
      // Sort by date (newest first)
      return transactions.sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
    } catch (error) {
      console.error('Error getting party transactions:', error);
      return [];
    }
  }

  /**
   * Get parties by type
   */
  static async getPartiesByType(type: 'customer' | 'supplier'): Promise<Party[]> {
    if (type === 'customer') {
      return this.getAllCustomers();
    } else {
      return this.getAllSuppliers();
    }
  }

  /**
   * Search parties by name or phone number
   */
  static async searchParties(query: string): Promise<Party[]> {
    const allParties = await this.getAllParties();
    const lowerQuery = query.toLowerCase();
    
    return allParties.filter(party => 
      party.name.toLowerCase().includes(lowerQuery) ||
      party.phoneNumber.includes(lowerQuery)
    );
  }
}
