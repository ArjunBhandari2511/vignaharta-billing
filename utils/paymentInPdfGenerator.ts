import * as FileSystem from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Storage, STORAGE_KEYS } from './storage';

interface CompanyDetails {
  businessName: string;
  phoneNumber1: string;
  phoneNumber2: string;
  emailId: string;
  businessAddress: string;
  pincode: string;
  businessDescription: string;
  signature: string;
  profileImage?: string;
}

interface PaymentIn {
  id: string;
  paymentNo: string;
  customerName: string;
  phoneNumber: string;
  received: number;
  totalAmount: number;
  date: string;
  status: 'pending' | 'completed' | 'cancelled';
}

export class PaymentInPdfGenerator {
  private static async getCompanyDetails(): Promise<CompanyDetails | null> {
    try {
      return await Storage.getObject<CompanyDetails>(STORAGE_KEYS.COMPANY_DETAILS);
    } catch (error) {
      console.error('Error loading company details:', error);
      return null;
    }
  }

  private static generatePaymentInHTML(payment: PaymentIn, companyDetails: CompanyDetails | null): string {
    const currentDate = new Date().toLocaleDateString('en-IN');
    const paymentDate = payment.date || currentDate;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Payment Receipt #${payment.paymentNo}</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #ffffff;
            color: #1f2937;
            line-height: 1.6;
          }
          .receipt-container {
            max-width: 800px;
            margin: 0 auto;
            background: #ffffff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
          .header {
            background: linear-gradient(135deg, #059669 0%, #10b981 100%);
            color: white;
            padding: 30px;
            text-align: center;
          }
          .company-name {
            font-size: 28px;
            font-weight: bold;
            margin-bottom: 8px;
          }
          .company-description {
            font-size: 16px;
            opacity: 0.9;
            margin-bottom: 20px;
          }
          .receipt-title {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 10px;
          }
          .receipt-number {
            font-size: 18px;
            opacity: 0.9;
          }
          .content {
            padding: 30px;
          }
          .info-section {
            display: flex;
            justify-content: space-between;
            margin-bottom: 30px;
          }
          .info-block {
            flex: 1;
          }
          .info-block:first-child {
            margin-right: 40px;
          }
          .info-title {
            font-size: 16px;
            font-weight: bold;
            color: #059669;
            margin-bottom: 10px;
            border-bottom: 2px solid #059669;
            padding-bottom: 5px;
          }
          .info-item {
            margin-bottom: 8px;
            font-size: 14px;
          }
          .info-label {
            font-weight: 600;
            color: #6b7280;
          }
          .info-value {
            color: #1f2937;
          }
          .payment-details {
            background: #f0fdf4;
            border: 2px solid #bbf7d0;
            border-radius: 12px;
            padding: 24px;
            margin: 20px 0;
          }
          .payment-details-title {
            font-size: 18px;
            font-weight: bold;
            color: #059669;
            margin-bottom: 16px;
            text-align: center;
          }
          .payment-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 0;
            border-bottom: 1px solid #d1fae5;
          }
          .payment-row:last-child {
            border-bottom: none;
            border-top: 2px solid #059669;
            margin-top: 8px;
            padding-top: 16px;
          }
          .payment-label {
            font-weight: 600;
            color: #374151;
            font-size: 16px;
          }
          .payment-amount {
            font-weight: bold;
            color: #059669;
            font-size: 18px;
          }
          .grand-total {
            font-size: 20px;
            font-weight: bold;
            color: #059669;
          }
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
          }
          .signature-section {
            flex: 1;
          }
          .signature-title {
            font-size: 14px;
            font-weight: 600;
            color: #6b7280;
            margin-bottom: 10px;
          }
          .signature-line {
            width: 200px;
            height: 1px;
            background: #6b7280;
            margin-bottom: 5px;
          }
          .signature-name {
            font-size: 14px;
            font-weight: 600;
            color: #1f2937;
          }
          .terms-section {
            flex: 1;
            margin-left: 40px;
          }
          .terms-title {
            font-size: 14px;
            font-weight: 600;
            color: #6b7280;
            margin-bottom: 10px;
          }
          .terms-text {
            font-size: 12px;
            color: #6b7280;
            line-height: 1.4;
          }
          .watermark {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 48px;
            color: rgba(5, 150, 105, 0.1);
            font-weight: bold;
            pointer-events: none;
            z-index: -1;
          }
          .status-badge {
            display: inline-block;
            background: #10b981;
            color: white;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            margin-left: 12px;
          }
        </style>
      </head>
      <body>
        <div class="watermark">${companyDetails?.businessName || 'PAYMENT RECEIPT'}</div>
        <div class="receipt-container">
          <div class="header">
            <div class="company-name">${companyDetails?.businessName || 'Your Business Name'}</div>
            <div class="company-description">${companyDetails?.businessDescription || 'Business Description'}</div>
            <div class="receipt-title">PAYMENT RECEIPT</div>
            <div class="receipt-number">Receipt #${payment.paymentNo}</div>
          </div>
          
