import { Storage, STORAGE_KEYS } from './storage';

export interface Customer {
  id: string;
  name: string;
  phoneNumber: string;
  totalInvoiced: number;
  totalPaid: number;
  balance: number;
  lastTransactionDate: string;
}

export interface CustomerTransaction {
  id: string;
  customerId: string;
  type: 'invoice' | 'payment';
  amount: number;
  date: string;
  reference: string; // Invoice No or Bill No
}

export class CustomerManager {
  static async getCustomerBalance(customerName: string, phoneNumber: string): Promise<number> {
    try {
      const invoices = await Storage.getObject<any[]>(STORAGE_KEYS.SALES_INVOICES);
      const payments = await Storage.getObject<any[]>(STORAGE_KEYS.SALES_PAYMENTS);
      
      if (!invoices && !payments) return 0;
      
      const customerInvoices = invoices?.filter(invoice => 
        invoice.customerName.toLowerCase() === customerName.toLowerCase() &&
        invoice.phoneNumber === phoneNumber
      ) || [];
      
      const customerPayments = payments?.filter(payment => 
        payment.customerName.toLowerCase() === customerName.toLowerCase() &&
        payment.phoneNumber === phoneNumber
      ) || [];
      
      const totalInvoiced = customerInvoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0);
      const totalPaid = customerPayments.reduce((sum, payment) => sum + payment.received, 0);
      
      return totalInvoiced - totalPaid;
    } catch (error) {
      console.error('Error calculating customer balance:', error);
      return 0;
    }
  }

  static async getAllCustomers(): Promise<Customer[]> {
    try {
      const invoices = await Storage.getObject<any[]>(STORAGE_KEYS.SALES_INVOICES);
      const payments = await Storage.getObject<any[]>(STORAGE_KEYS.SALES_PAYMENTS);
      
      if (!invoices && !payments) return [];
      
      const customerMap = new Map<string, Customer>();
      
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
            totalInvoiced: 0,
            totalPaid: payment.received,
            balance: -payment.received,
            lastTransactionDate: payment.date,
          });
        }
      });
      
      return Array.from(customerMap.values()).sort((a, b) => 
        new Date(b.lastTransactionDate).getTime() - new Date(a.lastTransactionDate).getTime()
      );
    } catch (error) {
      console.error('Error getting all customers:', error);
      return [];
    }
  }

  static async getCustomerTransactions(customerName: string, phoneNumber: string): Promise<CustomerTransaction[]> {
    try {
      const invoices = await Storage.getObject<any[]>(STORAGE_KEYS.SALES_INVOICES);
      const payments = await Storage.getObject<any[]>(STORAGE_KEYS.SALES_PAYMENTS);
      
      const transactions: CustomerTransaction[] = [];
      const customerId = `${customerName.toLowerCase()}-${phoneNumber}`;
      
      // Add invoices
      invoices?.forEach(invoice => {
        if (invoice.customerName.toLowerCase() === customerName.toLowerCase() && 
            invoice.phoneNumber === phoneNumber) {
          transactions.push({
            id: invoice.id,
            customerId,
            type: 'invoice',
            amount: invoice.totalAmount,
            date: invoice.date,
            reference: invoice.invoiceNo,
          });
        }
      });
      
      // Add payments
      payments?.forEach(payment => {
        if (payment.customerName.toLowerCase() === customerName.toLowerCase() && 
            payment.phoneNumber === phoneNumber) {
          transactions.push({
            id: payment.id,
            customerId,
            type: 'payment',
            amount: payment.received,
            date: payment.date,
            reference: payment.invoiceNo,
          });
        }
      });
      
      // Sort by date (newest first)
      return transactions.sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
    } catch (error) {
      console.error('Error getting customer transactions:', error);
      return [];
    }
  }
}
