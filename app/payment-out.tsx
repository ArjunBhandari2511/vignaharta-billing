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
import { pdfApi } from '../utils/apiService';
import { Party, PartyManager } from '../utils/partyManager';
import { Storage, STORAGE_KEYS } from '../utils/storage';

interface PaymentOut {
  id: string;
  paymentNo: string; // Sequential payment number
  supplierName: string;
  phoneNumber: string;
  paid: number;
  totalAmount: number;
  date: string;
  status: 'pending' | 'completed' | 'cancelled';
}

export default function PaymentOutScreen() {
  const router = useRouter();
  const [paymentsOut, setPaymentsOut] = useState<PaymentOut[]>([]);
  const [totalPayments, setTotalPayments] = useState(0);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [parties, setParties] = useState<Party[]>([]);
  const [filteredParties, setFilteredParties] = useState<Party[]>([]);
  const [showPartyDropdown, setShowPartyDropdown] = useState(false);
  
  // Payment form states
  const [paymentForm, setPaymentForm] = useState({
    supplierName: '',
    phoneNumber: '',
    paid: '',
    totalAmount: '',
  });
  
  // Selected party state
  const [selectedParty, setSelectedParty] = useState<Party | null>(null);

  useEffect(() => {
    loadPaymentData();
    loadParties();
  }, []);

  const loadPaymentData = async () => {
    try {
      const paymentsData = await Storage.getObject<PaymentOut[]>(STORAGE_KEYS.PURCHASE_PAYMENTS);
      
      if (paymentsData) {
        // Migrate existing payments that don't have payment numbers
        const migratedPayments = await migrateExistingPayments(paymentsData);
        setPaymentsOut(migratedPayments);
        const total = migratedPayments.reduce((sum, payment) => sum + (payment.paid || 0), 0);
        setTotalPayments(total);
      }
    } catch (error) {
      console.error('Error loading payment data:', error);
    }
  };

  // Migrate existing payments to include payment numbers
  const migrateExistingPayments = async (payments: PaymentOut[]): Promise<PaymentOut[]> => {
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
      await Storage.setObject(STORAGE_KEYS.PURCHASE_PAYMENTS, migratedPayments);
    } catch (error) {
      console.error('Error saving migrated payments:', error);
    }

    return migratedPayments;
  };

  const loadParties = async () => {
    try {
      const allParties = await PartyManager.getPartiesByType('supplier');
      setParties(allParties);
    } catch (error) {
      console.error('Error loading parties:', error);
    }
  };

  // Generate next sequential payment number
  const generateNextPaymentNumber = (): string => {
    // Find the highest payment number to ensure proper sequencing
    let maxNumber = 0;
    
    paymentsOut.forEach(payment => {
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

  // Handle party name input with search suggestions
  const handlePartyNameChange = (partyName: string) => {
    setPaymentForm(prev => ({ ...prev, supplierName: partyName }));
    
    if (!partyName.trim()) {
      setFilteredParties([]);
      setShowPartyDropdown(false);
      setSelectedParty(null);
      // Clear other fields when party name is cleared
      setPaymentForm(prev => ({
        ...prev,
        phoneNumber: '',
        totalAmount: '',
      }));
      return;
    }
    
    // Filter parties based on input
    const filtered = parties.filter(party =>
      party.name.toLowerCase().includes(partyName.toLowerCase())
    );
    
    setFilteredParties(filtered);
    setShowPartyDropdown(filtered.length > 0);
  };

  // Handle party selection from dropdown
  const handlePartySelect = (party: Party) => {
    setSelectedParty(party);
    setPaymentForm(prev => ({
      ...prev,
      supplierName: party.name,
      phoneNumber: party.phoneNumber,
      totalAmount: party.balance > 0 ? party.balance.toString() : '0',
    }));
    setShowPartyDropdown(false);
  };

  const handleCreatePayment = async () => {
    // Validate required fields
    const missingFields = [];
    if (!paymentForm.supplierName.trim()) missingFields.push('Supplier Name');
    if (!paymentForm.phoneNumber.trim()) missingFields.push('Phone Number');
    if (!paymentForm.paid.trim()) missingFields.push('Paid Amount');
    
    if (missingFields.length > 0) {
      Alert.alert('Error', `Please fill the following required fields:\n• ${missingFields.join('\n• ')}`);
      return;
    }
    
    // Validate numeric fields
    const paidAmount = parseFloat(paymentForm.paid);
    
    if (isNaN(paidAmount) || paidAmount <= 0) {
      Alert.alert('Error', 'Please enter a valid paid amount');
      return;
    }

    const newPayment: PaymentOut = {
      id: Date.now().toString(),
      paymentNo: generateNextPaymentNumber(),
      supplierName: paymentForm.supplierName,
      phoneNumber: paymentForm.phoneNumber,
      paid: paidAmount,
      totalAmount: selectedParty ? selectedParty.balance : 0,
      date: new Date().toLocaleDateString(),
      status: 'completed',
    };

    const updatedPayments = [...paymentsOut, newPayment];
    setPaymentsOut(updatedPayments);
    setTotalPayments(prev => prev + (newPayment.paid || 0));
    
    // Reset form
    setPaymentForm({
      supplierName: '',
      phoneNumber: '',
      paid: '',
      totalAmount: '',
    });
    setSelectedParty(null);
    setShowPaymentModal(false);
    
    // Save to storage
    try {
      await Storage.setObject(STORAGE_KEYS.PURCHASE_PAYMENTS, updatedPayments);
      
      // Trigger balance recalculation by updating a special key
      await Storage.setObject('LAST_TRANSACTION_UPDATE', Date.now().toString());
      
      Alert.alert('Success', 'Payment recorded successfully!');
    } catch (error) {
      console.error('Error saving payment:', error);
      Alert.alert('Error', 'Failed to save payment. Please try again.');
    }
  };

    const handleSharePDF = async (payment: PaymentOut) => {
    try {
      const result = await pdfApi.generatePaymentVoucher(payment);
      if (result.success) {
        Alert.alert('Success', 'Payment voucher PDF generated successfully!');
      } else {
        Alert.alert('Error', 'Failed to generate PDF');
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      Alert.alert('Error', 'Failed to generate PDF');
    }
  };

  const renderPaymentItem = ({ item }: { item: PaymentOut }) => (
    <View style={styles.paymentItem}>
      <View style={styles.paymentHeader}>
        <View style={styles.paymentLeft}>
          <View style={styles.paymentNumberContainer}>
            <Text style={styles.paymentReference}>{item.paymentNo}</Text>
            <View style={styles.paymentNumberBadge}>
              <Text style={styles.paymentNumberBadgeText}>Payment</Text>
            </View>
          </View>
          <Text style={styles.paymentSupplier}>{item.supplierName}</Text>
          <Text style={styles.paymentPhone}>{item.phoneNumber}</Text>
          <Text style={styles.paymentDate}>{item.date}</Text>
        </View>
        <View style={styles.paymentRight}>
          <Text style={[styles.paymentAmount, { color: Colors.error }]}>
            ₹{(item.paid || 0).toLocaleString()}
          </Text>
          <Text style={styles.paymentTotal}>
            Balance: ₹{(item.totalAmount || 0).toLocaleString()}
          </Text>
        </View>
      </View>
      
      {/* PDF Share Action */}
      <View style={styles.paymentActions}>
        <TouchableOpacity 
          style={styles.shareButton}
          onPress={() => handleSharePDF(item)}
        >
          <Ionicons name="share-outline" size={16} color={Colors.success} />
          <Text style={styles.shareButtonText}>Share PDF</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderPartySuggestion = ({ item }: { item: Party }) => (
    <TouchableOpacity
      style={styles.partySuggestion}
      onPress={() => handlePartySelect(item)}
    >
      <View style={styles.partySuggestionLeft}>
        <Text style={styles.partySuggestionName}>{item.name}</Text>
        <Text style={styles.partySuggestionPhone}>{item.phoneNumber}</Text>
      </View>
      <View style={styles.partySuggestionRight}>
        <Text style={[
          styles.partySuggestionBalance,
          { color: item.balance > 0 ? Colors.error : item.balance < 0 ? Colors.success : Colors.textSecondary }
        ]}>
          ₹{Math.abs(item.balance).toLocaleString()}
        </Text>
        <Text style={[
          styles.partySuggestionStatus,
          { color: item.balance > 0 ? Colors.error : item.balance < 0 ? Colors.success : Colors.textSecondary }
        ]}>
          {item.balance > 0 ? 'You Owe' : item.balance < 0 ? 'They Owe' : 'Settled'}
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
          <Text style={styles.modalTitle}>Record Payment Out</Text>
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
            
            <View style={styles.partyInputContainer}>
              <Text style={styles.fieldLabel}>Supplier Name *</Text>
              <TextInput
                style={[
                  styles.input,
                  selectedParty && styles.autoFilledInput
                ]}
                placeholder="Search supplier name..."
                placeholderTextColor={Colors.textTertiary}
                value={paymentForm.supplierName}
                onChangeText={handlePartyNameChange}
                onFocus={() => {
                  if (paymentForm.supplierName.trim()) {
                    setShowPartyDropdown(true);
                  }
                }}
              />
              
              {/* Party suggestions dropdown */}
              {showPartyDropdown && filteredParties.length > 0 && (
                <View style={styles.partySuggestions}>
                  <FlatList
                    data={filteredParties}
                    renderItem={renderPartySuggestion}
                    keyExtractor={(item) => item._id} // Changed from item.id to item._id
                    scrollEnabled={false}
                    showsVerticalScrollIndicator={false}
                  />
                </View>
              )}
              
              {/* Selected party info */}
              {selectedParty && (
                <View style={[
                  styles.selectedPartyInfo,
                  { 
                    backgroundColor: selectedParty.balance > 0 
                      ? Colors.error + '10' 
                      : selectedParty.balance < 0 
                        ? Colors.success + '10' 
                        : Colors.surfaceVariant 
                  }
                ]}>
                  <Ionicons 
                    name={selectedParty.balance > 0 ? "arrow-down-circle" : selectedParty.balance < 0 ? "arrow-up-circle" : "checkmark-circle"} 
                    size={20} 
                    color={selectedParty.balance > 0 ? Colors.error : selectedParty.balance < 0 ? Colors.success : Colors.textSecondary} 
                  />
                  <Text style={[
                    styles.selectedPartyBalance,
                    { 
                      color: selectedParty.balance > 0 
                        ? Colors.error 
                        : selectedParty.balance < 0 
                          ? Colors.success 
                          : Colors.textSecondary 
                    }
                  ]}>
                    {selectedParty.balance > 0 
                      ? `You owe ₹${selectedParty.balance.toLocaleString()}` 
                      : selectedParty.balance < 0 
                        ? `They owe ₹${Math.abs(selectedParty.balance).toLocaleString()}` 
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
                selectedParty && styles.autoFilledInput
              ]}
              placeholder="Enter phone number..."
              placeholderTextColor={Colors.textTertiary}
              value={paymentForm.phoneNumber}
              onChangeText={(text) => setPaymentForm(prev => ({ ...prev, phoneNumber: text }))}
              keyboardType="phone-pad"
              editable={!selectedParty}
            />
            {selectedParty && (
              <Text style={styles.helperText}>Auto-filled from supplier data</Text>
            )}
            
            <Text style={styles.fieldLabel}>Paid Amount *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter paid amount..."
              placeholderTextColor={Colors.textTertiary}
              value={paymentForm.paid}
              onChangeText={(text) => setPaymentForm(prev => ({ ...prev, paid: text }))}
              keyboardType="numeric"
            />
            
            {selectedParty && selectedParty.balance > 0 && (
              <View style={styles.balanceInfo}>
                <Text style={styles.balanceInfoText}>
                  Outstanding Balance: ₹{selectedParty.balance.toLocaleString()}
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
        <Text style={styles.headerTitle}>Payment Out</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header Stats */}
        <View style={styles.headerStats}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{paymentsOut.length}</Text>
            <Text style={styles.statLabel}>Total Payments</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>₹{(totalPayments || 0).toLocaleString()}</Text>
            <Text style={styles.statLabel}>Total Paid</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{parties.length}</Text>
            <Text style={styles.statLabel}>Total Parties</Text>
          </View>
        </View>

        {/* Action Button */}
        <View style={styles.actionContainer}>
          <TouchableOpacity 
            style={styles.createButton} 
            onPress={() => setShowPaymentModal(true)}
          >
            <Ionicons name="add-circle" size={24} color={Colors.text} />
            <Text style={styles.createButtonText}>Record Payment Out</Text>
          </TouchableOpacity>
        </View>

        {/* Payments List */}
        <View style={styles.listContainer}>
          <Text style={styles.sectionTitle}>Recent Payments</Text>
          {paymentsOut.length > 0 ? (
            <FlatList
              data={paymentsOut.slice(0, 20)}
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
  paymentSupplier: {
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
  // PDF Share Action
  paymentActions: {
    marginTop: 12,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.success + '10',
    borderWidth: 1,
    borderColor: Colors.success + '30',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 4,
  },
  shareButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.success,
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
  // Party suggestions styles
  partyInputContainer: {
    position: 'relative',
  },
  partySuggestions: {
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
  partySuggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  partySuggestionLeft: {
    flex: 1,
  },
  partySuggestionName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  partySuggestionPhone: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  partySuggestionRight: {
    alignItems: 'flex-end',
  },
  partySuggestionBalance: {
    fontSize: 14,
    fontWeight: '600',
  },
  partySuggestionStatus: {
    fontSize: 10,
    marginTop: 2,
  },
  // Selected party info styles
  selectedPartyInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    marginBottom: 16,
    gap: 8,
  },
  selectedPartyBalance: {
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