          <div class="content">
            <div class="info-section">
              <div class="info-block">
                <div class="info-title">Received From</div>
                <div class="info-item">
                  <span class="info-label">Customer Name:</span>
                  <span class="info-value">${payment.customerName}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Phone Number:</span>
                  <span class="info-value">${payment.phoneNumber}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Date:</span>
                  <span class="info-value">${paymentDate}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Status:</span>
                  <span class="info-value">
                    ${payment.status}
                    <span class="status-badge">${payment.status}</span>
                  </span>
                </div>
              </div>
              
              <div class="info-block">
                <div class="info-title">Business Details</div>
                <div class="info-item">
                  <span class="info-label">Business:</span>
                  <span class="info-value">${companyDetails?.businessName || 'Your Business Name'}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Address:</span>
                  <span class="info-value">${companyDetails?.businessAddress || 'Business Address'}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Pincode:</span>
                  <span class="info-value">${companyDetails?.pincode || 'Pincode'}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Phone:</span>
                  <span class="info-value">${companyDetails?.phoneNumber1 || 'Phone Number'}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Email:</span>
                  <span class="info-value">${companyDetails?.emailId || 'Email Address'}</span>
                </div>
              </div>
            </div>
            
            <div class="payment-details">
              <div class="payment-details-title">Payment Summary</div>
              
              <div class="payment-row">
                <span class="payment-label">Outstanding Balance:</span>
                <span class="payment-amount">₹${payment.totalAmount.toLocaleString()}</span>
              </div>
              
              <div class="payment-row">
                <span class="payment-label">Amount Received:</span>
                <span class="payment-amount">₹${payment.received.toLocaleString()}</span>
              </div>
              
              <div class="payment-row">
                <span class="payment-label">Remaining Balance:</span>
                <span class="payment-amount">₹${(payment.totalAmount - payment.received).toLocaleString()}</span>
              </div>
            </div>
            
            <div class="footer">
              <div class="signature-section">
                <div class="signature-title">Authorized Signature</div>
                <div class="signature-line"></div>
                <div class="signature-name">${companyDetails?.signature || 'Authorized Person'}</div>
              </div>
              
              <div class="terms-section">
                <div class="terms-title">Terms & Conditions</div>
                <div class="terms-text">
                  • This receipt confirms payment received<br>
                  • Payment is non-refundable<br>
                  • Receipt is valid for accounting purposes<br>
                  • Subject to local jurisdiction
                </div>
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    return html;
  }

  static async generateAndSharePaymentReceipt(payment: PaymentIn): Promise<boolean> {
    try {
      // Get company details
      const companyDetails = await this.getCompanyDetails();
      
      // Generate HTML
      const html = this.generatePaymentInHTML(payment, companyDetails);
      
      // Generate PDF
      const { uri } = await Print.printToFileAsync({
        html: html,
        base64: false,
      });
      
      if (uri) {
        // Check if sharing is available
        const isSharingAvailable = await Sharing.isAvailableAsync();
        
        if (isSharingAvailable) {
          await Sharing.shareAsync(uri, {
            mimeType: 'application/pdf',
            dialogTitle: `Payment Receipt #${payment.paymentNo}`,
          });
          return true;
        } else {
          return false;
        }
      } else {
        throw new Error('Failed to generate PDF file');
      }
    } catch (error) {
      console.error('Error generating and sharing payment receipt:', error);
      return false;
    }
  }

  static async generatePaymentReceiptPDF(payment: PaymentIn): Promise<string | null> {
    try {
      // Get company details
      const companyDetails = await this.getCompanyDetails();
      
      // Generate HTML
      const html = this.generatePaymentInHTML(payment, companyDetails);
      
      // Generate PDF
      const { uri } = await Print.printToFileAsync({
        html: html,
        base64: false,
      });
      
      if (uri) {
        // Verify the file exists and has content
        try {
          const fileInfo = await FileSystem.getInfoAsync(uri);
          
          if (!fileInfo.exists) {
            console.error('Generated PDF file does not exist');
            return null;
          }
          
          if (fileInfo.size === 0) {
            console.error('Generated PDF file is empty');
            return null;
          }
        } catch (fileError) {
          console.error('Error checking PDF file:', fileError);
        }
      }
      
      return uri || null;
    } catch (error) {
      console.error('Error generating payment receipt PDF:', error);
      return null;
    }
  }

  static async savePaymentReceiptToDocuments(payment: PaymentIn): Promise<string | null> {
    try {
      const fileUri = await this.generatePaymentReceiptPDF(payment);
      
      if (fileUri) {
        // Get the documents directory
        const documentsDir = FileSystem.documentDirectory;
        if (!documentsDir) {
          throw new Error('Documents directory not available');
        }
        
        const fileName = `PaymentReceipt_${payment.paymentNo}_${Date.now()}.pdf`;
        const destinationUri = `${documentsDir}${fileName}`;
        
        // Copy the file to documents directory
        await FileSystem.copyAsync({
          from: fileUri,
          to: destinationUri,
        });
        
        return destinationUri;
      }
      
      return null;
    } catch (error) {
      console.error('Error saving payment receipt to documents:', error);
      return null;
    }
  }
}
