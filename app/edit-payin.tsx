import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { Colors } from '../constants/Colors';
import { Storage, STORAGE_KEYS } from '../utils/storage';

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

export default function EditPayInScreen() {
  const router = useRouter();
  const { paymentId } = useLocalSearchParams<{ paymentId: string }>();
  const [payment, setPayment] = useState<PaymentIn | null>(null);
  
  // Form states
  const [formData, setFormData] = useState({
    paymentNo: '',
    customerName: '',
    phoneNumber: '',
    received: '',
    totalAmount: '',
    date: '',
  });

  useEffect(() => {
    if (paymentId) {
      loadPayment();
    }
  }, [paymentId]);

  const loadPayment = async () => {
    try {
      const payments = await Storage.getObject<PaymentIn[]>(STORAGE_KEYS.SALES_PAYMENTS);
      const foundPayment = payments?.find(p => p.id === paymentId);
      
      if (foundPayment) {
        setPayment(foundPayment);
        setFormData({
          paymentNo: foundPayment.paymentNo || '',
          customerName: foundPayment.customerName,
          phoneNumber: foundPayment.phoneNumber,
          received: foundPayment.received.toString(),
          totalAmount: foundPayment.totalAmount.toString(),
          date: foundPayment.date,
        });
      } else {
        Alert.alert('Error', 'Payment not found');
        router.back();
      }
    } catch (error) {
      console.error('Error loading payment:', error);
      Alert.alert('Error', 'Failed to load payment');
    }
  };

  const handleSavePayment = async () => {
    if (!payment || !formData.customerName || !formData.phoneNumber || !formData.received) {
      Alert.alert('Error', 'Please fill all required fields');
      return;
    }

    const received = parseFloat(formData.received);
    const totalAmount = parseFloat(formData.totalAmount || '0');

    if (isNaN(received) || received <= 0) {
      Alert.alert('Error', 'Please enter a valid received amount');
      return;
    }

    const updatedPayment: PaymentIn = {
      ...payment,
      paymentNo: formData.paymentNo,
      customerName: formData.customerName,
      phoneNumber: formData.phoneNumber,
      received,
      totalAmount,
      date: formData.date,
    };

    try {
      const payments = await Storage.getObject<PaymentIn[]>(STORAGE_KEYS.SALES_PAYMENTS);
      const updatedPayments = payments?.map(p => 
        p.id === paymentId ? updatedPayment : p
      ) || [];
      
      await Storage.setObject(STORAGE_KEYS.SALES_PAYMENTS, updatedPayments);
      
      // Trigger balance recalculation by updating a special key
      await Storage.setObject('LAST_TRANSACTION_UPDATE', Date.now().toString());
      
      Alert.alert('Success', 'Payment updated successfully!');
      router.back();
    } catch (error) {
      console.error('Error updating payment:', error);
      Alert.alert('Error', 'Failed to update payment');
    }
  };

  if (!payment) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Payment In</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
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
        <Text style={styles.headerTitle}>Edit Payment In</Text>
        <TouchableOpacity onPress={handleSavePayment} style={styles.saveButton}>
          <Ionicons name="checkmark" size={24} color={Colors.success} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView 
        style={styles.content} 
        behavior="padding"
        keyboardVerticalOffset={100}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Payment Details */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment Details</Text>
            
            <Text style={styles.fieldLabel}>Payment Number</Text>
            <TextInput
              style={[styles.input, styles.disabledInput]}
              placeholder="Payment number..."
              placeholderTextColor={Colors.textTertiary}
              value={formData.paymentNo}
              onChangeText={(text) => setFormData(prev => ({ ...prev, paymentNo: text }))}
              editable={false}
            />
            
            <Text style={styles.fieldLabel}>Customer Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter customer name..."
              placeholderTextColor={Colors.textTertiary}
              value={formData.customerName}
              onChangeText={(text) => setFormData(prev => ({ ...prev, customerName: text }))}
            />
            
            <Text style={styles.fieldLabel}>Phone Number *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter phone number..."
              placeholderTextColor={Colors.textTertiary}
              value={formData.phoneNumber}
              onChangeText={(text) => setFormData(prev => ({ ...prev, phoneNumber: text }))}
              keyboardType="phone-pad"
            />
            
            <Text style={styles.fieldLabel}>Received Amount *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter received amount..."
              placeholderTextColor={Colors.textTertiary}
              value={formData.received}
              onChangeText={(text) => setFormData(prev => ({ ...prev, received: text }))}
              keyboardType="numeric"
            />
            
            <Text style={styles.fieldLabel}>Date</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter date..."
              placeholderTextColor={Colors.textTertiary}
              value={formData.date}
              onChangeText={(text) => setFormData(prev => ({ ...prev, date: text }))}
            />
          </View>

          {/* Summary */}
          <View style={styles.summarySection}>
            <Text style={styles.summaryTitle}>Payment Summary</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Payment No:</Text>
              <Text style={styles.summaryValue}>{formData.paymentNo}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Customer:</Text>
              <Text style={styles.summaryValue}>{formData.customerName}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Phone:</Text>
              <Text style={styles.summaryValue}>{formData.phoneNumber}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Received Amount:</Text>
              <Text style={[styles.summaryValue, { color: Colors.success }]}>
                ₹{formData.received || '0'}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Date:</Text>
              <Text style={styles.summaryValue}>{formData.date}</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  saveButton: {
    padding: 8,
  },
  headerSpacer: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 16,
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
  summarySection: {
    padding: 20,
    backgroundColor: Colors.surface,
    margin: 20,
    borderRadius: 12,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
});
