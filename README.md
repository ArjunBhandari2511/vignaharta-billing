# Vignaharta Inventory Management

This is an Expo React Native application for inventory management with a Node.js backend.

## Backend Integration

The frontend has been updated to integrate with the backend API server.

### Backend Requirements

1. **Backend Server**: Must be running on `192.168.29.111:5000`
2. **Database**: MongoDB with Mongoose
3. **API Endpoints**: RESTful API for CRUD operations on items

### Getting Started

1. **Start the Backend Server**:
   ```bash
   cd backend
   npm install
   npm start
   ```

2. **Start the Frontend**:
   ```bash
   npm start
   ```

### API Endpoints

- `GET /api/items` - Get all items
- `GET /api/items/:id` - Get item by ID
- `POST /api/items` - Create new item
- `PUT /api/items/:id` - Update item
- `DELETE /api/items/:id` - Delete item

### Item Data Structure

```typescript
interface Item {
  _id: string;
  productName: string;
  category: 'Primary' | 'Kirana';
  purchasePrice: number;
  salePrice: number;
  openingStock: number; // in bags
  asOfDate: string;
  lowStockAlert: number; // in bags
  createdAt: string;
  updatedAt: string;
  isUniversal?: boolean;
}
```

### Features

- ✅ Create Items (with validation)
- ✅ Update Items (with validation)
- ✅ Delete Items (with confirmation)
- ✅ Real-time data from backend
- ✅ Loading states and error handling
- ✅ Search and filter functionality

### Network Configuration

Make sure your device/emulator can reach the backend server at `192.168.29.111:5000`. If you're using a different IP address, update the `constants/Config.ts` file.
