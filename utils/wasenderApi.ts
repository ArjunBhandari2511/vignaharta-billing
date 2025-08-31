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

export class WASenderAPI {
  private static readonly API_BASE_URL = 'https://www.wasenderapi.com/api';
  // TODO: Replace with your actual WASender API key
  private static readonly API_KEY = '956cd4670c2da1a95c0c06736e07783ddf2d3fdcd8ed00eed0700118ed04117a';

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
        error: 'API key not configured. Please set your WASender API key in wasenderApi.ts',
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
}
