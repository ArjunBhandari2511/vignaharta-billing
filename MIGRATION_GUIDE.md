# Migration Guide: Frontend to Backend PDF Services

## Overview

The PDF generation and document services have been migrated from the frontend to the backend for better performance, security, and maintainability.

## What Was Migrated

### 1. PDF Generation (`basePdfGenerator.ts` → Backend)
- **Before**: PDF generation happened on the frontend using Expo Print
- **After**: PDF generation happens on the backend using Puppeteer
- **Benefits**: Better rendering, consistent output, reduced frontend load

### 2. Document Services (`documentService.ts` → Backend)
- **Before**: Cloudinary uploads and WhatsApp integration from frontend
- **After**: All document operations handled by backend services
- **Benefits**: Centralized API management, better error handling, secure API keys

## New Frontend API Usage

### Import the PDF API
```typescript
import { pdfApi } from '../utils/apiService';
```

### Generate PDFs
```typescript
// Generate invoice PDF
const result = await pdfApi.generateInvoice(invoiceData);

// Generate purchase bill PDF
const result = await pdfApi.generatePurchaseBill(billData);

// Generate payment receipt PDF
const result = await pdfApi.generatePaymentReceipt(paymentData);

// Generate payment voucher PDF
const result = await pdfApi.generatePaymentVoucher(paymentData);
```

### Upload PDFs to Cloudinary
```typescript
const result = await pdfApi.uploadPdf(filePath, fileName, 'invoice');
```

### Send WhatsApp Messages
```typescript
// Send text message
const result = await pdfApi.sendTextMessage(phoneNumber, message);

// Send document
const result = await pdfApi.sendDocument(phoneNumber, message, documentUrl, fileName);
```

### Combined Workflows (Recommended)
```typescript
// Generate invoice and send via WhatsApp in one call
const result = await pdfApi.generateAndSendInvoice(
  invoiceData,
  phoneNumber,
  customerName,
  totalAmount,
  date
);

// Generate purchase bill and send via WhatsApp in one call
const result = await pdfApi.generateAndSendPurchaseBill(
  billData,
  phoneNumber,
  supplierName,
  totalAmount,
  date
);
```

## Migration Steps for Existing Code

### Step 1: Replace PDF Generation Calls
**Before:**
```typescript
import { BasePdfGenerator } from '../utils/basePdfGenerator';

const pdfUri = await BasePdfGenerator.generateInvoicePDF(invoice);
```

**After:**
```typescript
import { pdfApi } from '../utils/apiService';

const result = await pdfApi.generateInvoice(invoice);
const pdfFilePath = result.data.filePath;
```

### Step 2: Replace Document Service Calls
**Before:**
```typescript
import { DocumentService } from '../utils/documentService';

const uploadResult = await DocumentService.uploadInvoicePdf(pdfUri, invoiceNo);
const sendResult = await DocumentService.sendInvoice(phoneNumber, customerName, invoiceNo, totalAmount, date, uploadResult.url);
```

**After:**
```typescript
import { pdfApi } from '../utils/apiService';

const result = await pdfApi.generateAndSendInvoice(
  invoice,
  phoneNumber,
  customerName,
  totalAmount,
  date
);
```

### Step 3: Update Error Handling
**Before:**
```typescript
if (pdfUri) {
  // Handle success
} else {
  // Handle error
}
```

**After:**
```typescript
if (result.success) {
  // Handle success
  const { pdfGenerated, uploadSuccess, sendSuccess, documentUrl } = result.data;
} else {
  // Handle error
  console.error(result.error);
}
```

## API Response Structure

### Success Response
```typescript
{
  success: true,
  message: "Invoice generated and sent successfully",
  data: {
    pdfGenerated: true,
    pdfFileName: "invoice-INV001-1234567890.pdf",
    uploadSuccess: true,
    sendSuccess: true,
    documentUrl: "https://cloudinary.com/...",
    error: undefined
  }
}
```

### Error Response
```typescript
{
  success: false,
  error: "Error message here",
  message: "Detailed error message"
}
```

## Benefits of Migration

1. **Performance**: Backend PDF generation is faster and more reliable
2. **Security**: API keys and sensitive operations moved to backend
3. **Maintainability**: Centralized PDF generation logic
4. **Scalability**: Backend can handle multiple concurrent requests
5. **Consistency**: Uniform PDF output across all devices
6. **Error Handling**: Better error reporting and logging

## Backend Requirements

- Node.js with Puppeteer support
- Cloudinary account configured
- WASender API key configured
- MongoDB connection
- Sufficient disk space for temporary PDF storage

## Testing

Test the new endpoints using:
- Postman or similar API testing tool
- Frontend integration tests
- Backend unit tests for PDF generation

## Support

For issues or questions about the migration:
1. Check the backend logs for detailed error messages
2. Verify environment variables are correctly set
3. Ensure all dependencies are installed
4. Check MongoDB connection status
