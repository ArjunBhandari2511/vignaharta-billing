import * as FileSystem from 'expo-file-system';

// Cloudinary Upload Interfaces
interface CloudinaryUploadResponse {
  success: boolean;
  url?: string;
  error?: string;
}

// WASender API Interfaces
interface WASenderMessageRequest {
  to: string;
  text: string;
  documentUrl?: string;
  fileName?: string;
}

interface WASenderMessageResponse {
  success: boolean;
  message?: string;
  error?: string;
}

// Combined Document Service
export class DocumentService {
  // Cloudinary Configuration
  private static readonly BACKEND_URL = 'http://192.168.29.111:5000'; // Update this to your backend URL
  private static readonly CLOUDINARY_CLOUD_NAME = 'your-cloud-name'; // Replace with your Cloudinary cloud name
  private static readonly CLOUDINARY_UPLOAD_PRESET = 'your-upload-preset'; // Replace with your upload preset

  // WASender Configuration
  private static readonly API_BASE_URL = 'https://www.wasenderapi.com/api';
  private static readonly API_KEY = 'ca20fa5a42b1f8edc9d3496bee7b8083d162cdcdb82119325f8f9590e510a0be';

  // ============================================================================
  // CLOUDINARY UPLOAD METHODS
  // ============================================================================

