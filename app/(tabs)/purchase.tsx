import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    Alert,
    Dimensions,
    FlatList,
    KeyboardAvoidingView,
    Modal,
    Platform,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { Colors } from '../../constants/Colors';
import { CloudinaryUploader } from '../../utils/cloudinaryUpload';
import { PurchaseBillPdfGenerator } from '../../utils/purchaseBillPdfGenerator';
import { Storage, STORAGE_KEYS } from '../../utils/storage';
import { SupplierManager } from '../../utils/supplierManager';
import { WASenderAPI } from '../../utils/wasenderApi';

// Android-specific utilities
const isAndroid = Platform.OS === 'android';
const { width, height } = Dimensions.get('window');

// Android-specific constants
const ANDROID_CONSTANTS = {
  statusBarHeight: isAndroid ? StatusBar.currentHeight || 24 : 0,
  navigationBarHeight: isAndroid ? 48 : 0,
  touchTargetMinSize: 48, // Android Material Design minimum touch target
  elevation: {
    low: isAndroid ? 2 : 0,
    medium: isAndroid ? 4 : 0,
    high: isAndroid ? 8 : 0,
  },
  rippleColor: isAndroid ? 'rgba(0, 0, 0, 0.1)' : undefined,
};

interface PurchaseBill {
  id: string;
  billNo: string;
  supplierName: string;
  phoneNumber: string;
  items: PurchaseItem[];
  totalAmount: number;
  date: string;
  status: 'pending' | 'completed' | 'cancelled';
  pdfUri?: string; // Store the generated PDF URI
}

interface PurchaseItem {
  id: string;
  itemName: string;
  quantity: number;
  rate: number;
  total: number;
}

