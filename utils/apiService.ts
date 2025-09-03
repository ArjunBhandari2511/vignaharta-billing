import axios from 'axios';
import { Config } from '../constants/Config';

// Backend server configuration
const API_BASE_URL = Config.API.BASE_URL;

// Create axios instance with default configuration
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: Config.API.TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for logging
apiClient.interceptors.request.use(
  (config) => {
    console.log('API Request:', config.method?.toUpperCase(), config.url);
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for logging and error handling
apiClient.interceptors.response.use(
  (response) => {
    console.log('API Response:', response.status, response.config.url);
    return response;
  },
  (error) => {
    console.error('API Response Error:', error.response?.status, error.response?.data);
    return Promise.reject(error);
  }
);

// Items API service
export const itemsApi = {
  // Get all items
  getAll: async () => {
    const response = await apiClient.get('/items');
    return response.data;
  },

  // Get item by ID
  getById: async (id: string) => {
    const response = await apiClient.get(`/items/${id}`);
    return response.data;
  },

  // Create new item
  create: async (itemData: any) => {
    const response = await apiClient.post('/items', itemData);
    return response.data;
  },

  // Update item
  update: async (id: string, itemData: any) => {
    const response = await apiClient.put(`/items/${id}`, itemData);
    return response.data;
  },

  // Delete item
  delete: async (id: string) => {
    const response = await apiClient.delete(`/items/${id}`);
    return response.data;
  },
};

// Parties API service
export const partiesApi = {
  // Get all parties
  getAll: async () => {
    const response = await apiClient.get('/parties');
    return response.data;
  },

  // Get party by ID
  getById: async (id: string) => {
    const response = await apiClient.get(`/parties/${id}`);
    return response.data;
  },

  // Create new party
  create: async (partyData: any) => {
    const response = await apiClient.post('/parties', partyData);
    return response.data;
  },

  // Update party
  update: async (id: string, partyData: any) => {
    const response = await apiClient.put(`/parties/${id}`, partyData);
    return response.data;
  },

  // Delete party
  delete: async (id: string) => {
    const response = await apiClient.delete(`/parties/${id}`);
    return response.data;
  },

  // Get parties by type (customer/supplier)
  getByType: async (type: 'customer' | 'supplier') => {
    const response = await apiClient.get(`/parties?type=${type}`);
    return response.data;
  },

  // Search parties
  search: async (query: string) => {
    const response = await apiClient.get(`/parties?search=${encodeURIComponent(query)}`);
    return response.data;
  },
};

// PDF and Document Services API
export const pdfApi = {
  // Generate PDFs
  generateInvoice: async (invoice: any) => {
    const response = await apiClient.post('/pdf/generate-invoice', { invoice });
    return response.data;
  },

  generatePurchaseBill: async (bill: any) => {
    const response = await apiClient.post('/pdf/generate-purchase-bill', { bill });
    return response.data;
  },

  generatePaymentReceipt: async (payment: any) => {
    const response = await apiClient.post('/pdf/generate-payment-receipt', { payment });
    return response.data;
  },

  generatePaymentVoucher: async (payment: any) => {
    const response = await apiClient.post('/pdf/generate-payment-voucher', { payment });
    return response.data;
  },

  // Upload PDFs to Cloudinary
  uploadPdf: async (filePath: string, fileName: string, type: string) => {
    const response = await apiClient.post('/pdf/upload', { filePath, fileName, type });
    return response.data;
  },

  // Send WhatsApp messages
  sendTextMessage: async (phoneNumber: string, message: string) => {
    const response = await apiClient.post('/pdf/send-message', { phoneNumber, message });
    return response.data;
  },

  sendDocument: async (phoneNumber: string, message: string, documentUrl: string, fileName?: string) => {
    const response = await apiClient.post('/pdf/send-document', { phoneNumber, message, documentUrl, fileName });
    return response.data;
  },

  // Combined workflows
  generateAndSendInvoice: async (invoice: any, phoneNumber: string, customerName: string, totalAmount: number, date: string) => {
    const response = await apiClient.post('/pdf/generate-and-send-invoice', {
      invoice,
      phoneNumber,
      customerName,
      totalAmount,
      date
    });
    return response.data;
  },

  generateAndSendPurchaseBill: async (bill: any, phoneNumber: string, supplierName: string, totalAmount: number, date: string) => {
    const response = await apiClient.post('/pdf/generate-and-send-purchase-bill', {
      bill,
      phoneNumber,
      supplierName,
      totalAmount,
      date
    });
    return response.data;
  },

  generateAndSendPaymentReceipt: async (payment: any, phoneNumber: string, customerName: string, receivedAmount: number, date: string) => {
    const response = await apiClient.post('/pdf/generate-and-send-payment-receipt', {
      payment,
      phoneNumber,
      customerName,
      receivedAmount,
      date
    });
    return response.data;
  },

  generateAndSendPaymentVoucher: async (payment: any, phoneNumber: string, supplierName: string, paidAmount: number, date: string) => {
    const response = await apiClient.post('/pdf/generate-and-send-payment-voucher', {
      payment,
      phoneNumber,
      supplierName,
      paidAmount,
      date
    });
    return response.data;
  },
};

// Stock Transactions API service
export const stockTransactionsApi = {
  // Get all stock transactions
  getAll: async () => {
    const response = await apiClient.get('/stock-transactions');
    return response.data;
  },

  // Get stock summary (current stock levels)
  getStockSummary: async () => {
    const response = await apiClient.get('/stock-transactions/summary');
    return response.data;
  },

  // Get stock transactions for a specific item
  getByItem: async (itemId: string) => {
    const response = await apiClient.get(`/stock-transactions/item/${itemId}`);
    return response.data;
  },

  // Get stock transactions by type
  getByType: async (type: 'sale' | 'purchase' | 'adjustment' | 'opening_stock' | 'damage' | 'return' | 'transfer') => {
    const response = await apiClient.get(`/stock-transactions/type/${type}`);
    return response.data;
  },

  // Get stock transactions by date range
  getByDateRange: async (startDate: string, endDate: string, itemId?: string) => {
    const params = new URLSearchParams({
      startDate,
      endDate
    });
    if (itemId) {
      params.append('itemId', itemId);
    }
    const response = await apiClient.get(`/stock-transactions/date-range?${params}`);
    return response.data;
  },

  // Get stock transactions by reference
  getByReference: async (referenceType: string, referenceId: string) => {
    const response = await apiClient.get(`/stock-transactions/reference/${referenceType}/${referenceId}`);
    return response.data;
  },

  // Get item stock history
  getItemStockHistory: async (itemId: string, days: number = 30) => {
    const response = await apiClient.get(`/stock-transactions/item/${itemId}/history?days=${days}`);
    return response.data;
  },

  // Get stock movement summary
  getStockMovementSummary: async (itemId: string, startDate: string, endDate: string) => {
    const response = await apiClient.get(`/stock-transactions/movement-summary/${itemId}?startDate=${startDate}&endDate=${endDate}`);
    return response.data;
  },

  // Create new stock transaction
  create: async (transactionData: any) => {
    const response = await apiClient.post('/stock-transactions', transactionData);
    return response.data;
  },

  // Update stock transaction
  update: async (id: string, transactionData: any) => {
    const response = await apiClient.put(`/stock-transactions/${id}`, transactionData);
    return response.data;
  },

  // Delete stock transaction
  delete: async (id: string) => {
    const response = await apiClient.delete(`/stock-transactions/${id}`);
    return response.data;
  },

  // Reverse a stock transaction
  reverse: async (id: string, reason: string) => {
    const response = await apiClient.post(`/stock-transactions/${id}/reverse`, { reason });
    return response.data;
  },

  // Get related transactions
  getRelatedTransactions: async (id: string) => {
    const response = await apiClient.get(`/stock-transactions/${id}/related`);
    return response.data;
  },

  // Bulk create stock transactions
  bulkCreate: async (transactions: any[]) => {
    const response = await apiClient.post('/stock-transactions/bulk', { transactions });
    return response.data;
  },

  // Get low stock alerts
  getLowStockAlerts: async (threshold: number = 10) => {
    const response = await apiClient.get(`/stock-transactions/low-stock?threshold=${threshold}`);
    return response.data;
  },

  // Get stock valuation
  getStockValuation: async (asOfDate?: string) => {
    const params = asOfDate ? `?asOfDate=${asOfDate}` : '';
    const response = await apiClient.get(`/stock-transactions/valuation${params}`);
    return response.data;
  },

  // Export stock transactions
  exportTransactions: async (filters: any, format: 'csv' | 'excel' = 'csv') => {
    const response = await apiClient.post('/stock-transactions/export', { filters, format });
    return response.data;
  }
};

export default apiClient;
