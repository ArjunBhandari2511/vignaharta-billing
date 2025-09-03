import { partiesApi } from './apiService';

export interface Party {
  _id: string;
  name: string;
  phoneNumber: string;
  type: 'customer' | 'supplier';
  email?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    pincode?: string;
    country?: string;
  };
  totalInvoiced: number;  // For customers: invoices, for suppliers: bills
  totalPaid: number;      // For customers: payments received, for suppliers: payments made
  balance: number;         // For customers: they owe us, for suppliers: we owe them
  creditLimit: number;
  status: 'active' | 'inactive' | 'blocked';
  paymentTerms: string;
  lastTransactionDate: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
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
   * Get all parties (customers and suppliers)
   */
  static async getAllParties(): Promise<Party[]> {
    try {
      const parties = await partiesApi.getAll();
      return parties.sort((a: Party, b: Party) => 
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
      const parties = await partiesApi.getByType('customer');
      return parties.sort((a: Party, b: Party) => 
        new Date(b.lastTransactionDate).getTime() - new Date(a.lastTransactionDate).getTime()
      );
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
      const parties = await partiesApi.getByType('supplier');
      return parties.sort((a: Party, b: Party) => 
        new Date(b.lastTransactionDate).getTime() - new Date(a.lastTransactionDate).getTime()
      );
    } catch (error) {
      console.error('Error getting all suppliers:', error);
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
    try {
      if (!query.trim()) {
        return this.getAllParties();
      }
      const parties = await partiesApi.search(query);
      return parties.sort((a: Party, b: Party) => 
        new Date(b.lastTransactionDate).getTime() - new Date(a.lastTransactionDate).getTime()
      );
    } catch (error) {
      console.error('Error searching parties:', error);
      return [];
    }
  }

  /**
   * Get party by ID
   */
  static async getPartyById(id: string): Promise<Party | null> {
    try {
      const party = await partiesApi.getById(id);
      return party;
    } catch (error) {
      console.error('Error getting party by ID:', error);
      return null;
    }
  }

  /**
   * Create new party
   */
  static async createParty(partyData: Omit<Party, '_id' | 'createdAt' | 'updatedAt'>): Promise<Party | null> {
    try {
      const party = await partiesApi.create(partyData);
      return party;
    } catch (error) {
      console.error('Error creating party:', error);
      return null;
    }
  }

  /**
   * Update party
   */
  static async updateParty(id: string, partyData: Partial<Party>): Promise<Party | null> {
    try {
      const party = await partiesApi.update(id, partyData);
      return party;
    } catch (error) {
      console.error('Error updating party:', error);
      return null;
    }
  }

  /**
   * Delete party
   */
  static async deleteParty(id: string): Promise<boolean> {
    try {
      await partiesApi.delete(id);
      return true;
    } catch (error) {
      console.error('Error deleting party:', error);
      return false;
    }
  }

  /**
   * Get party balance based on type
   * @param partyName - Party name
   * @param phoneNumber - Phone number
   * @param partyType - 'customer' or 'supplier'
   */
  static async getPartyBalance(partyName: string, phoneNumber: string, partyType: 'customer' | 'supplier'): Promise<number> {
    try {
      const parties = await this.getPartiesByType(partyType);
      const party = parties.find(p => 
        p.name.toLowerCase() === partyName.toLowerCase() && 
        p.phoneNumber === phoneNumber
      );
      
      return party ? party.balance : 0;
    } catch (error) {
      console.error('Error calculating party balance:', error);
      return 0;
    }
  }

  /**
   * Get party transactions
   */
  static async getPartyTransactions(partyName: string, phoneNumber: string, partyType: 'customer' | 'supplier'): Promise<PartyTransaction[]> {
    try {
      const parties = await this.getPartiesByType(partyType);
      const party = parties.find(p => 
        p.name.toLowerCase() === partyName.toLowerCase() && 
        p.phoneNumber === phoneNumber
      );
      
      if (!party) {
        return [];
      }

      // For now, return empty array as transactions are handled by other services
      // This can be enhanced later to fetch actual transaction data from the backend
      return [];
    } catch (error) {
      console.error('Error getting party transactions:', error);
      return [];
    }
  }
}
