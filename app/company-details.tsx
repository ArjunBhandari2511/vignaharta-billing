import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { Colors } from '../constants/Colors';
import { Messages } from '../constants/Messages';
import { Storage, STORAGE_KEYS } from '../utils/storage';

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

export default function CompanyDetailsScreen() {
  const router = useRouter();
  const [companyDetails, setCompanyDetails] = useState<CompanyDetails>({
    businessName: '',
    phoneNumber1: '',
    phoneNumber2: '',
    emailId: '',
    businessAddress: '',
    pincode: '',
    businessDescription: '',
    signature: '',
  });
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [signaturePath, setSignaturePath] = useState('');
  const [completionPercentage, setCompletionPercentage] = useState(0);

  useEffect(() => {
    loadCompanyDetails();
  }, []);

  useEffect(() => {
    calculateCompletionPercentage();
  }, [companyDetails]);

  const loadCompanyDetails = async () => {
    try {
      const details = await Storage.getObject<CompanyDetails>(STORAGE_KEYS.COMPANY_DETAILS);
      if (details) {
        setCompanyDetails(details);
      }
    } catch (error) {
      console.error('Error loading company details:', error);
    }
  };

  const calculateCompletionPercentage = () => {
    const fields = [
      companyDetails.businessName,
      companyDetails.phoneNumber1,
      companyDetails.emailId,
      companyDetails.businessAddress,
      companyDetails.pincode,
      companyDetails.businessDescription,
      companyDetails.signature,
    ];
    
    const filledFields = fields.filter(field => field.trim().length > 0).length;
    const percentage = Math.round((filledFields / fields.length) * 100);
    setCompletionPercentage(percentage);
  };

  const updateField = (field: keyof CompanyDetails, value: string) => {
    setCompanyDetails(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = async () => {
    try {
      await Storage.setObject(STORAGE_KEYS.COMPANY_DETAILS, companyDetails);
      Alert.alert(
        'Success', 
        Messages.SUCCESS.COMPANY_DETAILS_SAVED,
        [
          {
            text: 'OK',
            onPress: () => router.push('/(tabs)')
          }
        ]
      );
    } catch (error) {
      Alert.alert('Error', Messages.ERROR.FAILED_TO_SAVE_COMPANY_DETAILS);
    }
  };

  const handleSignatureSave = (signatureData: string) => {
    setSignaturePath(signatureData);
    updateField('signature', signatureData);
    setShowSignatureModal(false);
  };

  const SignatureModal = () => (
    <Modal
      visible={showSignatureModal}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={styles.signatureModalContainer}>
        <View style={styles.signatureModalHeader}>
          <Text style={styles.signatureModalTitle}>Draw Your Signature</Text>
          <TouchableOpacity onPress={() => setShowSignatureModal(false)}>
            <Ionicons name="close" size={24} color={Colors.text} />
          </TouchableOpacity>
        </View>
        
        <View style={styles.signatureCanvas}>
          <Text style={styles.signaturePlaceholder}>
            Signature drawing functionality will be implemented here
          </Text>
          <Text style={styles.signatureNote}>
            For now, you can add a text signature below
          </Text>
        </View>
        
        <View style={styles.signatureModalFooter}>
          <TouchableOpacity 
            style={styles.signatureSaveButton}
            onPress={() => handleSignatureSave('Digital Signature')}
          >
            <Text style={styles.signatureSaveButtonText}>Save Signature</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Company Details</Text>
          </View>

          {/* Profile Section */}
          <View style={styles.profileSection}>
            <View style={[
              styles.profileImageContainer,
              completionPercentage > 0 && styles.profileImageContainerWithBorder
            ]}>
              <TouchableOpacity style={styles.profileImageButton}>
                <Ionicons name="camera" size={32} color={Colors.textSecondary} />
                <Text style={styles.profileImageText}>Add Photo</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.completionContainer}>
              <Text style={styles.completionText}>Profile {completionPercentage}% Completed</Text>
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill, 
                    { width: `${completionPercentage}%` }
                  ]} 
                />
              </View>
            </View>
          </View>

          {/* Form Section */}
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Business Information</Text>
            
            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>Business Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter business name"
                placeholderTextColor={Colors.textTertiary}
                value={companyDetails.businessName}
                onChangeText={(text) => updateField('businessName', text)}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>Phone Number 1 *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter primary phone number"
                placeholderTextColor={Colors.textTertiary}
                value={companyDetails.phoneNumber1}
                onChangeText={(text) => updateField('phoneNumber1', text)}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>Phone Number 2</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter secondary phone number (optional)"
                placeholderTextColor={Colors.textTertiary}
                value={companyDetails.phoneNumber2}
                onChangeText={(text) => updateField('phoneNumber2', text)}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>Email ID *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter email address"
                placeholderTextColor={Colors.textTertiary}
                value={companyDetails.emailId}
                onChangeText={(text) => updateField('emailId', text)}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>Business Address *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Enter complete business address"
                placeholderTextColor={Colors.textTertiary}
                value={companyDetails.businessAddress}
                onChangeText={(text) => updateField('businessAddress', text)}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>Pincode *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter pincode"
                placeholderTextColor={Colors.textTertiary}
                value={companyDetails.pincode}
                onChangeText={(text) => updateField('pincode', text)}
                keyboardType="numeric"
                maxLength={6}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>Business Description *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Describe your business (products/services)"
                placeholderTextColor={Colors.textTertiary}
                value={companyDetails.businessDescription}
                onChangeText={(text) => updateField('businessDescription', text)}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>Digital Signature *</Text>
              <TouchableOpacity 
                style={styles.signatureButton}
                onPress={() => setShowSignatureModal(true)}
              >
                {companyDetails.signature ? (
                  <View style={styles.signatureDisplay}>
                    <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
                    <Text style={styles.signatureDisplayText}>Signature Added</Text>
                  </View>
                ) : (
                  <View style={styles.signaturePlaceholder}>
                    <Ionicons name="create-outline" size={24} color={Colors.textSecondary} />
                    <Text style={styles.signaturePlaceholderText}>Draw Signature</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Save Button */}
          <View style={styles.bottomSection}>
            <TouchableOpacity style={styles.saveButtonLarge} onPress={handleSave}>
              <Ionicons name="save" size={20} color={Colors.text} />
              <Text style={styles.saveButtonLargeText}>Save Company Details</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <SignatureModal />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingTop: 10,
    position: 'relative',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text,
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
  },
  backButton: {
    padding: 8,
    zIndex: 1,
  },

  profileSection: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  profileImageContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  profileImageContainerWithBorder: {
    borderWidth: 3,
    borderColor: Colors.primary,
  },
  profileImageButton: {
    alignItems: 'center',
  },
  profileImageText: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  completionContainer: {
    alignItems: 'center',
  },
  completionText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  progressBar: {
    width: 200,
    height: 8,
    backgroundColor: Colors.surface,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 4,
  },
  formSection: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 20,
  },
  formGroup: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    color: Colors.text,
    fontSize: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  textArea: {
    minHeight: 100,
    paddingTop: 16,
  },
  signatureButton: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  signatureDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  signatureDisplayText: {
    color: Colors.success,
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  signaturePlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  signaturePlaceholderText: {
    color: Colors.textSecondary,
    fontSize: 16,
    marginLeft: 8,
  },
  bottomSection: {
    padding: 20,
    paddingBottom: 40,
  },
  saveButtonLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  saveButtonLargeText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  // Signature Modal Styles
  signatureModalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  signatureModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  signatureModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  signatureCanvas: {
    flex: 1,
    backgroundColor: Colors.surface,
    margin: 20,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  signatureNote: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
  signatureModalFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  signatureSaveButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  signatureSaveButtonText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
});
