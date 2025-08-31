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

interface PurchaseBill {
  id: string;
  billNo: string;
  supplierName: string;
  phoneNumber: string;
  items: PurchaseItem[];
  totalAmount: number;
  date: string;
  status: 'pending' | 'completed' | 'cancelled';
}

interface PurchaseItem {
  id: string;
  itemName: string;
  quantity: number;
  rate: number;
  total: number;
}

export class PurchaseBillPdfGenerator {
  private static async getCompanyDetails(): Promise<CompanyDetails | null> {
    try {
      return await Storage.getObject<CompanyDetails>(STORAGE_KEYS.COMPANY_DETAILS);
    } catch (error) {
      console.error('Error loading company details:', error);
      return null;
    }
  }

  private static generatePurchaseBillHTML(bill: PurchaseBill, companyDetails: CompanyDetails | null): string {
    const currentDate = new Date().toLocaleDateString('en-IN');
    const billDate = bill.date || currentDate;
    
    // Generate items HTML
    const itemsHTML = bill.items.map((item, index) => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: left;">${index + 1}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: left;">${item.itemName}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">₹${item.rate.toLocaleString()}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">₹${item.total.toLocaleString()}</td>
      </tr>
    `).join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Purchase Bill #${bill.billNo}</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #ffffff;
            color: #1f2937;
            line-height: 1.6;
          }
          .bill-container {
            max-width: 800px;
            margin: 0 auto;
            background: #ffffff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
          .header {
            background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%);
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
          .bill-title {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 10px;
          }
          .bill-number {
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
            color: #dc2626;
            margin-bottom: 10px;
            border-bottom: 2px solid #dc2626;
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
          .items-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            background: #f9fafb;
            border-radius: 8px;
            overflow: hidden;
          }
          .table-header {
            background: #dc2626;
            color: white;
          }
          .table-header th {
            padding: 15px 12px;
            text-align: left;
            font-weight: 600;
            font-size: 14px;
          }
          .table-header th:first-child {
            text-align: center;
          }
          .table-header th:nth-child(3),
          .table-header th:nth-child(4),
          .table-header th:nth-child(5) {
            text-align: center;
          }
          .table-header th:last-child {
            text-align: right;
          }
          .total-section {
            margin-top: 30px;
            text-align: right;
          }
          .total-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 0;
            font-size: 16px;
          }
          .total-label {
            font-weight: 600;
            color: #6b7280;
          }
          .total-amount {
            font-weight: bold;
            color: #1f2937;
          }
          .grand-total {
            font-size: 20px;
            font-weight: bold;
            color: #dc2626;
            border-top: 2px solid #e5e7eb;
            padding-top: 10px;
            margin-top: 10px;
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
            color: rgba(220, 38, 38, 0.1);
            font-weight: bold;
            pointer-events: none;
            z-index: -1;
          }
        </style>
      </head>
      <body>
        <div class="watermark">${companyDetails?.businessName || 'PURCHASE BILL'}</div>
        <div class="bill-container">
          <div class="header">
            <div class="company-name">${companyDetails?.businessName || 'Your Business Name'}</div>
            <div class="company-description">${companyDetails?.businessDescription || 'Business Description'}</div>
            <div class="bill-title">PURCHASE BILL</div>
            <div class="bill-number">Bill #${bill.billNo}</div>
          </div>
          
          <div class="content">
            <div class="info-section">
              <div class="info-block">
                <div class="info-title">Bill From</div>
                <div class="info-item">
                  <span class="info-label">Supplier:</span>
                  <span class="info-value">${bill.supplierName}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Phone:</span>
                  <span class="info-value">${bill.phoneNumber}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Date:</span>
                  <span class="info-value">${billDate}</span>
                </div>
              </div>
              
              <div class="info-block">
                <div class="info-title">Bill To</div>
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
            
            <table class="items-table">
              <thead class="table-header">
                <tr>
                  <th>Sr. No.</th>
                  <th>Item Description</th>
                  <th>Quantity</th>
                  <th>Rate (₹)</th>
                  <th>Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHTML}
              </tbody>
            </table>
            
            <div class="total-section">
              <div class="total-row">
                <span class="total-label">Total Amount:</span>
                <span class="total-amount">₹${bill.totalAmount.toLocaleString()}</span>
              </div>
              <div class="total-row grand-total">
                <span class="total-label">Grand Total:</span>
                <span class="total-amount">₹${bill.totalAmount.toLocaleString()}</span>
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
                  • Payment will be made within 30 days of bill date<br>
                  • Goods received in good condition<br>
                  • Any defects must be reported within 7 days<br>
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

  static async generateAndSharePurchaseBill(bill: PurchaseBill): Promise<boolean> {
    try {
      // Get company details
      const companyDetails = await this.getCompanyDetails();
      
      // Generate HTML
      const html = this.generatePurchaseBillHTML(bill, companyDetails);
      
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
            dialogTitle: `Purchase Bill #${bill.billNo}`,
          });
          return true;
        } else {
          return false;
        }
      } else {
        throw new Error('Failed to generate PDF file');
      }
    } catch (error) {
      console.error('Error generating and sharing purchase bill:', error);
      return false;
    }
  }

  static async generatePurchaseBillPDF(bill: PurchaseBill): Promise<string | null> {
    try {
      // Get company details
      const companyDetails = await this.getCompanyDetails();
      
      // Generate HTML
      const html = this.generatePurchaseBillHTML(bill, companyDetails);
      
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
      console.error('Error generating purchase bill PDF:', error);
      return null;
    }
  }

  static async savePurchaseBillToDocuments(bill: PurchaseBill): Promise<string | null> {
    try {
      const fileUri = await this.generatePurchaseBillPDF(bill);
      
      if (fileUri) {
        // Get the documents directory
        const documentsDir = FileSystem.documentDirectory;
        if (!documentsDir) {
          throw new Error('Documents directory not available');
        }
        
        const fileName = `PurchaseBill_${bill.billNo}_${Date.now()}.pdf`;
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
      console.error('Error saving purchase bill to documents:', error);
      return null;
    }
  }
}