  /**
   * Upload a PDF file directly to Cloudinary (for production)
   * @param pdfUri - Local file URI of the PDF
   * @param fileName - Name for the file (optional)
   */
  static async uploadPdfDirect(pdfUri: string, fileName?: string): Promise<CloudinaryUploadResponse> {
    try {
      // Read file as base64 using expo-file-system
      const base64Data = await FileSystem.readAsStringAsync(pdfUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Create FormData for direct Cloudinary upload
      const formData = new FormData();
      formData.append('file', `data:application/pdf;base64,${base64Data}`);
      formData.append('upload_preset', this.CLOUDINARY_UPLOAD_PRESET);
      formData.append('folder', 'invoices');
      
      const finalFileName = fileName || `invoice-${Date.now()}.pdf`;
      formData.append('public_id', finalFileName);

      const uploadResponse = await fetch(`https://api.cloudinary.com/v1_1/${this.CLOUDINARY_CLOUD_NAME}/raw/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error('Direct upload failed:', errorText);
        return {
          success: false,
          error: `Direct upload failed: ${errorText}`,
        };
      }

      const result = await uploadResponse.json();

      return {
        success: true,
        url: result.secure_url,
      };

    } catch (error) {
      console.error('Direct upload error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Direct upload failed',
      };
    }
  }

  /**
   * Upload a PDF file to Cloudinary via backend server (for development)
   * @param pdfUri - Local file URI of the PDF
   * @param fileName - Name for the file (optional)
   */
  static async uploadPdf(pdfUri: string, fileName?: string): Promise<CloudinaryUploadResponse> {
    // For production, use direct upload
    if (__DEV__ === false) {
      return this.uploadPdfDirect(pdfUri, fileName);
    }

    try {
      // Create FormData with base64 data directly
      const formData = new FormData();
      const finalFileName = fileName || `invoice-${Date.now()}.pdf`;
      
      // Create a file-like object for React Native
      const fileData = {
        uri: pdfUri,
        type: 'application/pdf',
        name: finalFileName,
      };
      
      formData.append('file', fileData as any);

      // Upload to backend with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      const uploadResponse = await fetch(`${this.BACKEND_URL}/upload`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      clearTimeout(timeoutId);

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error('Upload failed with status:', uploadResponse.status, errorText);
        return {
          success: false,
          error: `Upload failed with status ${uploadResponse.status}: ${errorText}`,
        };
      }

      const result = await uploadResponse.json();

      if (result.url) {
        return {
          success: true,
          url: result.url,
        };
      } else {
        console.error('No URL in response:', result);
        return {
          success: false,
          error: result.error || result.message || 'No URL returned from server',
        };
      }
    } catch (error) {
      console.error('Cloudinary upload error:', error);
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          success: false,
          error: 'Upload timed out after 30 seconds',
        };
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      };
    }
  }

  /**
   * Upload invoice PDF and return public URL
   * @param pdfUri - Local file URI of the invoice PDF
   * @param invoiceNo - Invoice number for naming
   */
  static async uploadInvoicePdf(pdfUri: string, invoiceNo: string): Promise<CloudinaryUploadResponse> {
    // First check if backend is reachable
    const isBackendRunning = await this.checkBackendStatus();
    if (!isBackendRunning) {
      return {
        success: false,
        error: 'Backend server is not reachable. Please ensure the server is running on http://192.168.29.111:5000',
      };
    }

    const fileName = `invoice-${invoiceNo}-${Date.now()}.pdf`;
    return this.uploadPdf(pdfUri, fileName);
  }

  /**
   * Upload purchase bill PDF and return public URL
   * @param pdfUri - Local file URI of the purchase bill PDF
   * @param billNo - Bill number for naming
   */
  static async uploadPurchaseBillPdf(pdfUri: string, billNo: string): Promise<CloudinaryUploadResponse> {
    // First check if backend is reachable
    const isBackendRunning = await this.checkBackendStatus();
    if (!isBackendRunning) {
      return {
        success: false,
        error: 'Backend server is not reachable. Please ensure the server is running on http://192.168.29.111:5000',
      };
    }

    const fileName = `purchase-bill-${billNo}-${Date.now()}.pdf`;
    return this.uploadPdf(pdfUri, fileName);
  }

  /**
   * Check if backend server is running
   */
  static async checkBackendStatus(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(`${this.BACKEND_URL}/`, {
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      console.error('Backend server not reachable:', error);
      return false;
    }
  }

  // ============================================================================
  // WASENDER API METHODS
  // ============================================================================

  /**
   * Get the current API key
   */
  static getApiKey(): string {
    return this.API_KEY;
  }

  /**
   * Send a text message via WhatsApp
   * @param phoneNumber - Recipient's phone number (with country code, e.g., +1234567890)
   * @param message - Text message to send
   */
  static async sendTextMessage(phoneNumber: string, message: string): Promise<WASenderMessageResponse> {
    return this.sendMessage({
      to: phoneNumber,
      text: message,
    });
  }

  /**
   * Send a document via WhatsApp
   * @param phoneNumber - Recipient's phone number (with country code, e.g., +1234567890)
   * @param message - Accompanying text message
   * @param documentUrl - URL of the document to send
   * @param fileName - Name of the file (optional)
   */
  static async sendDocument(
    phoneNumber: string, 
    message: string, 
    documentUrl: string, 
    fileName?: string
  ): Promise<WASenderMessageResponse> {
    return this.sendMessage({
      to: phoneNumber,
      text: message,
      documentUrl,
      fileName,
    });
  }

  /**
   * Send an invoice via WhatsApp
   * @param phoneNumber - Recipient's phone number (with country code, e.g., +1234567890)
   * @param customerName - Customer's name
   * @param invoiceNo - Invoice number
   * @param totalAmount - Total invoice amount
   * @param date - Invoice date
   * @param documentUrl - URL of the invoice PDF (optional)
   */
  static async sendInvoice(
    phoneNumber: string,
    customerName: string,
    invoiceNo: string,
    totalAmount: number,
    date: string,
    documentUrl?: string
  ): Promise<WASenderMessageResponse> {
    // Validate phone number first
    if (!this.validatePhoneNumber(phoneNumber)) {
      return {
        success: false,
        error: 'Invalid phone number format',
      };
    }

    const formattedPhone = this.formatPhoneNumber(phoneNumber);
    const messageText = `Dear ${customerName},\n\nYour invoice ${invoiceNo} has been generated.\n\nTotal Amount: ₹${totalAmount.toLocaleString()}\nDate: ${date}\n\nThank you for your business!`;

    if (documentUrl) {
      return this.sendDocument(
        formattedPhone,
        messageText,
        documentUrl,
        `invoice-${invoiceNo}.pdf`
      );
    } else {
      return this.sendTextMessage(formattedPhone, messageText);
    }
  }

  /**
   * Send a purchase bill via WhatsApp
   * @param phoneNumber - Recipient's phone number (with country code, e.g., +1234567890)
   * @param supplierName - Supplier's name
   * @param billNo - Bill number
   * @param totalAmount - Total bill amount
   * @param date - Bill date
   * @param documentUrl - URL of the purchase bill PDF (optional)
   */
  static async sendPurchaseBill(
    phoneNumber: string,
    supplierName: string,
    billNo: string,
    totalAmount: number,
    date: string,
    documentUrl?: string
  ): Promise<WASenderMessageResponse> {
    // Validate phone number first
    if (!this.validatePhoneNumber(phoneNumber)) {
      return {
        success: false,
        error: 'Invalid phone number format',
      };
    }

    const formattedPhone = this.formatPhoneNumber(phoneNumber);
    const messageText = `Dear ${supplierName},\n\nYour purchase bill ${billNo} has been generated.\n\nTotal Amount: ₹${totalAmount.toLocaleString()}\nDate: ${date}\n\nPayment will be processed as per our terms.`;

    if (documentUrl) {
      return this.sendDocument(
        formattedPhone,
        messageText,
        documentUrl,
        `purchase-bill-${billNo}.pdf`
      );
    } else {
      return this.sendTextMessage(formattedPhone, messageText);
    }
  }

  /**
   * Send a message via WASender API
   * @param request - Message request object
   */
  private static async sendMessage(request: WASenderMessageRequest): Promise<WASenderMessageResponse> {
    if (!this.API_KEY) {
      return {
        success: false,
        error: 'API key not configured. Please set your WASender API key in documentService.ts',
      };
    }

    if (!request.to) {
      return {
        success: false,
        error: 'Phone number is required',
      };
    }

    // Ensure phone number has country code
    const phoneNumber = request.to.startsWith('+') ? request.to : `+${request.to}`;

    try {
      const response = await fetch(`${this.API_BASE_URL}/send-message`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...request,
          to: phoneNumber,
        }),
      });

      const responseData = await response.json();

      if (response.ok) {
        return {
          success: true,
          message: 'Message sent successfully',
        };
      } else {
        return {
          success: false,
          error: responseData.error || responseData.message || 'Failed to send message',
        };
      }
    } catch (error) {
      console.error('WASender API Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error occurred',
      };
    }
  }

  /**
   * Validate phone number format
   * @param phoneNumber - Phone number to validate
   */
  static validatePhoneNumber(phoneNumber: string): boolean {
    // Basic validation for international phone number format
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    return phoneRegex.test(phoneNumber.replace(/\s/g, ''));
  }

  /**
   * Format phone number to ensure it has country code
   * @param phoneNumber - Phone number to format
   */
  static formatPhoneNumber(phoneNumber: string): string {
    const cleaned = phoneNumber.replace(/\s/g, '');
    return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
  }

  // ============================================================================
  // COMBINED WORKFLOW METHODS
  // ============================================================================

  /**
   * Complete workflow: Upload invoice PDF and send via WhatsApp
   * @param pdfUri - Local file URI of the invoice PDF
   * @param invoiceNo - Invoice number
   * @param phoneNumber - Recipient's phone number
   * @param customerName - Customer's name
   * @param totalAmount - Total invoice amount
   * @param date - Invoice date
   */
  static async uploadAndSendInvoice(
    pdfUri: string,
    invoiceNo: string,
    phoneNumber: string,
    customerName: string,
    totalAmount: number,
    date: string
  ): Promise<{ uploadSuccess: boolean; sendSuccess: boolean; documentUrl?: string; error?: string }> {
    try {
      // Step 1: Upload PDF to Cloudinary
      const uploadResult = await this.uploadInvoicePdf(pdfUri, invoiceNo);
      
      if (!uploadResult.success) {
        return {
          uploadSuccess: false,
          sendSuccess: false,
          error: `PDF upload failed: ${uploadResult.error}`
        };
      }

      // Step 2: Send invoice via WhatsApp
      const sendResult = await this.sendInvoice(
        phoneNumber,
        customerName,
        invoiceNo,
        totalAmount,
        date,
        uploadResult.url
      );

      return {
        uploadSuccess: true,
        sendSuccess: sendResult.success,
        documentUrl: uploadResult.url,
        error: sendResult.success ? undefined : `WhatsApp send failed: ${sendResult.error}`
      };

    } catch (error) {
      return {
        uploadSuccess: false,
        sendSuccess: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Complete workflow: Upload purchase bill PDF and send via WhatsApp
   * @param pdfUri - Local file URI of the purchase bill PDF
   * @param billNo - Bill number
   * @param phoneNumber - Recipient's phone number
   * @param supplierName - Supplier's name
   * @param totalAmount - Total bill amount
   * @param date - Bill date
   */
  static async uploadAndSendPurchaseBill(
    pdfUri: string,
    billNo: string,
    phoneNumber: string,
    supplierName: string,
    totalAmount: number,
    date: string
  ): Promise<{ uploadSuccess: boolean; sendSuccess: boolean; documentUrl?: string; error?: string }> {
    try {
      // Step 1: Upload PDF to Cloudinary
      const uploadResult = await this.uploadPurchaseBillPdf(pdfUri, billNo);
      
      if (!uploadResult.success) {
        return {
          uploadSuccess: false,
          sendSuccess: false,
          error: `PDF upload failed: ${uploadResult.error}`
        };
      }

      // Step 2: Send purchase bill via WhatsApp
      const sendResult = await this.sendPurchaseBill(
        phoneNumber,
        supplierName,
        billNo,
        totalAmount,
        date,
        uploadResult.url
      );

      return {
        uploadSuccess: true,
        sendSuccess: sendResult.success,
        documentUrl: uploadResult.url,
        error: sendResult.success ? undefined : `WhatsApp send failed: ${sendResult.error}`
      };

    } catch (error) {
      return {
        uploadSuccess: false,
        sendSuccess: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }
}

// Export individual classes for backward compatibility
export const CloudinaryUploader = DocumentService;
export const WASenderAPI = DocumentService;
