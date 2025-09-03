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

export default apiClient;
