import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { Colors } from '../constants/Colors';
import { Storage, STORAGE_KEYS } from '../utils/storage';

interface PaymentOut {
  id: string;
  paymentNo: string;
  supplierName: string;
  phoneNumber: string;
  paid: number;
  totalAmount: number;
  date: string;
  status: 'pending' | 'completed' | 'cancelled';
}

export default function EditPayoutScreen() {
  const router = useRouter();
  const { paymentId } = useLocalSearchParams<{ paymentId: string }>();
  
  const [payment, setPayment] = useState<PaymentOut | null>(null);
  const [formData, setFormData] = useState({
    paymentNo: '',
    supplierName: '',
    phoneNumber: '',
    paid: '',
    date: '',
  });
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    if (paymentId) {
      loadPayment();
    }
  }, [paymentId]);

  const loadPayment = async () => {
    try {
      const payments = await Storage.getObject<PaymentOut[]>(STORAGE_KEYS.PURCHASE_PAYMENTS);
      const foundPayment = payments?.find(p => p.id === paymentId);
      
      if (foundPayment) {
        setPayment(foundPayment);
        setFormData({
          paymentNo: foundPayment.paymentNo || '',
          supplierName: foundPayment.supplierName || '',
          phoneNumber: foundPayment.phoneNumber || '',
          paid: foundPayment.paid?.toString() || '',
          date: foundPayment.date || '',
        });
      } else {
        Alert.alert('Error', 'Payment not found');
        router.back();
      }
    } catch (error) {
      console.error('Error loading payment:', error);
      Alert.alert('Error', 'Failed to load payment');
      router.back();
    }
  };

  const handleSavePayment = async () => {
    if (!payment) return;

    // Validate required fields
    const missingFields = [];
    if (!formData.supplierName.trim()) missingFields.push('Supplier Name');
    if (!formData.phoneNumber.trim()) missingFields.push('Phone Number');
    if (!formData.paid.trim()) missingFields.push('Paid Amount');
    
    if (missingFields.length > 0) {
      Alert.alert('Error', `Please fill the following required fields:\n• ${missingFields.join('\n• ')}`);
      return;
    }

    const paidAmount = parseFloat(formData.paid);
    if (isNaN(paidAmount) || paidAmount <= 0) {
      Alert.alert('Error', 'Please enter a valid paid amount');
      return;
    }

    try {
      const payments = await Storage.getObject<PaymentOut[]>(STORAGE_KEYS.PURCHASE_PAYMENTS);
      const updatedPayments = payments?.map(p => 
        p.id === paymentId 
          ? {
              ...p,
              paymentNo: formData.paymentNo,
              supplierName: formData.supplierName,
              phoneNumber: formData.phoneNumber,
              paid: paidAmount,
              date: formData.date,
            }
          : p
      ) || [];

      await Storage.setObject(STORAGE_KEYS.PURCHASE_PAYMENTS, updatedPayments);
      
      // Trigger balance recalculation
      await Storage.setObject('LAST_TRANSACTION_UPDATE', Date.now().toString());
      
      Alert.alert('Success', 'Payment updated successfully!');
      router.back();
    } catch (error) {
      console.error('Error saving payment:', error);
      Alert.alert('Error', 'Failed to save payment');
    }
  };

  const handleDeletePayment = async () => {
    if (!payment) return;

    try {
      const payments = await Storage.getObject<PaymentOut[]>(STORAGE_KEYS.PURCHASE_PAYMENTS);
      const updatedPayments = payments?.filter(p => p.id !== paymentId) || [];

      await Storage.setObject(STORAGE_KEYS.PURCHASE_PAYMENTS, updatedPayments);
      
      // Trigger balance recalculation
      await Storage.setObject('LAST_TRANSACTION_UPDATE', Date.now().toString());
      
      Alert.alert('Success', 'Payment deleted successfully!');
      router.back();
    } catch (error) {
      console.error('Error deleting payment:', error);
      Alert.alert('Error', 'Failed to delete payment');
    }
  };

  if (!payment) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Payment Out</Text>
        <TouchableOpacity onPress={() => setShowDeleteModal(true)} style={styles.deleteButton}>
          <Ionicons name="trash-outline" size={24} color={Colors.error} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Payment Summary */}
        <View style={styles.summarySection}>
          <Text style={styles.sectionTitle}>Payment Summary</Text>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Supplier:</Text>
              <Text style={styles.summaryValue}>{payment.supplierName}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Phone:</Text>
              <Text style={styles.summaryValue}>{payment.phoneNumber}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Date:</Text>
              <Text style={styles.summaryValue}>{payment.date}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Payment No:</Text>
              <Text style={styles.summaryValue}>{payment.paymentNo}</Text>
            </View>
          </View>
        </View>

        {/* Edit Form */}
        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Edit Payment Details</Text>
          
          <Text style={styles.fieldLabel}>Payment Number</Text>
          <TextInput
            style={[styles.input, styles.disabledInput]}
            value={formData.paymentNo}
            onChangeText={(text) => setFormData(prev => ({ ...prev, paymentNo: text }))}
            placeholder="Payment Number"
            placeholderTextColor={Colors.textTertiary}
            editable={false}
          />

          <Text style={styles.fieldLabel}>Supplier Name *</Text>
          <TextInput
            style={styles.input}
            value={formData.supplierName}
            onChangeText={(text) => setFormData(prev => ({ ...prev, supplierName: text }))}
            placeholder="Enter supplier name"
            placeholderTextColor={Colors.textTertiary}
          />

          <Text style={styles.fieldLabel}>Phone Number *</Text>
          <TextInput
            style={styles.input}
            value={formData.phoneNumber}
            onChangeText={(text) => setFormData(prev => ({ ...prev, phoneNumber: text }))}
            placeholder="Enter phone number"
            placeholderTextColor={Colors.textTertiary}
            keyboardType="phone-pad"
          />

          <Text style={styles.fieldLabel}>Paid Amount *</Text>
          <TextInput
            style={styles.input}
            value={formData.paid}
            onChangeText={(text) => setFormData(prev => ({ ...prev, paid: text }))}
            placeholder="Enter paid amount"
            placeholderTextColor={Colors.textTertiary}
            keyboardType="numeric"
          />

          <Text style={styles.fieldLabel}>Date</Text>
          <TextInput
            style={styles.input}
            value={formData.date}
            onChangeText={(text) => setFormData(prev => ({ ...prev, date: text }))}
            placeholder="Enter date"
            placeholderTextColor={Colors.textTertiary}
          />
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.cancelButton} onPress={() => router.back()}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.saveButton} onPress={handleSavePayment}>
            <Text style={styles.saveButtonText}>Save Changes</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.deleteModal}>
            <Text style={styles.deleteModalTitle}>Delete Payment</Text>
            <Text style={styles.deleteModalText}>
              Are you sure you want to delete this payment? This action cannot be undone.
            </Text>
            <View style={styles.deleteModalButtons}>
              <TouchableOpacity 
                style={styles.deleteModalCancelButton} 
                onPress={() => setShowDeleteModal(false)}
              >
                <Text style={styles.deleteModalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.deleteModalConfirmButton} 
                onPress={handleDeletePayment}
              >
                <Text style={styles.deleteModalConfirmText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    justifyContent: 'space-between',
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
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text,
  },
  deleteButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 100,
    fontSize: 16,
    color: Colors.textSecondary,
  },
  summarySection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 16,
  },
  summaryCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  summaryLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '600',
  },
  formSection: {
    marginBottom: 24,
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
  disabledInput: {
    backgroundColor: Colors.surfaceVariant,
    color: Colors.textSecondary,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 40,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  saveButton: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteModal: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 24,
    margin: 20,
    width: '90%',
  },
  deleteModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 12,
  },
  deleteModalText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 24,
    lineHeight: 20,
  },
  deleteModalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  deleteModalCancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  deleteModalCancelText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  deleteModalConfirmButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: Colors.error,
    alignItems: 'center',
  },
  deleteModalConfirmText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
  },
});
