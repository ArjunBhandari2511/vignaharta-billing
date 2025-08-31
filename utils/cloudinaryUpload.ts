import * as FileSystem from 'expo-file-system';

interface CloudinaryUploadResponse {
  success: boolean;
  url?: string;
  error?: string;
}

export class CloudinaryUploader {
  private static readonly BACKEND_URL = 'http://192.168.29.111:5000'; // Update this to your backend URL
  private static readonly CLOUDINARY_CLOUD_NAME = 'your-cloud-name'; // Replace with your Cloudinary cloud name
  private static readonly CLOUDINARY_UPLOAD_PRESET = 'your-upload-preset'; // Replace with your upload preset

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


}
