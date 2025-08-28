import { Storage, STORAGE_KEYS } from './storage';

export interface Supplier {
  id: string;
  name: string;
  phoneNumber: string;
  totalBilled: number;
  totalPaid: number;
  balance: number;
  lastTransactionDate: string;
}

export interface SupplierTransaction {
  id: string;
  supplierId: string;
  type: 'bill' | 'payment';
  amount: number;
  date: string;
  reference: string; // Bill No or Payment No
}

export class SupplierManager {
  static async getSupplierBalance(supplierName: string, phoneNumber: string): Promise<number> {
    try {
      const bills = await Storage.getObject<any[]>(STORAGE_KEYS.PURCHASE_BILLS);
      const payments = await Storage.getObject<any[]>(STORAGE_KEYS.PURCHASE_PAYMENTS);
      
      if (!bills && !payments) return 0;
      
      const supplierBills = bills?.filter(bill => 
        bill.supplierName.toLowerCase() === supplierName.toLowerCase() &&
        bill.phoneNumber === phoneNumber
      ) || [];
      
      const supplierPayments = payments?.filter(payment => 
        payment.supplierName.toLowerCase() === supplierName.toLowerCase() &&
        payment.phoneNumber === phoneNumber
      ) || [];
      
      const totalBilled = supplierBills.reduce((sum, bill) => sum + bill.totalAmount, 0);
      const totalPaid = supplierPayments.reduce((sum, payment) => sum + payment.paid, 0);
      
      return totalBilled - totalPaid;
    } catch (error) {
      console.error('Error calculating supplier balance:', error);
      return 0;
    }
  }

  static async getAllSuppliers(): Promise<Supplier[]> {
    try {
      const bills = await Storage.getObject<any[]>(STORAGE_KEYS.PURCHASE_BILLS);
      const payments = await Storage.getObject<any[]>(STORAGE_KEYS.PURCHASE_PAYMENTS);
      
      if (!bills && !payments) return [];
      
      const supplierMap = new Map<string, Supplier>();
      
      // Process bills
      bills?.forEach(bill => {
        const key = `${bill.supplierName.toLowerCase()}-${bill.phoneNumber}`;
        const existing = supplierMap.get(key);
        
        if (existing) {
          existing.totalBilled += bill.totalAmount;
          existing.balance = existing.totalBilled - existing.totalPaid;
          if (new Date(bill.date) > new Date(existing.lastTransactionDate)) {
            existing.lastTransactionDate = bill.date;
          }
        } else {
          supplierMap.set(key, {
            id: key,
            name: bill.supplierName,
            phoneNumber: bill.phoneNumber,
            totalBilled: bill.totalAmount,
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
          existing.balance = existing.totalBilled - existing.totalPaid;
          if (new Date(payment.date) > new Date(existing.lastTransactionDate)) {
            existing.lastTransactionDate = payment.date;
          }
        } else {
          supplierMap.set(key, {
            id: key,
            name: payment.supplierName,
            phoneNumber: payment.phoneNumber,
            totalBilled: 0,
            totalPaid: payment.paid,
            balance: -payment.paid,
            lastTransactionDate: payment.date,
          });
        }
      });
      
      return Array.from(supplierMap.values()).sort((a, b) => 
        new Date(b.lastTransactionDate).getTime() - new Date(a.lastTransactionDate).getTime()
      );
    } catch (error) {
      console.error('Error getting all suppliers:', error);
      return [];
    }
  }

  static async getSupplierTransactions(supplierName: string, phoneNumber: string): Promise<SupplierTransaction[]> {
    try {
      const bills = await Storage.getObject<any[]>(STORAGE_KEYS.PURCHASE_BILLS);
      const payments = await Storage.getObject<any[]>(STORAGE_KEYS.PURCHASE_PAYMENTS);
      
      const transactions: SupplierTransaction[] = [];
      const supplierId = `${supplierName.toLowerCase()}-${phoneNumber}`;
      
      // Add bills
      bills?.forEach(bill => {
        if (bill.supplierName.toLowerCase() === supplierName.toLowerCase() && 
            bill.phoneNumber === phoneNumber) {
          transactions.push({
            id: bill.id,
            supplierId,
            type: 'bill',
            amount: bill.totalAmount,
            date: bill.date,
            reference: bill.billNo,
          });
        }
      });
      
      // Add payments
      payments?.forEach(payment => {
        if (payment.supplierName.toLowerCase() === supplierName.toLowerCase() && 
            payment.phoneNumber === phoneNumber) {
          transactions.push({
            id: payment.id,
            supplierId,
            type: 'payment',
            amount: payment.paid,
            date: payment.date,
            reference: payment.billNo || payment.paymentNo,
          });
        }
      });
      
      // Sort by date (newest first)
      return transactions.sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
    } catch (error) {
      console.error('Error getting supplier transactions:', error);
      return [];
    }
  }
}
