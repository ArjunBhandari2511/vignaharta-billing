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
import { Party, PartyManager } from '../../utils/partyManager';
import { InvoicePdfGenerator } from '../../utils/invoicePdfGenerator';
import { Storage, STORAGE_KEYS } from '../../utils/storage';
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

interface SaleInvoice {
  id: string;
  invoiceNo: string;
  customerName: string;
  phoneNumber: string;
  items: SaleItem[];
  totalAmount: number;
  date: string;
  status: 'pending' | 'completed' | 'cancelled';
  pdfUri?: string; // Store the generated PDF URI
}

interface SaleItem {
  id: string;
  itemName: string;
  quantity: number;
  rate: number;
  total: number;
}

export default function SalesScreen() {
  const router = useRouter();
  const [saleInvoices, setSaleInvoices] = useState<SaleInvoice[]>([]);
  const [customers, setCustomers] = useState<Party[]>([]);
  
  // Modal states
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  
  // Invoice form states
  const [invoiceForm, setInvoiceForm] = useState({
    customerName: '',
    phoneNumber: '',
    items: [] as SaleItem[],
  });

  // Dropdown visibility state
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  
  // Auto-generated invoice number
  const [generatedInvoiceNo, setGeneratedInvoiceNo] = useState<string>('');
  
  // Selected customer balance state
  const [selectedCustomerBalance, setSelectedCustomerBalance] = useState<number | null>(null);

  useEffect(() => {
    loadSalesData();
    loadCustomers();
  }, []);

  // Generate invoice number when sales data changes
  useEffect(() => {
    setGeneratedInvoiceNo(generateNextInvoiceNumber());
  }, [saleInvoices]);

  // Reload customers when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadCustomers();
    }, [])
  );

  // Handle incoming selected items from add-items screen
  useFocusEffect(
    useCallback(() => {
      const handleIncomingItems = async () => {
        try {
          const tempSelectedItems = await Storage.getObject('TEMP_SELECTED_ITEMS');
          if (tempSelectedItems && Array.isArray(tempSelectedItems) && tempSelectedItems.length > 0) {
            // Add the selected items to the current invoice form
            setInvoiceForm(prev => ({
              ...prev,
              items: [...prev.items, ...tempSelectedItems]
            }));
            
            // Reopen the modal since it was closed when navigating to add-items
            setShowInvoiceModal(true);
            
            // Show success message
            Alert.alert('Items Added', `${tempSelectedItems.length} items have been added to your invoice.`);
            
            // Clear the temporary storage to prevent duplicate processing
            await Storage.removeItem('TEMP_SELECTED_ITEMS');
          }
        } catch (error) {
          console.error('Error handling incoming items:', error);
        }
      };

      handleIncomingItems();
    }, [])
  );

  const loadSalesData = async () => {
    try {
      const invoicesData = await Storage.getObject<SaleInvoice[]>(STORAGE_KEYS.SALES_INVOICES);
      
      if (invoicesData) {
        setSaleInvoices(invoicesData);
      }
    } catch (error) {
      console.error('Error loading sales data:', error);
    }
  };



  const loadCustomers = async () => {
    try {
      const customersData = await PartyManager.getPartiesByType('customer');
      setCustomers(customersData);
    } catch (error) {
      console.error('Error loading customers:', error);
    }
  };

  // Generate next invoice number
  const generateNextInvoiceNumber = () => {
    if (saleInvoices.length === 0) {
      return '1';
    }
    
    // Find the highest invoice number
    const invoiceNumbers = saleInvoices
      .map(invoice => {
        const num = parseInt(invoice.invoiceNo);
        return isNaN(num) ? 0 : num;
      })
      .sort((a, b) => b - a);
    
    const nextNumber = (invoiceNumbers[0] || 0) + 1;
    return nextNumber.toString();
  };

  // Reset form function
  const resetForm = () => {
    setInvoiceForm({
      customerName: '',
      phoneNumber: '',
      items: [],
    });
    setShowCustomerDropdown(false);
    setSelectedCustomerBalance(null);
    setShowInvoiceModal(false);
  };



  const updateInvoiceItem = (index: number, field: keyof SaleItem, value: any) => {
    const updatedItems = [...invoiceForm.items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    
    // Calculate total for this item
    if (field === 'quantity' || field === 'rate') {
      updatedItems[index].total = updatedItems[index].quantity * updatedItems[index].rate;
    }
    
    setInvoiceForm(prev => ({
      ...prev,
      items: updatedItems,
    }));
  };

  const removeInvoiceItem = (index: number) => {
    setInvoiceForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const calculateInvoiceTotal = () => {
    return invoiceForm.items.reduce((sum, item) => sum + item.total, 0);
  };

  const handleCreateInvoice = async () => {
    if (!invoiceForm.customerName || !invoiceForm.phoneNumber) {
      Alert.alert('Error', 'Please fill all required fields');
      return;
    }

    if (invoiceForm.items.length === 0) {
      Alert.alert('Error', 'Please add at least one item');
      return;
    }

    // Check if this is an existing customer and get their balance
    const existingCustomer = customers.find(customer => 
      customer.name.toLowerCase() === invoiceForm.customerName.toLowerCase() &&
      customer.phoneNumber === invoiceForm.phoneNumber
    );

    if (existingCustomer && existingCustomer.balance > 0) {
      Alert.alert(
        'Customer Has Outstanding Balance',
        `${invoiceForm.customerName} has an outstanding balance of ₹${existingCustomer.balance.toLocaleString()}. Do you want to proceed with creating this invoice?`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Proceed',
            onPress: () => createInvoice(),
          },
        ]
      );
      return;
    }

    // If no outstanding balance or new customer, proceed directly
    createInvoice();
  };

  const createInvoice = async () => {
    const newInvoice: SaleInvoice = {
      id: Date.now().toString(),
      invoiceNo: generatedInvoiceNo,
      customerName: invoiceForm.customerName,
      phoneNumber: invoiceForm.phoneNumber,
      items: invoiceForm.items,
      totalAmount: calculateInvoiceTotal(),
      date: new Date().toLocaleDateString(),
      status: 'pending',
    };

    // Generate PDF in the background
    let pdfUri: string | undefined;
    try {
      const generatedPdfUri = await InvoicePdfGenerator.generateInvoicePDF(newInvoice);
      if (generatedPdfUri) {
        pdfUri = generatedPdfUri;
        newInvoice.pdfUri = pdfUri;
        
        // Add a small delay to ensure file is fully written
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        console.error('PDF generation returned null');
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      // Continue with invoice creation even if PDF generation fails
    }

    const updatedInvoices = [...saleInvoices, newInvoice];
    setSaleInvoices(updatedInvoices);
    
    // Reset form
    resetForm();
    
    // Save to storage with updated data
    try {
      await Storage.setObject(STORAGE_KEYS.SALES_INVOICES, updatedInvoices);
      
      // Trigger balance recalculation
      await Storage.setObject('LAST_TRANSACTION_UPDATE', Date.now().toString());
      
      // Send invoice via WhatsApp
      await sendInvoiceViaWhatsApp(newInvoice, pdfUri);
      
      Alert.alert('Success', 'Invoice created and sent successfully!');
    } catch (error) {
      console.error('Error saving invoice:', error);
      Alert.alert('Error', 'Failed to save invoice. Please try again.');
    }
  };

  const sendInvoiceViaWhatsApp = async (invoice: SaleInvoice, pdfUri?: string) => {
    try {
      // Validate phone number
      if (!WASenderAPI.validatePhoneNumber(invoice.phoneNumber)) {
        console.warn('Invalid phone number format:', invoice.phoneNumber);
        return;
      }

      const formattedPhone = WASenderAPI.formatPhoneNumber(invoice.phoneNumber);
      
      let documentUrl: string | undefined;
      
      // Upload PDF to Cloudinary if available
      if (pdfUri) {
        const uploadResult = await CloudinaryUploader.uploadInvoicePdf(pdfUri, invoice.invoiceNo);
        
        if (uploadResult.success && uploadResult.url) {
          documentUrl = uploadResult.url;
        } else {
          console.error('Failed to upload PDF:', uploadResult.error);
        }
      }
      
      // Send invoice via WhatsApp (with document if available)
      const response = await WASenderAPI.sendInvoice(
        formattedPhone,
        invoice.customerName,
        invoice.invoiceNo,
        invoice.totalAmount,
        invoice.date,
        documentUrl // Pass the Cloudinary URL if available
      );
      
      if (!response.success) {
        console.error('Failed to send WhatsApp invoice:', response.error);
      }
    } catch (error) {
      console.error('Error sending invoice via WhatsApp:', error);
    }
  };

  const renderInvoiceItem = ({ item, index }: { item: SaleItem; index: number }) => {
    return (
      <View style={styles.invoiceItemContainer}>
        <View style={styles.invoiceItemRow}>
          <View style={styles.itemNameContainer}>
            <Text style={styles.fieldLabel}>Item Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter item name..."
              placeholderTextColor={Colors.textTertiary}
              value={item.itemName}
              onChangeText={(text) => updateInvoiceItem(index, 'itemName', text)}
            />
          </View>
          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => removeInvoiceItem(index)}
            activeOpacity={isAndroid ? 0.7 : 0.2}
            {...(isAndroid && {
              android_ripple: { color: ANDROID_CONSTANTS.rippleColor },
            })}
          >
            <Ionicons name="close-circle" size={20} color={Colors.error} />
          </TouchableOpacity>
        </View>
        
        <View style={styles.invoiceItemDetails}>
          <View style={styles.quantityContainer}>
            <Text style={styles.fieldLabel}>Quantity</Text>
            <TextInput
              style={[styles.input, styles.quantityInput]}
              placeholder="Qty"
              placeholderTextColor={Colors.textTertiary}
              value={item.quantity.toString()}
              onChangeText={(text) => {
                const qty = parseInt(text) || 0;
                updateInvoiceItem(index, 'quantity', qty);
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
              onChangeText={(text) => updateInvoiceItem(index, 'rate', parseFloat(text) || 0)}
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

  const renderInvoiceModal = () => (
    <Modal
      visible={showInvoiceModal}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <KeyboardAvoidingView 
        style={styles.modalContainer} 
        behavior="padding"
        keyboardVerticalOffset={100}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={resetForm}
        >
          <TouchableOpacity 
            style={styles.modalContentContainer}
            activeOpacity={1}
            onPress={() => {}} // Prevent closing when tapping inside
          >
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Create Sale Invoice</Text>
                  <TouchableOpacity 
          onPress={resetForm}
          activeOpacity={isAndroid ? 0.7 : 0.2}
          {...(isAndroid && {
            android_ripple: { color: ANDROID_CONSTANTS.rippleColor },
          })}
        >
          <Ionicons name="close" size={24} color={Colors.text} />
        </TouchableOpacity>
        </View>
        
        <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled">
          <View style={styles.formSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Invoice Details</Text>
              {selectedCustomerBalance !== null && (
                <View style={styles.balanceDisplay}>
                  <Text style={styles.balanceLabel}>Balance Amount:</Text>
                  <Text style={[
                    styles.balanceAmount,
                    { color: selectedCustomerBalance <= 0 ? Colors.success : Colors.error }
                  ]}>
                    ₹{selectedCustomerBalance.toLocaleString()}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.invoiceNumberDisplay}>
              <Text style={styles.fieldLabel}>Invoice Number</Text>
              <Text style={styles.generatedInvoiceNo}>#{generatedInvoiceNo}</Text>
            </View>
            <View style={styles.customerInputContainer}>
              <Text style={styles.fieldLabel}>Customer Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter customer name..."
                placeholderTextColor={Colors.textTertiary}
                value={invoiceForm.customerName}
                onChangeText={(text) => {
                  setInvoiceForm(prev => ({ ...prev, customerName: text }));
                  setShowCustomerDropdown(true);
                }}
                onFocus={() => setShowCustomerDropdown(true)}
              />
              {showCustomerDropdown && invoiceForm.customerName.length > 0 && (() => {
                const matchingCustomers = customers.filter(customer => 
                  customer.name.toLowerCase().includes(invoiceForm.customerName.toLowerCase())
                );
                
                if (matchingCustomers.length === 0) {
                  return null; // Don't show dropdown if no matches
                }
                
                return (
                  <View style={styles.customerSuggestions}>
                    {matchingCustomers.length > 3 ? (
                      <ScrollView 
                        style={styles.suggestionsScrollView}
                        showsVerticalScrollIndicator={true}
                        nestedScrollEnabled={true}
                      >
                        {matchingCustomers.map((customer) => (
                      <TouchableOpacity
                        key={customer.id}
                        style={styles.suggestionItem}
                        onPress={() => {
                          setInvoiceForm(prev => ({
                            ...prev,
                            customerName: customer.name,
                            phoneNumber: customer.phoneNumber,
                          }));
                          setSelectedCustomerBalance(customer.balance);
                          setShowCustomerDropdown(false);
                        }}
                        activeOpacity={isAndroid ? 0.7 : 0.2}
                        {...(isAndroid && {
                          android_ripple: { color: ANDROID_CONSTANTS.rippleColor },
                        })}
                      >
                        <Text style={styles.suggestionName}>{customer.name}</Text>
                        <Text style={[
                          styles.suggestionAmount,
                          { color: customer.balance <= 0 ? Colors.success : Colors.error }
                        ]}>
                          ₹{customer.balance.toLocaleString()}
                        </Text>
                      </TouchableOpacity>
                    ))}
                      </ScrollView>
                    ) : (
                      // Show first 3 customers without scroll when 3 or fewer
                      matchingCustomers.slice(0, 3).map((customer) => (
                        <TouchableOpacity
                          key={customer.id}
                          style={styles.suggestionItem}
                          onPress={() => {
                            setInvoiceForm(prev => ({
                              ...prev,
                              customerName: customer.name,
                              phoneNumber: customer.phoneNumber,
                            }));
                            setSelectedCustomerBalance(customer.balance);
                            setShowCustomerDropdown(false);
                          }}
                          activeOpacity={isAndroid ? 0.7 : 0.2}
                          {...(isAndroid && {
                            android_ripple: { color: ANDROID_CONSTANTS.rippleColor },
                          })}
                        >
                          <Text style={styles.suggestionName}>{customer.name}</Text>
                          <Text style={[
                            styles.suggestionAmount,
                            { color: customer.balance <= 0 ? Colors.success : Colors.error }
                          ]}>
                            ₹{customer.balance.toLocaleString()}
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
              value={invoiceForm.phoneNumber}
              onChangeText={(text) => setInvoiceForm(prev => ({ ...prev, phoneNumber: text }))}
              keyboardType="phone-pad"
            />
            

          </View>
          
          <View style={styles.formSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Items</Text>
              <TouchableOpacity 
                style={styles.addItemsButton} 
                onPress={() => {
                  setShowInvoiceModal(false);
                  // Set mode for sales items
                  Storage.setObject('ITEM_SELECTION_MODE', 'sales');
                  // Small delay to ensure modal closes before navigation
                  setTimeout(() => {
                    router.push('/add-items');
                  }, 100);
                }}
                activeOpacity={isAndroid ? 0.7 : 0.2}
                {...(isAndroid && {
                  android_ripple: { color: ANDROID_CONSTANTS.rippleColor },
                })}
              >
                <Ionicons name="add" size={20} color={Colors.text} />
                <Text style={styles.addItemsButtonText}>Add Items</Text>
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={invoiceForm.items}
              renderItem={renderInvoiceItem}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
            />
            
            {invoiceForm.items.length > 0 && (
              <View style={styles.totalSection}>
                <Text style={styles.totalLabel}>Total Amount:</Text>
                <Text style={styles.totalAmount}>₹{calculateInvoiceTotal()}</Text>
              </View>
            )}
          </View>
        </ScrollView>
        
        <View style={styles.modalFooter}>
          <TouchableOpacity 
            style={styles.cancelButton} 
            onPress={resetForm}
            activeOpacity={isAndroid ? 0.7 : 0.2}
            {...(isAndroid && {
              android_ripple: { color: ANDROID_CONSTANTS.rippleColor },
            })}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.createButton} 
            onPress={handleCreateInvoice}
            activeOpacity={isAndroid ? 0.7 : 0.2}
            {...(isAndroid && {
              android_ripple: { color: ANDROID_CONSTANTS.rippleColor },
            })}
          >
            <Text style={styles.createButtonText}>Create Invoice</Text>
          </TouchableOpacity>
        </View>
          </TouchableOpacity>
        </TouchableOpacity>
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
          <Text style={styles.companyName}>Sales</Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
                  <TouchableOpacity 
          style={styles.primaryButton} 
          onPress={() => setShowInvoiceModal(true)}
          activeOpacity={isAndroid ? 0.7 : 0.2}
          {...(isAndroid && {
            android_ripple: { color: ANDROID_CONSTANTS.rippleColor },
          })}
        >
          <Ionicons name="add" size={20} color={Colors.text} />
          <Text style={styles.primaryButtonText}>New Invoice</Text>
        </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.primaryButton, { backgroundColor: Colors.success }]} 
            onPress={() => router.push('/payment-in')}
            activeOpacity={isAndroid ? 0.7 : 0.2}
            {...(isAndroid && {
              android_ripple: { color: ANDROID_CONSTANTS.rippleColor },
            })}
          >
            <Ionicons name="arrow-down-circle" size={20} color={Colors.text} />
            <Text style={styles.primaryButtonText}>Payment In</Text>
          </TouchableOpacity>
        </View>

        {/* Invoices List */}
          <View style={styles.listContainer}>
            <Text style={styles.sectionTitle}>Recent Invoices</Text>
            {saleInvoices.length > 0 ? (
              saleInvoices.slice(0, 10).map((invoice) => (
                <TouchableOpacity 
                  key={invoice.id} 
                  style={styles.listItem}
                  onPress={() => router.push(`/edit-invoice?invoiceId=${invoice.id}`)}
                  activeOpacity={isAndroid ? 0.7 : 0.2}
                  {...(isAndroid && {
                    android_ripple: { color: ANDROID_CONSTANTS.rippleColor },
                  })}
                >
                  <View style={styles.listItemHeader}>
                    <Text style={styles.listItemTitle}>#{invoice.invoiceNo}</Text>
                    <Text style={styles.listItemAmount}>₹{invoice.totalAmount}</Text>
                  </View>
                  <Text style={styles.listItemSubtitle}>{invoice.customerName}</Text>
                  <Text style={styles.listItemDate}>{invoice.date}</Text>
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="receipt-outline" size={64} color={Colors.textTertiary} />
                <Text style={styles.emptyStateTitle}>No Invoices Yet</Text>
                <Text style={styles.emptyStateSubtitle}>
                  Create your first sale invoice to get started
                </Text>
              </View>
            )}
          </View>
      </ScrollView>

      {renderInvoiceModal()}
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
  headerStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 20,
    gap: 12,
  },
  statCard: {
    width: '48%',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: Colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  activeTabText: {
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
    color: Colors.success,
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
  invoiceItemContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  invoiceItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },

  removeButton: {
    padding: 4,
    // Android-specific: Ensure minimum touch target
    minWidth: ANDROID_CONSTANTS.touchTargetMinSize,
    minHeight: ANDROID_CONSTANTS.touchTargetMinSize,
    justifyContent: 'center',
    alignItems: 'center',
  },
  invoiceItemDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quantityInput: {
    flex: 1,
    marginBottom: 0,
  },
  unitInput: {
    flex: 1,
    marginBottom: 0,
  },
  rateInput: {
    flex: 1,
    marginBottom: 0,
  },
  totalContainer: {
    flex: 1,
    alignItems: 'flex-end',
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
    color: Colors.success,
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


  // New styles for refined item layout
  quantityContainer: {
    flex: 1,
    marginRight: 8,
  },
  priceContainer: {
    flex: 1,
    marginRight: 8,
  },
  fieldLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 4,
    fontWeight: '500',
  },
  stockInfo: {
    fontSize: 10,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  priceInput: {
    marginBottom: 0,
  },
  itemNameContainer: {
    flex: 1,
    marginRight: 8,
  },

  // Customer suggestions styles
  customerInputContainer: {
    position: 'relative',
  },
  customerSuggestions: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    zIndex: 1000,
    maxHeight: 250,
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
    maxHeight: 144, // Height for exactly 3 items (48px each)
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  // Invoice number display styles
  invoiceNumberDisplay: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  generatedInvoiceNo: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.primary,
    marginTop: 4,
  },
  // Balance display styles
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
  // Modal overlay styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContentContainer: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    flex: 1,
    // Android-specific: Add elevation for modal
    ...(isAndroid && {
      elevation: ANDROID_CONSTANTS.elevation.high,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
    }),
  },
});
