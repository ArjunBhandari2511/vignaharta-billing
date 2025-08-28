import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors } from '../constants/Colors';
import { Customer, CustomerManager } from '../utils/customerManager';
import { Storage, STORAGE_KEYS } from '../utils/storage';

interface PaymentIn {
  id: string;
  paymentNo: string; // Sequential payment number
  customerName: string;
  phoneNumber: string;
  received: number;
  totalAmount: number;
  date: string;
  status: 'pending' | 'completed' | 'cancelled';
}

export default function PaymentInScreen() {
  const router = useRouter();
  const [paymentsIn, setPaymentsIn] = useState<PaymentIn[]>([]);
  const [totalPayments, setTotalPayments] = useState(0);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  
  // Payment form states
  const [paymentForm, setPaymentForm] = useState({
    customerName: '',
    phoneNumber: '',
    received: '',
    totalAmount: '',
  });
  
  // Selected customer state
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  useEffect(() => {
    loadPaymentData();
    loadCustomers();
  }, []);

  const loadPaymentData = async () => {
    try {
      const paymentsData = await Storage.getObject<PaymentIn[]>(STORAGE_KEYS.SALES_PAYMENTS);
      
      if (paymentsData) {
        // Migrate existing payments that don't have payment numbers
        const migratedPayments = await migrateExistingPayments(paymentsData);
        setPaymentsIn(migratedPayments);
        const total = migratedPayments.reduce((sum, payment) => sum + (payment.received || 0), 0);
        setTotalPayments(total);
      }
    } catch (error) {
      console.error('Error loading payment data:', error);
    }
  };

  // Migrate existing payments to include payment numbers
  const migrateExistingPayments = async (payments: PaymentIn[]): Promise<PaymentIn[]> => {
    const needsMigration = payments.some(payment => !payment.paymentNo);
    
    if (!needsMigration) {
      return payments;
    }

    // Add payment numbers to payments that don't have them
    const migratedPayments = payments.map((payment, index) => {
      if (!payment.paymentNo) {
        return {
          ...payment,
          paymentNo: `PAY-${index + 1}`
        };
      }
      return payment;
    });

    // Save migrated data
    try {
      await Storage.setObject(STORAGE_KEYS.SALES_PAYMENTS, migratedPayments);
    } catch (error) {
      console.error('Error saving migrated payments:', error);
    }

    return migratedPayments;
  };

  const loadCustomers = async () => {
    try {
      const allCustomers = await CustomerManager.getAllCustomers();
      setCustomers(allCustomers);
    } catch (error) {
      console.error('Error loading customers:', error);
    }
  };

  // Generate next sequential payment number
  const generateNextPaymentNumber = (): string => {
    // Find the highest payment number to ensure proper sequencing
    let maxNumber = 0;
    
    paymentsIn.forEach(payment => {
      if (payment.paymentNo) {
        const match = payment.paymentNo.match(/PAY-(\d+)/);
        if (match) {
          const number = parseInt(match[1], 10);
          if (number > maxNumber) {
            maxNumber = number;
          }
        }
      }
    });
    
    const nextNumber = maxNumber + 1;
    return `PAY-${nextNumber}`;
  };

  // Handle customer name input with search suggestions
  const handleCustomerNameChange = (customerName: string) => {
    setPaymentForm(prev => ({ ...prev, customerName }));
    
    if (!customerName.trim()) {
      setFilteredCustomers([]);
      setShowCustomerDropdown(false);
      setSelectedCustomer(null);
      // Clear other fields when customer name is cleared
      setPaymentForm(prev => ({
        ...prev,
        phoneNumber: '',
        totalAmount: '',
      }));
      return;
    }
    
    // Filter customers based on input
    const filtered = customers.filter(customer =>
      customer.name.toLowerCase().includes(customerName.toLowerCase())
    );
    
    setFilteredCustomers(filtered);
    setShowCustomerDropdown(filtered.length > 0);
  };

  // Handle customer selection from dropdown
  const handleCustomerSelect = (customer: Customer) => {
    setSelectedCustomer(customer);
    setPaymentForm(prev => ({
      ...prev,
      customerName: customer.name,
      phoneNumber: customer.phoneNumber,
      totalAmount: customer.balance > 0 ? customer.balance.toString() : '0',
    }));
    setShowCustomerDropdown(false);
  };

  const handleCreatePayment = async () => {
    // Validate required fields
    const missingFields = [];
    if (!paymentForm.customerName.trim()) missingFields.push('Customer Name');
    if (!paymentForm.phoneNumber.trim()) missingFields.push('Phone Number');
    if (!paymentForm.received.trim()) missingFields.push('Received Amount');
    
    if (missingFields.length > 0) {
      Alert.alert('Error', `Please fill the following required fields:\n• ${missingFields.join('\n• ')}`);
      return;
    }
    
    // Validate numeric fields
    const receivedAmount = parseFloat(paymentForm.received);
    
    if (isNaN(receivedAmount) || receivedAmount <= 0) {
      Alert.alert('Error', 'Please enter a valid received amount');
      return;
    }

    const newPayment: PaymentIn = {
      id: Date.now().toString(),
      paymentNo: generateNextPaymentNumber(),
      customerName: paymentForm.customerName,
      phoneNumber: paymentForm.phoneNumber,
      received: receivedAmount,
      totalAmount: selectedCustomer ? selectedCustomer.balance : 0,
      date: new Date().toLocaleDateString(),
      status: 'completed',
    };

    const updatedPayments = [...paymentsIn, newPayment];
    setPaymentsIn(updatedPayments);
    setTotalPayments(prev => prev + (newPayment.received || 0));
    
    // Reset form
    setPaymentForm({
      customerName: '',
      phoneNumber: '',
      received: '',
      totalAmount: '',
    });
    setSelectedCustomer(null);
    setShowPaymentModal(false);
    
    // Save to storage
    try {
      await Storage.setObject(STORAGE_KEYS.SALES_PAYMENTS, updatedPayments);
      
      // Trigger balance recalculation by updating a special key
      await Storage.setObject('LAST_TRANSACTION_UPDATE', Date.now().toString());
      
      Alert.alert('Success', 'Payment recorded successfully!');
    } catch (error) {
      console.error('Error saving payment:', error);
      Alert.alert('Error', 'Failed to save payment. Please try again.');
    }
  };

  const renderPaymentItem = ({ item }: { item: PaymentIn }) => (
    <View style={styles.paymentItem}>
      <View style={styles.paymentHeader}>
        <View style={styles.paymentLeft}>
          <View style={styles.paymentNumberContainer}>
            <Text style={styles.paymentReference}>{item.paymentNo}</Text>
            <View style={styles.paymentNumberBadge}>
              <Text style={styles.paymentNumberBadgeText}>Payment</Text>
            </View>
          </View>
          <Text style={styles.paymentCustomer}>{item.customerName}</Text>
          <Text style={styles.paymentPhone}>{item.phoneNumber}</Text>
          <Text style={styles.paymentDate}>{item.date}</Text>
        </View>
        <View style={styles.paymentRight}>
          <Text style={[styles.paymentAmount, { color: Colors.success }]}>
            ₹{(item.received || 0).toLocaleString()}
          </Text>
          <Text style={styles.paymentTotal}>
            Balance: ₹{(item.totalAmount || 0).toLocaleString()}
          </Text>
        </View>
      </View>
    </View>
  );

  const renderCustomerSuggestion = ({ item }: { item: Customer }) => (
    <TouchableOpacity
      style={styles.customerSuggestion}
      onPress={() => handleCustomerSelect(item)}
    >
      <View style={styles.customerSuggestionLeft}>
        <Text style={styles.customerSuggestionName}>{item.name}</Text>
        <Text style={styles.customerSuggestionPhone}>{item.phoneNumber}</Text>
      </View>
      <View style={styles.customerSuggestionRight}>
        <Text style={[
          styles.customerSuggestionBalance,
          { color: item.balance > 0 ? Colors.success : item.balance < 0 ? Colors.error : Colors.textSecondary }
        ]}>
          ₹{Math.abs(item.balance).toLocaleString()}
        </Text>
        <Text style={[
          styles.customerSuggestionStatus,
          { color: item.balance > 0 ? Colors.success : item.balance < 0 ? Colors.error : Colors.textSecondary }
        ]}>
          {item.balance > 0 ? 'They Owe' : item.balance < 0 ? 'You Owe' : 'Settled'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderPaymentModal = () => (
    <Modal
      visible={showPaymentModal}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <KeyboardAvoidingView 
        style={styles.modalContainer} 
        behavior="padding"
        keyboardVerticalOffset={100}
      >
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Record Payment In</Text>
          <TouchableOpacity onPress={() => setShowPaymentModal(false)}>
            <Ionicons name="close" size={24} color={Colors.text} />
          </TouchableOpacity>
        </View>
        
        <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled">
          <View style={styles.formSection}>
            <Text style={styles.modalSectionTitle}>Payment Details</Text>
            
            {/* Payment Number Preview */}
            <View style={styles.paymentNumberPreview}>
              <Text style={styles.paymentNumberLabel}>Payment Number:</Text>
              <Text style={styles.paymentNumberValue}>{generateNextPaymentNumber()}</Text>
            </View>
            
            <View style={styles.customerInputContainer}>
              <Text style={styles.fieldLabel}>Customer Name *</Text>
              <TextInput
                style={[
                  styles.input,
                  selectedCustomer && styles.autoFilledInput
                ]}
                placeholder="Search customer name..."
                placeholderTextColor={Colors.textTertiary}
                value={paymentForm.customerName}
                onChangeText={handleCustomerNameChange}
                onFocus={() => {
                  if (paymentForm.customerName.trim()) {
                    setShowCustomerDropdown(true);
                  }
                }}
              />
              
              {/* Customer suggestions dropdown */}
              {showCustomerDropdown && filteredCustomers.length > 0 && (
                <View style={styles.customerSuggestions}>
                  <FlatList
                    data={filteredCustomers}
                    renderItem={renderCustomerSuggestion}
                    keyExtractor={(item) => item.id}
                    scrollEnabled={false}
                    showsVerticalScrollIndicator={false}
                  />
                </View>
              )}
              
              {/* Selected customer info */}
              {selectedCustomer && (
                <View style={[
                  styles.selectedCustomerInfo,
                  { 
                    backgroundColor: selectedCustomer.balance > 0 
                      ? Colors.success + '10' 
                      : selectedCustomer.balance < 0 
                        ? Colors.error + '10' 
                        : Colors.surfaceVariant 
                  }
                ]}>
                  <Ionicons 
                    name={selectedCustomer.balance > 0 ? "arrow-up-circle" : selectedCustomer.balance < 0 ? "arrow-down-circle" : "checkmark-circle"} 
                    size={20} 
                    color={selectedCustomer.balance > 0 ? Colors.success : selectedCustomer.balance < 0 ? Colors.error : Colors.textSecondary} 
                  />
                  <Text style={[
                    styles.selectedCustomerBalance,
                    { 
                      color: selectedCustomer.balance > 0 
                        ? Colors.success 
                        : selectedCustomer.balance < 0 
                          ? Colors.error 
                          : Colors.textSecondary 
                    }
                  ]}>
                    {selectedCustomer.balance > 0 
                      ? `They owe ₹${selectedCustomer.balance.toLocaleString()}` 
                      : selectedCustomer.balance < 0 
                        ? `You owe ₹${Math.abs(selectedCustomer.balance).toLocaleString()}` 
                        : 'All settled up'
                    }
                  </Text>
                </View>
              )}
            </View>
            
            <Text style={styles.fieldLabel}>Phone Number *</Text>
            <TextInput
              style={[
                styles.input,
                selectedCustomer && styles.autoFilledInput
              ]}
              placeholder="Enter phone number..."
              placeholderTextColor={Colors.textTertiary}
              value={paymentForm.phoneNumber}
              onChangeText={(text) => setPaymentForm(prev => ({ ...prev, phoneNumber: text }))}
              keyboardType="phone-pad"
              editable={!selectedCustomer}
            />
            {selectedCustomer && (
              <Text style={styles.helperText}>Auto-filled from customer data</Text>
            )}
            
            <Text style={styles.fieldLabel}>Received Amount *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter received amount..."
              placeholderTextColor={Colors.textTertiary}
              value={paymentForm.received}
              onChangeText={(text) => setPaymentForm(prev => ({ ...prev, received: text }))}
              keyboardType="numeric"
            />
            
            {selectedCustomer && selectedCustomer.balance > 0 && (
              <View style={styles.balanceInfo}>
                <Text style={styles.balanceInfoText}>
                  Outstanding Balance: ₹{selectedCustomer.balance.toLocaleString()}
                </Text>
                <Text style={styles.balanceInfoSubtext}>
                  This payment will reduce the outstanding amount
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
        
        <View style={styles.modalFooter}>
          <TouchableOpacity style={styles.cancelButton} onPress={() => setShowPaymentModal(false)}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.createButton} onPress={handleCreatePayment}>
            <Text style={styles.createButtonText}>Record Payment</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payment In</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header Stats */}
        <View style={styles.headerStats}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{paymentsIn.length}</Text>
            <Text style={styles.statLabel}>Total Payments</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>₹{(totalPayments || 0).toLocaleString()}</Text>
            <Text style={styles.statLabel}>Total Received</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{customers.length}</Text>
            <Text style={styles.statLabel}>Total Customers</Text>
          </View>
        </View>

        {/* Action Button */}
        <View style={styles.actionContainer}>
          <TouchableOpacity 
            style={styles.createButton} 
            onPress={() => setShowPaymentModal(true)}
          >
            <Ionicons name="add-circle" size={24} color={Colors.text} />
            <Text style={styles.createButtonText}>Record Payment In</Text>
          </TouchableOpacity>
        </View>

        {/* Payments List */}
        <View style={styles.listContainer}>
          <Text style={styles.sectionTitle}>Recent Payments</Text>
          {paymentsIn.length > 0 ? (
            <FlatList
              data={paymentsIn.slice(0, 20)}
              renderItem={renderPaymentItem}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
            />
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="card-outline" size={64} color={Colors.textTertiary} />
              <Text style={styles.emptyStateTitle}>No Payments Yet</Text>
              <Text style={styles.emptyStateSubtitle}>Record your first payment to get started</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {renderPaymentModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  headerStats: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  actionContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  createButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  createButtonText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  listContainer: {
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 16,
  },
  paymentItem: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  paymentLeft: {
    flex: 1,
  },
  paymentReference: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  paymentNumberContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  paymentNumberBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  paymentNumberBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.text,
    textTransform: 'uppercase',
  },
  paymentCustomer: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 2,
  },
  paymentPhone: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  paymentDate: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
  paymentRight: {
    alignItems: 'flex-end',
  },
  paymentAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  paymentTotal: {
    fontSize: 12,
    color: Colors.textSecondary,
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
  formSection: {
    marginBottom: 20,
  },
  modalSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 16,
  },
  // Payment number preview styles
  paymentNumberPreview: {
    backgroundColor: Colors.surfaceVariant,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentNumberLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  paymentNumberValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: Colors.text,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  autoFilledInput: {
    backgroundColor: Colors.success + '10',
    borderColor: Colors.success + '30',
  },
  helperText: {
    fontSize: 11,
    color: Colors.success,
    marginTop: -12,
    marginBottom: 16,
    marginLeft: 4,
    fontStyle: 'italic',
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.textSecondary,
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
    maxHeight: 200,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  customerSuggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  customerSuggestionLeft: {
    flex: 1,
  },
  customerSuggestionName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  customerSuggestionPhone: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  customerSuggestionRight: {
    alignItems: 'flex-end',
  },
  customerSuggestionBalance: {
    fontSize: 14,
    fontWeight: '600',
  },
  customerSuggestionStatus: {
    fontSize: 10,
    marginTop: 2,
  },
  // Selected customer info styles
  selectedCustomerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    marginBottom: 16,
    gap: 8,
  },
  selectedCustomerBalance: {
    fontSize: 12,
    fontWeight: '500',
  },
  // Balance info styles
  balanceInfo: {
    backgroundColor: Colors.surfaceVariant,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  balanceInfoText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  balanceInfoSubtext: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
});