export default function PurchaseScreen() {
  const router = useRouter();
  const [purchaseBills, setPurchaseBills] = useState<PurchaseBill[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  
  // Modal states
  const [showBillModal, setShowBillModal] = useState(false);
  
  // Bill form states
  const [billForm, setBillForm] = useState({
    supplierName: '',
    phoneNumber: '',
    items: [] as PurchaseItem[],
  });

  // Dropdown visibility state
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  
  // Auto-generated bill number
  const [generatedBillNo, setGeneratedBillNo] = useState<string>('');
  
  // Selected supplier balance state
  const [selectedSupplierBalance, setSelectedSupplierBalance] = useState<number | null>(null);

  useEffect(() => {
    loadPurchaseData();
    loadSuppliers();
  }, []);

  // Generate bill number when purchase data changes
  useEffect(() => {
    setGeneratedBillNo(generateNextBillNumber());
  }, [purchaseBills]);

  // Reload suppliers when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadSuppliers();
    }, [])
  );

  // Handle incoming selected items from add-items screen
  useFocusEffect(
    useCallback(() => {
      const handleIncomingItems = async () => {
        try {
          const tempPurchaseItems = await Storage.getObject('TEMP_PURCHASE_ITEMS');
          if (tempPurchaseItems && Array.isArray(tempPurchaseItems) && tempPurchaseItems.length > 0) {
            // Add the selected items to the current bill form
            setBillForm(prev => ({
              ...prev,
              items: [...prev.items, ...tempPurchaseItems]
            }));
            
            // Reopen the modal since it was closed when navigating to add-items
            setShowBillModal(true);
            
            // Show success message
            Alert.alert('Items Added', `${tempPurchaseItems.length} items have been added to your purchase bill.`);
            
            // Clear the temporary storage to prevent duplicate processing
            await Storage.removeItem('TEMP_PURCHASE_ITEMS');
          }
        } catch (error) {
          console.error('Error handling incoming items:', error);
        }
      };

      handleIncomingItems();
    }, [])
  );

  const loadPurchaseData = async () => {
    try {
      const billsData = await Storage.getObject<any[]>(STORAGE_KEYS.PURCHASE_BILLS);
      const paymentsData = await Storage.getObject<any[]>(STORAGE_KEYS.PURCHASE_PAYMENTS);
      
      setPurchaseBills(billsData || []);
    } catch (error) {
      console.error('Error loading purchase data:', error);
    }
  };



  const loadSuppliers = async () => {
    try {
      const suppliersData = await SupplierManager.getAllSuppliers();
      setSuppliers(suppliersData);
    } catch (error) {
      console.error('Error loading suppliers:', error);
    }
  };

  // Generate next bill number
  const generateNextBillNumber = (): string => {
    if (purchaseBills.length === 0) {
      return '1';
    }
    
    const maxNumber = Math.max(...purchaseBills.map(bill => {
      const billNo = bill.billNo || '0';
      return parseInt(billNo, 10) || 0;
    }));
    
    return (maxNumber + 1).toString();
  };

  // Reset form function
  const resetForm = () => {
    setBillForm({
      supplierName: '',
      phoneNumber: '',
      items: [],
    });
    setShowSupplierDropdown(false);
    setSelectedSupplierBalance(null);
    setShowBillModal(false);
  };

  const addBillItem = () => {
    setShowBillModal(false);
    // Set mode for purchase items
    Storage.setObject('ITEM_SELECTION_MODE', 'purchase');
    // Small delay to ensure modal closes before navigation
    setTimeout(() => {
      router.push('/add-items');
    }, 100);
  };

  const updateBillItem = (index: number, field: keyof PurchaseItem, value: any) => {
    setBillForm(prev => {
      const updatedItems = [...prev.items];
      updatedItems[index] = { ...updatedItems[index], [field]: value };
      
      // Recalculate total for this item
      if (field === 'quantity' || field === 'rate') {
        updatedItems[index].total = (updatedItems[index].quantity || 0) * (updatedItems[index].rate || 0);
      }
      
      return { ...prev, items: updatedItems };
    });
  };

  const removeBillItem = (index: number) => {
    setBillForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const calculateBillTotal = (): number => {
    return billForm.items.reduce((sum, item) => sum + (item.total || 0), 0);
  };

  const handleCreateBill = async () => {
    // Validation
    if (!billForm.supplierName.trim() || !billForm.phoneNumber.trim()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (billForm.items.length === 0) {
      Alert.alert('Error', 'Please add at least one item');
      return;
    }

    // Check if this is an existing supplier and get their balance
    const existingSupplier = suppliers.find(supplier => 
      supplier.name.toLowerCase() === billForm.supplierName.toLowerCase() &&
      supplier.phoneNumber === billForm.phoneNumber
    );

    if (existingSupplier && existingSupplier.balance > 0) {
      Alert.alert(
        'Supplier Has Outstanding Balance',
        `${billForm.supplierName} has an outstanding balance of ₹${existingSupplier.balance.toLocaleString()}. Do you want to proceed with creating this bill?`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Proceed',
            onPress: () => createBill(),
          },
        ]
      );
      return;
    }

    // If no outstanding balance or new supplier, proceed directly
    createBill();
  };

  const createBill = async () => {
    const newBill: PurchaseBill = {
      id: Date.now().toString(),
      billNo: generatedBillNo,
      supplierName: billForm.supplierName,
      phoneNumber: billForm.phoneNumber,
      items: billForm.items,
      totalAmount: calculateBillTotal(),
      date: new Date().toLocaleDateString(),
      status: 'pending',
    };

    // Generate PDF in the background
    let pdfUri: string | undefined;
    try {
      const generatedPdfUri = await PurchaseBillPdfGenerator.generatePurchaseBillPDF(newBill);
      if (generatedPdfUri) {
        pdfUri = generatedPdfUri;
        newBill.pdfUri = pdfUri;
        
        // Add a small delay to ensure file is fully written
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        console.error('PDF generation returned null');
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      // Continue with bill creation even if PDF generation fails
    }

    const updatedBills = [...purchaseBills, newBill];
    setPurchaseBills(updatedBills);
    
    // Reset form
    resetForm();
    
    // Save to storage with updated data
    try {
      await Storage.setObject(STORAGE_KEYS.PURCHASE_BILLS, updatedBills);
      
      // Trigger balance recalculation
      await Storage.setObject('LAST_TRANSACTION_UPDATE', Date.now().toString());
      
      // Send bill via WhatsApp
      await sendBillViaWhatsApp(newBill, pdfUri);
      
      Alert.alert('Success', 'Purchase bill created and sent to supplier via WhatsApp!');
    } catch (error) {
      console.error('Error saving bill:', error);
      Alert.alert('Error', 'Failed to save purchase bill. Please try again.');
    }
  };

  const sendBillViaWhatsApp = async (bill: PurchaseBill, pdfUri?: string) => {
    try {
      // Validate phone number
      if (!WASenderAPI.validatePhoneNumber(bill.phoneNumber)) {
        console.warn('Invalid phone number format:', bill.phoneNumber);
        return;
      }

      const formattedPhone = WASenderAPI.formatPhoneNumber(bill.phoneNumber);
      
      let documentUrl: string | undefined;
      
      // Upload PDF to Cloudinary if available
      if (pdfUri) {
        const uploadResult = await CloudinaryUploader.uploadPurchaseBillPdf(pdfUri, bill.billNo);
        
        if (uploadResult.success && uploadResult.url) {
          documentUrl = uploadResult.url;
        } else {
          console.error('Failed to upload PDF:', uploadResult.error);
        }
      }
      
      // Send bill via WhatsApp (with document if available)
      const response = await WASenderAPI.sendPurchaseBill(
        formattedPhone,
        bill.supplierName,
        bill.billNo,
        bill.totalAmount,
        bill.date,
        documentUrl // Pass the Cloudinary URL if available
      );
      
      if (!response.success) {
        console.error('Failed to send WhatsApp bill:', response.error);
      }
    } catch (error) {
      console.error('Error sending bill via WhatsApp:', error);
    }
  };

  const renderBillItem = ({ item, index }: { item: PurchaseItem; index: number }) => {
    return (
      <View style={styles.billItemContainer}>
        <View style={styles.billItemRow}>
          <View style={styles.itemNameContainer}>
            <Text style={styles.fieldLabel}>Item Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter item name..."
              placeholderTextColor={Colors.textTertiary}
              value={item.itemName}
              onChangeText={(text) => updateBillItem(index, 'itemName', text)}
            />
          </View>
          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => removeBillItem(index)}
          >
            <Ionicons name="close-circle" size={20} color={Colors.error} />
          </TouchableOpacity>
        </View>
        
        <View style={styles.billItemDetails}>
          <View style={styles.quantityContainer}>
            <Text style={styles.fieldLabel}>Quantity</Text>
            <TextInput
              style={[styles.input, styles.quantityInput]}
              placeholder="Qty"
              placeholderTextColor={Colors.textTertiary}
              value={item.quantity.toString()}
              onChangeText={(text) => {
                const qty = parseInt(text) || 0;
                updateBillItem(index, 'quantity', qty);
              }}
              keyboardType="numeric"
            />
          </View>
          
          <View style={styles.priceContainer}>
            <Text style={styles.fieldLabel}>Price</Text>
            <TextInput
              style={[styles.input, styles.priceInput]}
              placeholder="Price"
              placeholderTextColor={Colors.textTertiary}
              value={item.rate.toString()}
              onChangeText={(text) => updateBillItem(index, 'rate', parseFloat(text) || 0)}
              keyboardType="numeric"
            />
          </View>
          
          <View style={styles.totalContainer}>
            <Text style={styles.fieldLabel}>Total</Text>
            <Text style={styles.totalText}>₹{item.total}</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderBillModal = () => (
    <Modal
      visible={showBillModal}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <KeyboardAvoidingView 
        style={styles.modalContainer} 
        behavior="padding"
        keyboardVerticalOffset={100}
      >
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Create Purchase Bill</Text>
          <TouchableOpacity onPress={resetForm}>
            <Ionicons name="close" size={24} color={Colors.text} />
          </TouchableOpacity>
        </View>
        
        <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled">
          <View style={styles.formSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Bill Details</Text>
              {selectedSupplierBalance !== null && (
                <View style={styles.balanceDisplay}>
                  <Text style={styles.balanceLabel}>Balance Amount:</Text>
                  <Text style={[
                    styles.balanceAmount,
                    { color: selectedSupplierBalance < 0 ? Colors.success : Colors.error }
                  ]}>
                    ₹{selectedSupplierBalance.toLocaleString()}
                  </Text>
                </View>
              )}

            </View>
            <View style={styles.billNumberDisplay}>
              <Text style={styles.fieldLabel}>Bill Number</Text>
              <Text style={styles.generatedBillNo}>#{generatedBillNo}</Text>
            </View>
            <View style={styles.supplierInputContainer}>
              <Text style={styles.fieldLabel}>Supplier Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter supplier name..."
                placeholderTextColor={Colors.textTertiary}
                value={billForm.supplierName}
                onChangeText={(text) => {
                  setBillForm(prev => ({ ...prev, supplierName: text }));
                  setShowSupplierDropdown(true);
                }}
                onFocus={() => setShowSupplierDropdown(true)}
              />
              {showSupplierDropdown && billForm.supplierName.length > 0 && (() => {
                const filteredSuppliers = suppliers.filter(supplier =>
                  supplier.name.toLowerCase().includes(billForm.supplierName.toLowerCase())
                );
                
                if (filteredSuppliers.length === 0) {
                  return null; // Don't show dropdown if no matches
                }
                
                return (
                  <View style={styles.supplierSuggestions}>
                    {filteredSuppliers.length > 3 ? (
                      <ScrollView 
                        style={styles.suggestionsScrollView}
                        showsVerticalScrollIndicator={true}
                        nestedScrollEnabled={true}
                      >
                        {filteredSuppliers.map((supplier) => (
                          <TouchableOpacity
                            key={supplier.id}
                            style={styles.suggestionItem}
                            onPress={() => {
                              setBillForm(prev => ({
                                ...prev,
                                supplierName: supplier.name,
                                phoneNumber: supplier.phoneNumber,
                              }));
                              setSelectedSupplierBalance(supplier.balance);
                              setShowSupplierDropdown(false);
                            }}
                          >
                            <Text style={styles.suggestionName}>{supplier.name}</Text>
                            <Text style={[
                              styles.suggestionAmount,
                              { color: supplier.balance < 0 ? Colors.success : Colors.error }
                            ]}>
                              ₹{supplier.balance.toLocaleString()}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    ) : (
                      // Show first 3 suppliers without scroll when 3 or fewer
                      filteredSuppliers.slice(0, 3).map((supplier) => (
                        <TouchableOpacity
                          key={supplier.id}
                          style={styles.suggestionItem}
                          onPress={() => {
                            setBillForm(prev => ({
                              ...prev,
                              supplierName: supplier.name,
                              phoneNumber: supplier.phoneNumber,
                            }));
                            setSelectedSupplierBalance(supplier.balance);
                            setShowSupplierDropdown(false);
                          }}
                        >
                          <Text style={styles.suggestionName}>{supplier.name}</Text>
                          <Text style={[
                            styles.suggestionAmount,
                            { color: supplier.balance < 0 ? Colors.success : Colors.error }
                          ]}>
                            ₹{supplier.balance.toLocaleString()}
                          </Text>
                        </TouchableOpacity>
                      ))
                    )}
                  </View>
                );
              })()}
            </View>
            <TextInput
              style={styles.input}
              placeholder="Phone Number"
              placeholderTextColor={Colors.textTertiary}
              value={billForm.phoneNumber}
              onChangeText={(text) => setBillForm(prev => ({ ...prev, phoneNumber: text }))}
              keyboardType="phone-pad"
            />
          </View>
          
          <View style={styles.formSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Items</Text>
              <TouchableOpacity style={styles.addItemsButton} onPress={addBillItem}>
                <Ionicons name="add" size={20} color={Colors.text} />
                <Text style={styles.addItemsButtonText}>Add Items</Text>
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={billForm.items}
              renderItem={renderBillItem}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
            />
            
            {billForm.items.length > 0 && (
              <View style={styles.totalSection}>
                <Text style={styles.totalLabel}>Total Amount:</Text>
                <Text style={styles.totalAmount}>₹{calculateBillTotal()}</Text>
              </View>
            )}
          </View>
        </ScrollView>
        
        <View style={styles.modalFooter}>
          <TouchableOpacity style={styles.cancelButton} onPress={resetForm}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.createButton} onPress={handleCreateBill}>
            <Text style={styles.createButtonText}>Create Bill</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        // Android-specific: Optimize scrolling
        {...(isAndroid && {
          overScrollMode: 'never',
          nestedScrollEnabled: true,
        })}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.companyName}>Purchases</Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
                  <TouchableOpacity 
          style={styles.primaryButton} 
          onPress={() => setShowBillModal(true)}
          activeOpacity={isAndroid ? 0.7 : 0.2}
          {...(isAndroid && {
            android_ripple: { color: ANDROID_CONSTANTS.rippleColor },
          })}
        >
          <Ionicons name="add" size={20} color={Colors.text} />
          <Text style={styles.primaryButtonText}>New Bill</Text>
        </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.primaryButton, { backgroundColor: Colors.error }]} 
            onPress={() => router.push('/payment-out')}
            activeOpacity={isAndroid ? 0.7 : 0.2}
            {...(isAndroid && {
              android_ripple: { color: ANDROID_CONSTANTS.rippleColor },
            })}
          >
            <Ionicons name="arrow-up-circle" size={20} color={Colors.text} />
            <Text style={styles.primaryButtonText}>Payment Out</Text>
          </TouchableOpacity>
        </View>
        


        {/* Bills List */}
        <View style={styles.listContainer}>
          <Text style={styles.sectionTitle}>Recent Bills</Text>
          {purchaseBills.length > 0 ? (
            purchaseBills.slice(0, 10).map((bill) => (
              <TouchableOpacity 
                key={bill.id} 
                style={styles.listItem}
                onPress={() => router.push(`/edit-purchase?billId=${bill.id}`)}
                activeOpacity={isAndroid ? 0.7 : 0.2}
                {...(isAndroid && {
                  android_ripple: { color: ANDROID_CONSTANTS.rippleColor },
                })}
              >
                <View style={styles.listItemHeader}>
                  <Text style={styles.listItemTitle}>#{bill.billNo}</Text>
                  <Text style={styles.listItemAmount}>₹{bill.totalAmount}</Text>
                </View>
                <Text style={styles.listItemSubtitle}>{bill.supplierName}</Text>
                <Text style={styles.listItemDate}>{bill.date}</Text>
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={64} color={Colors.textTertiary} />
              <Text style={styles.emptyStateTitle}>No Bills Yet</Text>
              <Text style={styles.emptyStateSubtitle}>
                Create your first purchase bill to get started
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {renderBillModal()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    // Android-specific: Optimize scrolling performance
    ...(isAndroid && {
      overScrollMode: 'never',
      nestedScrollEnabled: true,
    }),
  },
  header: {
    padding: 20,
    paddingTop: isAndroid ? 60 : 20, // Increased padding for Android status bar
  },
  companyName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
  },
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 24,
    gap: 12,
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 12,
    padding: 16,
    gap: 8,
    // Android-specific: Add elevation and ensure minimum touch target
    ...(isAndroid && {
      elevation: ANDROID_CONSTANTS.elevation.medium,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      minHeight: ANDROID_CONSTANTS.touchTargetMinSize,
    }),
  },
  primaryButtonText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  listContainer: {
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 16,
  },
  listItem: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    // Android-specific: Add elevation for Material Design
    ...(isAndroid && {
      elevation: ANDROID_CONSTANTS.elevation.low,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.22,
      shadowRadius: 2.22,
    }),
  },
  listItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  listItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  listItemAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.error,
  },
  listItemSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  listItemDate: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text,
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  formSection: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  balanceDisplay: {
    alignItems: 'flex-end',
  },
  balanceLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  balanceAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  billNumberDisplay: {
    marginBottom: 16,
  },
  generatedBillNo: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.primary,
    marginTop: 4,
  },
  supplierInputContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  supplierSuggestions: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    zIndex: 1000,
    maxHeight: 150,
    // Android-specific: Enhanced elevation for dropdown
    ...(isAndroid && {
      elevation: ANDROID_CONSTANTS.elevation.high,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 6,
    }),
  },
  suggestionsScrollView: {
    maxHeight: 150,
  },
  suggestionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    // Android-specific: Ensure minimum touch target
    minHeight: ANDROID_CONSTANTS.touchTargetMinSize,
  },
  suggestionName: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
    flex: 1,
  },
  suggestionAmount: {
    fontSize: 14,
    fontWeight: '600',
  },
  addItemsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
    // Android-specific: Add elevation and ensure minimum touch target
    ...(isAndroid && {
      elevation: ANDROID_CONSTANTS.elevation.medium,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      minHeight: ANDROID_CONSTANTS.touchTargetMinSize,
    }),
  },
  addItemsButtonText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '500',
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    color: Colors.text,
    fontSize: 16,
    // Android-specific: Optimize text input
    ...(isAndroid && {
      textAlignVertical: 'center',
      includeFontPadding: false,
      elevation: ANDROID_CONSTANTS.elevation.low,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.22,
      shadowRadius: 2.22,
    }),
  },
  fieldLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 4,
    fontWeight: '500',
  },
  billItemContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  billItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemNameContainer: {
    flex: 1,
    marginRight: 8,
  },
  removeButton: {
    padding: 4,
    // Android-specific: Ensure minimum touch target
    minWidth: ANDROID_CONSTANTS.touchTargetMinSize,
    minHeight: ANDROID_CONSTANTS.touchTargetMinSize,
    justifyContent: 'center',
    alignItems: 'center',
  },
  billItemDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quantityContainer: {
    flex: 1,
    marginRight: 8,
  },
  priceContainer: {
    flex: 1,
    marginRight: 8,
  },
  totalContainer: {
    flex: 1,
    alignItems: 'flex-end',
  },
  quantityInput: {
    marginBottom: 0,
  },
  priceInput: {
    marginBottom: 0,
  },
  totalText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  totalSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.error,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    // Android-specific: Ensure minimum touch target
    minHeight: ANDROID_CONSTANTS.touchTargetMinSize,
    justifyContent: 'center',
  },
  cancelButtonText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  createButton: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    // Android-specific: Add elevation and ensure minimum touch target
    minHeight: ANDROID_CONSTANTS.touchTargetMinSize,
    justifyContent: 'center',
    ...(isAndroid && {
      elevation: ANDROID_CONSTANTS.elevation.medium,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
    }),
  },
  createButtonText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
});
