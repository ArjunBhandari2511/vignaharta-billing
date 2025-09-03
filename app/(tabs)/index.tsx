import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useEffect, useState } from 'react';
import {
    Alert,
    Dimensions,
    FlatList,
    Modal,
    Platform,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { Colors } from '../../constants/Colors';
import { BasePdfGenerator } from '../../utils/basePdfGenerator';
import { Party, PartyManager } from '../../utils/partyManager';
import { StockManager } from '../../utils/stockManager';
import { Storage, STORAGE_KEYS } from '../../utils/storage';

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

interface Transaction {
  id: string;
  type: 'sale' | 'purchase' | 'payment-in' | 'payment-out';
  reference: string;
  customerName: string;
  amount: number;
  date: string;
  status: string;
  items?: any[];
  pdfUri?: string; // For sale invoices and purchase bills
}

interface FilterOptions {
  all: boolean;
  sales: boolean;
  purchases: boolean;
  paymentIn: boolean;
  paymentOut: boolean;
}

// Use Party interface directly since it already has all the needed properties
type Customer = Party;
type Supplier = Party;

export default function DashboardScreen() {
  const [activeTab, setActiveTab] = useState<'transactions' | 'party'>('transactions');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [activeFilterOptions, setActiveFilterOptions] = useState<FilterOptions>({
    all: true,
    sales: false,
    purchases: false,
    paymentIn: false,
    paymentOut: false,
  });
  const [modalFilterOptions, setModalFilterOptions] = useState<FilterOptions>({
    all: true,
    sales: false,
    purchases: false,
    paymentIn: false,
    paymentOut: false,
  });
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [filteredSuppliers, setFilteredSuppliers] = useState<Supplier[]>([]);
  const [partySearchQuery, setPartySearchQuery] = useState('');
  const [showPartyFilterModal, setShowPartyFilterModal] = useState(false);
  const [partyFilterOptions, setPartyFilterOptions] = useState({
    all: true,
    customers: false,
    suppliers: false,
  });
  const [activePartyFilter, setActivePartyFilter] = useState('all');
  const [companyDetails, setCompanyDetails] = useState<{ businessName: string } | null>(null);

  useEffect(() => {
    loadDashboardData();
    loadCustomers();
    loadSuppliers();
    loadCompanyDetails();
    // Initialize Bardana universal item
    StockManager.initializeBardana();
  }, []);

  // Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
      loadCustomers();
      loadSuppliers();
      loadCompanyDetails();
    }, [])
  );

  // Monitor for transaction updates and refresh party balances
  useEffect(() => {
    const checkForUpdates = async () => {
      try {
        const lastUpdate = await Storage.getObject<string>('LAST_TRANSACTION_UPDATE');
        if (lastUpdate) {
          // Clear the update flag
          await Storage.removeItem('LAST_TRANSACTION_UPDATE');
          // Reload party data to reflect changes
          loadCustomers();
          loadSuppliers();
        }
      } catch (error) {
        console.error('Error checking for updates:', error);
      }
    };

    // Check for updates every 2 seconds when the screen is active
    const interval = setInterval(checkForUpdates, 2000);
    
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    filterTransactions();
  }, [transactions, activeFilterOptions, searchQuery]);

  useEffect(() => {
    filterCustomers();
  }, [customers, partySearchQuery]);

  useEffect(() => {
    filterSuppliers();
  }, [suppliers, partySearchQuery]);



  const loadDashboardData = async () => {
    try {
      const salesInvoices = await Storage.getObject<any[]>(STORAGE_KEYS.SALES_INVOICES);
      const salesPayments = await Storage.getObject<any[]>(STORAGE_KEYS.SALES_PAYMENTS);
      const purchaseBills = await Storage.getObject<any[]>(STORAGE_KEYS.PURCHASE_BILLS);
      const purchasePayments = await Storage.getObject<any[]>(STORAGE_KEYS.PURCHASE_PAYMENTS);
      

      

      
      // Combine all transactions
      const allTransactions: Transaction[] = [];

      // Add sales invoices
      salesInvoices?.forEach(invoice => {
        allTransactions.push({
          id: invoice.id || '',
          type: 'sale',
          reference: `INV-${invoice.invoiceNo || ''}`,
          customerName: invoice.customerName || '',
          amount: invoice.totalAmount || 0,
          date: invoice.date || '',
          status: invoice.status || 'pending',
          items: invoice.items || [],
          pdfUri: invoice.pdfUri || undefined, // Include PDF URI
        });
      });

      // Add sales payments (Payment In)
      salesPayments?.forEach(payment => {
        allTransactions.push({
          id: payment.id || '',
          type: 'payment-in',
          reference: payment.paymentNo || `PAY-${payment.id || ''}`,
          customerName: payment.customerName || '',
          amount: payment.received || 0,
          date: payment.date || '',
          status: payment.status || 'pending',
        });
      });

      // Add purchase bills
      purchaseBills?.forEach(bill => {
        allTransactions.push({
          id: bill.id || '',
          type: 'purchase',
          reference: `BILL-${bill.billNo || ''}`,
          customerName: bill.supplierName || '',
          amount: bill.totalAmount || 0,
          date: bill.date || '',
          status: bill.status || 'pending',
          items: bill.items || [],
          pdfUri: bill.pdfUri || undefined, // Include PDF URI
        });
      });

      // Add purchase payments (Payment Out)
      purchasePayments?.forEach(payment => {
        allTransactions.push({
          id: payment.id || '',
          type: 'payment-out',
          reference: payment.paymentNo || `PAY-${payment.id || ''}`,
          customerName: payment.supplierName || '',
          amount: payment.paid || 0,
          date: payment.date || '',
          status: payment.status || 'pending',
        });
      });



      // Sort by date (newest first)
      allTransactions.sort((a, b) => {
        const dateA = new Date(a.date || '').getTime();
        const dateB = new Date(b.date || '').getTime();
        return dateB - dateA;
      });
      
      setTransactions(allTransactions);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
  };

  const filterTransactions = () => {
    let filtered = transactions;

    // Filter by type
    const activeFilters = Object.keys(activeFilterOptions).filter(key => activeFilterOptions[key as keyof FilterOptions]);
    
    if (!activeFilterOptions.all && activeFilters.length > 0) {
      const filterMap = {
        'sales': 'sale',
        'purchases': 'purchase',
        'paymentIn': 'payment-in',
        'paymentOut': 'payment-out'
      };
      filtered = filtered.filter(transaction => 
        activeFilters.some(filter => {
          const filterValue = filterMap[filter as keyof typeof filterMap];
          return transaction.type === filterValue;
        })
      );
    }

    // Filter by search query (customer name)
    if (searchQuery.trim()) {
      filtered = filtered.filter(transaction =>
        transaction.customerName.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredTransactions(filtered);
  };

  const loadCustomers = async () => {
    try {
      const customersData = await PartyManager.getPartiesByType('customer');
      setCustomers(customersData);
    } catch (error) {
      // Error loading customers
    }
  };

  const filterCustomers = () => {
    let filtered = customers;

    // Filter by search query (customer name only)
    if (partySearchQuery.trim()) {
      filtered = filtered.filter(customer =>
        customer.name.toLowerCase().includes(partySearchQuery.toLowerCase())
      );
    }

    setFilteredCustomers(filtered);
  };

  const loadSuppliers = async () => {
    try {
      const allSuppliers = await PartyManager.getPartiesByType('supplier');
      setSuppliers(allSuppliers);
    } catch (error) {
      console.error('Error loading suppliers:', error);
    }
  };

  const loadCompanyDetails = async () => {
    try {
      const details = await Storage.getObject<{ businessName: string }>(STORAGE_KEYS.COMPANY_DETAILS);
      setCompanyDetails(details);
    } catch (error) {
      console.error('Error loading company details:', error);
    }
  };



  const sharePDF = async (transaction: Transaction) => {
    try {
      if (!transaction.pdfUri) {
        Alert.alert('Error', 'PDF not found for this document');
        return;
      }

      const isSharingAvailable = await Sharing.isAvailableAsync();
      if (isSharingAvailable) {
        await Sharing.shareAsync(transaction.pdfUri, {
          mimeType: 'application/pdf',
          dialogTitle: `${transaction.type === 'sale' ? 'Invoice' : 'Purchase Bill'} #${transaction.reference}`,
        });
      } else {
        Alert.alert('Error', 'Sharing not available on this device');
      }
    } catch (error) {
      console.error('Error sharing PDF:', error);
      Alert.alert('Error', 'Failed to share PDF');
    }
  };

  const generateAndShareInvoicePDF = async (transaction: Transaction) => {
    try {
      // Find the corresponding sale invoice
      const saleInvoices = await Storage.getObject<any[]>(STORAGE_KEYS.SALES_INVOICES);
      const saleInvoice = saleInvoices?.find(invoice => invoice.id === transaction.id);
      
      if (saleInvoice) {
        // Generate PDF and get the URI
        const pdfUri = await BasePdfGenerator.generateInvoicePDF(saleInvoice);
        
        if (pdfUri) {
          // Update the invoice with the PDF URI
          saleInvoice.pdfUri = pdfUri;
          
          // Update the storage
          const updatedInvoices = saleInvoices?.map(invoice => 
            invoice.id === transaction.id ? saleInvoice : invoice
          ) || [];
          await Storage.setObject(STORAGE_KEYS.SALES_INVOICES, updatedInvoices);
          
          // Small delay to ensure storage is persisted
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Reload dashboard data to ensure consistency
          try {
            await loadDashboardData();
          } catch (error) {
            console.error('Error reloading dashboard data:', error);
          }
          
          // Share the PDF
          const isSharingAvailable = await Sharing.isAvailableAsync();
          if (isSharingAvailable) {
            await Sharing.shareAsync(pdfUri, {
              mimeType: 'application/pdf',
              dialogTitle: `Invoice #${saleInvoice.invoiceNo}`,
            });
          } else {
            Alert.alert('Error', 'Sharing not available on this device');
          }
        } else {
          Alert.alert('Error', 'Failed to generate invoice PDF');
        }
      } else {
        Alert.alert('Error', 'Sale invoice not found');
      }
    } catch (error) {
      console.error('Error generating and sharing invoice PDF:', error);
      Alert.alert('Error', 'Failed to generate and share invoice PDF');
    }
  };

  const generateAndSharePurchaseBillPDF = async (transaction: Transaction) => {
    try {
      // Find the corresponding purchase bill
      const purchaseBills = await Storage.getObject<any[]>(STORAGE_KEYS.PURCHASE_BILLS);
      const purchaseBill = purchaseBills?.find(bill => bill.id === transaction.id);
      
      if (purchaseBill) {
        // Generate PDF and get the URI
        const pdfUri = await BasePdfGenerator.generatePurchaseBillPDF(purchaseBill);
        
        if (pdfUri) {
          // Update the bill with the PDF URI
          purchaseBill.pdfUri = pdfUri;
          
          // Update the storage
          const updatedBills = purchaseBills?.map(invoice => 
            invoice.id === transaction.id ? purchaseBill : invoice
          ) || [];
          await Storage.setObject(STORAGE_KEYS.PURCHASE_BILLS, updatedBills);
          
          // Small delay to ensure storage is persisted
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Reload dashboard data to ensure consistency
          try {
            await loadDashboardData();
          } catch (error) {
            console.error('Error reloading dashboard data:', error);
          }
          
          // Share the PDF
          const isSharingAvailable = await Sharing.isAvailableAsync();
          if (isSharingAvailable) {
            await Sharing.shareAsync(pdfUri, {
              mimeType: 'application/pdf',
              dialogTitle: `Purchase Bill #${purchaseBill.billNo}`,
            });
          } else {
            Alert.alert('Error', 'Sharing not available on this device');
          }
        } else {
          Alert.alert('Error', 'Failed to generate purchase bill PDF');
        }
      } else {
        Alert.alert('Error', 'Purchase bill not found');
      }
    } catch (error) {
      console.error('Error generating and sharing purchase bill PDF:', error);
      Alert.alert('Error', 'Failed to generate and share purchase bill PDF');
    }
  };

  const filterSuppliers = () => {
    let filtered = suppliers;

    // Filter by search query (supplier name only)
    if (partySearchQuery.trim()) {
      filtered = filtered.filter(supplier =>
        supplier.name.toLowerCase().includes(partySearchQuery.toLowerCase())
      );
    }

    setFilteredSuppliers(filtered);
  };

  const openPartyFilterModal = () => {
    setShowPartyFilterModal(true);
  };

  const handlePartyFilterToggle = (filter: string) => {
    setPartyFilterOptions(prev => {
      const newOptions = {
        all: false,
        customers: false,
        suppliers: false,
      };
      newOptions[filter as keyof typeof newOptions] = true;
      return newOptions;
    });
  };

  const applyPartyFilters = () => {
    if (partyFilterOptions.all) {
      setActivePartyFilter('all');
    } else if (partyFilterOptions.customers) {
      setActivePartyFilter('customers');
    } else if (partyFilterOptions.suppliers) {
      setActivePartyFilter('suppliers');
    }
    setShowPartyFilterModal(false);
  };

  const clearPartyFilters = () => {
    setPartyFilterOptions({
      all: true,
      customers: false,
      suppliers: false,
    });
    setActivePartyFilter('all');
  };

  const getFilteredParties = () => {
    let allParties: Array<{ type: 'customer' | 'supplier', data: Customer | Supplier }> = [];
    
    if (activePartyFilter === 'all' || activePartyFilter === 'customers') {
      filteredCustomers.forEach(customer => {
        allParties.push({ type: 'customer', data: customer });
      });
    }
    
    if (activePartyFilter === 'all' || activePartyFilter === 'suppliers') {
      filteredSuppliers.forEach(supplier => {
        allParties.push({ type: 'supplier', data: supplier });
      });
    }
    
    return allParties;
  };

  const handleFilterToggle = (filterKey: keyof FilterOptions) => {
    if (filterKey === 'all') {
      setModalFilterOptions({
        all: true,
        sales: false,
        purchases: false,
        paymentIn: false,
        paymentOut: false,
      });
    } else {
      const newOptions = {
        ...modalFilterOptions,
        all: false,
        [filterKey]: !modalFilterOptions[filterKey],
      };
      
      // If no specific filters are selected, default to 'all'
      if (!newOptions.sales && !newOptions.purchases && !newOptions.paymentIn && !newOptions.paymentOut) {
        newOptions.all = true;
      }
      
      setModalFilterOptions(newOptions);
    }
  };

  const clearFilters = () => {
    setModalFilterOptions({
      all: true,
      sales: false,
      purchases: false,
      paymentIn: false,
      paymentOut: false,
    });
  };

  const applyFilters = () => {
    setActiveFilterOptions(modalFilterOptions);
    setShowFilterModal(false);
  };

  const openFilterModal = () => {
    setModalFilterOptions(activeFilterOptions);
    setShowFilterModal(true);
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'sale':
        return 'trending-up';
      case 'purchase':
        return 'cart';
      case 'payment-in':
        return 'arrow-down-circle';
      case 'payment-out':
        return 'arrow-up-circle';
      default:
        return 'help-circle';
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case 'sale':
        return Colors.success; // Green
      case 'purchase':
        return Colors.info; // Blue
      case 'payment-in':
        return '#8b5cf6'; // Purple for Payment In
      case 'payment-out':
        return Colors.error; // Red
      default:
        return Colors.textTertiary;
    }
  };

  const getTransactionTypeLabel = (type: string) => {
    switch (type) {
      case 'sale':
        return 'Sale';
      case 'purchase':
        return 'Purchase';
      case 'payment-in':
        return 'PAY IN';
      case 'payment-out':
        return 'PAY OUT';
      default:
        return 'Transaction';
    }
  };

  const navigateToTransaction = (transaction: Transaction) => {
    switch (transaction.type) {
      case 'sale':
        router.push({
          pathname: '/edit-invoice',
          params: { invoiceId: transaction.id }
        });
        break;
      case 'purchase':
        router.push({
          pathname: '/edit-purchase',
          params: { billId: transaction.id }
        });
        break;
      case 'payment-in':
        router.push({
          pathname: '/edit-payin',
          params: { paymentId: transaction.id }
        });
        break;
      case 'payment-out':
        router.push({
          pathname: '/edit-payout',
          params: { paymentId: transaction.id }
        });
        break;
    }
  };

  const deleteTransaction = async (transaction: Transaction) => {
    Alert.alert(
      'Delete Transaction',
      `Are you sure you want to delete ${transaction.reference}?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              let updatedData: any[] = [];
              
              switch (transaction.type) {
                case 'sale':
                  const salesInvoices = await Storage.getObject<any[]>(STORAGE_KEYS.SALES_INVOICES);
                  updatedData = salesInvoices?.filter(invoice => invoice.id !== transaction.id) || [];
                  await Storage.setObject(STORAGE_KEYS.SALES_INVOICES, updatedData);
                  break;
                  
                case 'payment-in':
                  const salesPayments = await Storage.getObject<any[]>(STORAGE_KEYS.SALES_PAYMENTS);
                  updatedData = salesPayments?.filter(payment => payment.id !== transaction.id) || [];
                  await Storage.setObject(STORAGE_KEYS.SALES_PAYMENTS, updatedData);
                  break;
                  
                case 'purchase':
                  const purchaseBills = await Storage.getObject<any[]>(STORAGE_KEYS.PURCHASE_BILLS);
                  updatedData = purchaseBills?.filter(bill => bill.id !== transaction.id) || [];
                  await Storage.setObject(STORAGE_KEYS.PURCHASE_BILLS, updatedData);
                  break;
                  
                case 'payment-out':
                  const purchasePayments = await Storage.getObject<any[]>(STORAGE_KEYS.PURCHASE_PAYMENTS);
                  updatedData = purchasePayments?.filter(payment => payment.id !== transaction.id) || [];
                  await Storage.setObject(STORAGE_KEYS.PURCHASE_PAYMENTS, updatedData);
                  break;
              }
              
              // Trigger balance recalculation
              await Storage.setObject('LAST_TRANSACTION_UPDATE', Date.now().toString());
              
              // Reload dashboard data to reflect changes
              loadDashboardData();
              Alert.alert('Success', 'Transaction deleted successfully!');
            } catch (error) {
              Alert.alert('Error', 'Failed to delete transaction. Please try again.');
            }
          },
        },
      ]
    );
  };

  const FilterCheckbox = ({ label, checked, onToggle }: {
    label: string;
    checked: boolean;
    onToggle: () => void;
  }) => (
    <TouchableOpacity 
      style={styles.checkboxContainer} 
      onPress={onToggle}
      activeOpacity={isAndroid ? 0.7 : 0.2}
      {...(isAndroid && {
        android_ripple: { color: ANDROID_CONSTANTS.rippleColor },
      })}
    >
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked && <Ionicons name="checkmark" size={16} color={Colors.text} />}
      </View>
      <Text style={styles.checkboxLabel}>{label}</Text>
    </TouchableOpacity>
  );

  const TransactionItem = ({ transaction }: { transaction: Transaction }) => {
    return (
    <TouchableOpacity 
      style={styles.transactionItem}
      onPress={() => navigateToTransaction(transaction)}
      activeOpacity={isAndroid ? 0.7 : 0.2}
      {...(isAndroid && {
        android_ripple: { color: ANDROID_CONSTANTS.rippleColor },
      })}
    >
      <View style={styles.transactionHeader}>
        <View style={styles.transactionLeft}>
          <View style={[styles.transactionIcon, { backgroundColor: getTransactionColor(transaction.type) }]}>
            <Ionicons name={getTransactionIcon(transaction.type) as any} size={20} color={Colors.text} />
          </View>
          <View style={styles.transactionInfo}>
            <Text style={styles.transactionReference}>{transaction.reference}</Text>
            <Text style={styles.transactionCustomer}>{transaction.customerName}</Text>
            <Text style={styles.transactionDate}>{transaction.date}</Text>
          </View>
        </View>
        <View style={styles.transactionRight}>
          <Text style={[styles.transactionAmount, { color: getTransactionColor(transaction.type) }]}>
            ₹{(transaction.amount || 0).toLocaleString()}
          </Text>
          <View style={styles.transactionTypeContainer}>
            <View style={[styles.transactionBadge, { backgroundColor: getTransactionColor(transaction.type) }]}>
              <Text style={styles.transactionBadgeText}>{getTransactionTypeLabel(transaction.type)}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Action Icons */}
      <View style={styles.actionIconsContainer}>
        {transaction.type === 'sale' && transaction.pdfUri && (
          <TouchableOpacity 
            style={styles.actionIcon} 
            onPress={(e) => {
              e.stopPropagation();
              sharePDF(transaction);
            }}
            activeOpacity={isAndroid ? 0.7 : 0.2}
            {...(isAndroid && {
              android_ripple: { color: ANDROID_CONSTANTS.rippleColor },
            })}
          >
            <Ionicons name="share-outline" size={20} color={Colors.primary} />
          </TouchableOpacity>
        )}
        {transaction.type === 'sale' && !transaction.pdfUri && (
          <TouchableOpacity 
            style={styles.actionIcon} 
            onPress={(e) => {
              e.stopPropagation();
              generateAndShareInvoicePDF(transaction);
            }}
            activeOpacity={isAndroid ? 0.7 : 0.2}
            {...(isAndroid && {
              android_ripple: { color: ANDROID_CONSTANTS.rippleColor },
            })}
          >
            <Ionicons name="share-outline" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        )}
        {transaction.type === 'purchase' && transaction.pdfUri && (
          <TouchableOpacity 
            style={styles.actionIcon} 
            onPress={(e) => {
              e.stopPropagation();
              sharePDF(transaction);
            }}
            activeOpacity={isAndroid ? 0.7 : 0.2}
            {...(isAndroid && {
              android_ripple: { color: ANDROID_CONSTANTS.rippleColor },
            })}
          >
            <Ionicons name="share-outline" size={20} color={Colors.primary} />
          </TouchableOpacity>
        )}
        {transaction.type === 'purchase' && !transaction.pdfUri && (
          <TouchableOpacity 
            style={styles.actionIcon} 
            onPress={(e) => {
              e.stopPropagation();
              generateAndSharePurchaseBillPDF(transaction);
            }}
            activeOpacity={isAndroid ? 0.7 : 0.2}
            {...(isAndroid && {
              android_ripple: { color: ANDROID_CONSTANTS.rippleColor },
            })}
          >
            <Ionicons name="share-outline" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        )}
        <TouchableOpacity 
          style={styles.actionIcon} 
          onPress={(e) => {
            e.stopPropagation();
            Alert.alert('Coming Soon!', 'Print functionality will be available soon.');
          }}
          activeOpacity={isAndroid ? 0.7 : 0.2}
          {...(isAndroid && {
            android_ripple: { color: ANDROID_CONSTANTS.rippleColor },
          })}
        >
          <Ionicons name="print-outline" size={20} color={Colors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.actionIcon} 
          onPress={(e) => {
            e.stopPropagation();
            deleteTransaction(transaction);
          }}
          activeOpacity={isAndroid ? 0.7 : 0.2}
          {...(isAndroid && {
            android_ripple: { color: ANDROID_CONSTANTS.rippleColor },
          })}
        >
          <Ionicons name="trash-outline" size={20} color={Colors.error} />
        </TouchableOpacity>
      </View>
      

    </TouchableOpacity>
    );
  };

    const CustomerItem = ({ customer }: { customer: Customer }) => (
    <TouchableOpacity 
      style={styles.customerItem}
      activeOpacity={isAndroid ? 0.7 : 0.2}
      {...(isAndroid && {
        android_ripple: { color: ANDROID_CONSTANTS.rippleColor },
      })}
    >
      <View style={styles.customerHeader}>
        <Text style={styles.customerName}>{customer.name}</Text>
        <Text style={[
          styles.customerBalance,
          { color: Colors.success }
        ]}>
          {customer.balance > 0 ? '→' : '←'} {Math.abs(customer.balance || 0).toLocaleString()}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const SupplierItem = ({ supplier }: { supplier: Supplier }) => (
    <TouchableOpacity 
      style={styles.customerItem}
      activeOpacity={isAndroid ? 0.7 : 0.2}
      {...(isAndroid && {
        android_ripple: { color: ANDROID_CONSTANTS.rippleColor },
      })}
    >
      <View style={styles.customerHeader}>
        <Text style={styles.customerName}>{supplier.name}</Text>
        <Text style={[
          styles.customerBalance,
          { color: Colors.error }
        ]}>
          ← {Math.abs(supplier.balance || 0).toLocaleString()}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const PartyItem = ({ party }: { party: { type: 'customer' | 'supplier', data: Customer | Supplier } }) => {
    const isCustomer = party.type === 'customer';
    const data = party.data as Customer | Supplier;
    
    // Determine text color and arrow based on balance
    let balanceColor: string;
    let arrowSymbol = '';
    
    if (data.balance === 0) {
      balanceColor = Colors.textSecondary; // White/gray color for zero balance
    } else if (isCustomer) {
      // For customers: positive balance = they owe you (green), negative balance = you owe them (red)
      balanceColor = data.balance > 0 ? Colors.success : Colors.error;
      arrowSymbol = data.balance > 0 ? '→' : '←';
    } else {
      // For suppliers: positive balance = you owe them (red), negative balance = they owe you (green)
      balanceColor = data.balance > 0 ? Colors.error : Colors.success;
      arrowSymbol = data.balance > 0 ? '←' : '→';
    }
    
    return (
      <TouchableOpacity 
        style={styles.customerItem}
        activeOpacity={isAndroid ? 0.7 : 0.2}
        {...(isAndroid && {
          android_ripple: { color: ANDROID_CONSTANTS.rippleColor },
        })}
      >
        <View style={styles.customerHeader}>
          <View style={styles.partyInfo}>
            <Text style={styles.customerName}>{data.name}</Text>
            <Text style={styles.partyType}>
              {isCustomer ? 'Customer' : 'Supplier'}
            </Text>
          </View>
          <Text style={[
            styles.customerBalance,
            { color: balanceColor }
          ]}>
            {arrowSymbol} {Math.abs(data.balance || 0).toLocaleString()}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
        // Android-specific: Optimize scrolling
        {...(isAndroid && {
          overScrollMode: 'never',
          nestedScrollEnabled: true,
        })}
      >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.greeting}>Welcome to</Text>
          <Text style={styles.companyName}>
            {companyDetails?.businessName || 'Vignaharta Plastic Industries'}
          </Text>
        </View>
        <TouchableOpacity 
          style={styles.settingsButton}
          onPress={() => router.push('/company-details')}
          activeOpacity={isAndroid ? 0.7 : 0.2}
          {...(isAndroid && {
            android_ripple: { color: ANDROID_CONSTANTS.rippleColor },
          })}
        >
          <Ionicons name="settings-outline" size={24} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'transactions' && styles.activeTab]}
          onPress={() => setActiveTab('transactions')}
          activeOpacity={isAndroid ? 0.7 : 0.2}
          {...(isAndroid && {
            android_ripple: { color: ANDROID_CONSTANTS.rippleColor },
          })}
        >
          <Text style={[styles.tabText, activeTab === 'transactions' && styles.activeTabText]}>
            Transactions
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'party' && styles.activeTab]}
          onPress={() => setActiveTab('party')}
          activeOpacity={isAndroid ? 0.7 : 0.2}
          {...(isAndroid && {
            android_ripple: { color: ANDROID_CONSTANTS.rippleColor },
          })}
        >
          <Text style={[styles.tabText, activeTab === 'party' && styles.activeTabText]}>
            Party
          </Text>
        </TouchableOpacity>
      </View>



      {/* Transactions Tab Content */}
      {activeTab === 'transactions' && (
        <View style={styles.searchContainer}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          <View style={styles.searchInputContainer}>
            <Ionicons name="search" size={20} color={Colors.textSecondary} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by customer name..."
              placeholderTextColor={Colors.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
                          {searchQuery.length > 0 && (
                <TouchableOpacity 
                  onPress={() => setSearchQuery('')} 
                  style={styles.clearButton}
                  activeOpacity={isAndroid ? 0.7 : 0.2}
                  {...(isAndroid && {
                    android_ripple: { color: ANDROID_CONSTANTS.rippleColor },
                  })}
                >
                  <Ionicons name="close-circle" size={20} color={Colors.textSecondary} />
                </TouchableOpacity>
              )}
              <TouchableOpacity 
                onPress={openFilterModal} 
                style={styles.filterButton}
                activeOpacity={isAndroid ? 0.7 : 0.2}
                {...(isAndroid && {
                  android_ripple: { color: ANDROID_CONSTANTS.rippleColor },
                })}
              >
                <Ionicons name="filter" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Transactions Tab Content */}
      {activeTab === 'transactions' && (
        <View style={styles.transactionsContainer}>
          {filteredTransactions.length > 0 ? (
            <FlatList
              data={filteredTransactions.slice(0, 20)} // Show last 20 transactions
              renderItem={({ item }) => <TransactionItem transaction={item} />}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
            />
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={64} color={Colors.textTertiary} />
              <Text style={styles.emptyStateTitle}>
                {searchQuery.trim() ? 'No Matching Transactions' : 'No Transactions Yet'}
              </Text>
              <Text style={styles.emptyStateSubtitle}>
                {searchQuery.trim() 
                  ? `No transactions found for "${searchQuery}"`
                  : 'Your transactions will appear here'
                }
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Party Tab Content */}
      {activeTab === 'party' && (
        <>
          <View style={styles.searchContainer}>
            <Text style={styles.sectionTitle}>All Parties</Text>
            <View style={styles.searchInputContainer}>
              <Ionicons name="search" size={20} color={Colors.textSecondary} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by name..."
                placeholderTextColor={Colors.textTertiary}
                value={partySearchQuery}
                onChangeText={setPartySearchQuery}
              />
              {partySearchQuery.length > 0 && (
                <TouchableOpacity 
                  onPress={() => setPartySearchQuery('')} 
                  style={styles.clearButton}
                  activeOpacity={isAndroid ? 0.7 : 0.2}
                  {...(isAndroid && {
                    android_ripple: { color: ANDROID_CONSTANTS.rippleColor },
                  })}
                >
                  <Ionicons name="close-circle" size={20} color={Colors.textSecondary} />
                </TouchableOpacity>
              )}
              <TouchableOpacity 
                onPress={openPartyFilterModal} 
                style={styles.filterButton}
                activeOpacity={isAndroid ? 0.7 : 0.2}
                {...(isAndroid && {
                  android_ripple: { color: ANDROID_CONSTANTS.rippleColor },
                })}
              >
                <Ionicons name="filter" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>
          
          <View style={styles.transactionsContainer}>
            {getFilteredParties().length > 0 ? (
              <FlatList
                data={getFilteredParties()}
                renderItem={({ item }) => <PartyItem party={item} />}
                keyExtractor={(item) => `${item.type}-${item.data.id}`}
                scrollEnabled={false}
                showsVerticalScrollIndicator={false}
              />
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={64} color={Colors.textTertiary} />
                <Text style={styles.emptyStateTitle}>
                  {partySearchQuery.trim() ? 'No Matching Parties' : 'No Parties Yet'}
                </Text>
                <Text style={styles.emptyStateSubtitle}>
                  {partySearchQuery.trim() 
                    ? `No parties found for "${partySearchQuery}"`
                    : 'Parties will appear here when you create transactions'
                  }
                </Text>
              </View>
            )}
          </View>
        </>
      )}

      {/* Filter Modal */}
      <Modal
        visible={showFilterModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowFilterModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter Transactions</Text>
              <TouchableOpacity 
                onPress={() => setShowFilterModal(false)}
                activeOpacity={isAndroid ? 0.7 : 0.2}
                {...(isAndroid && {
                  android_ripple: { color: ANDROID_CONSTANTS.rippleColor },
                })}
              >
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.filterOptions}>
              <FilterCheckbox
                label="All Transactions"
                checked={modalFilterOptions.all}
                onToggle={() => handleFilterToggle('all')}
              />
              <FilterCheckbox
                label="Sales"
                checked={modalFilterOptions.sales}
                onToggle={() => handleFilterToggle('sales')}
              />
              <FilterCheckbox
                label="Purchase"
                checked={modalFilterOptions.purchases}
                onToggle={() => handleFilterToggle('purchases')}
              />
              <FilterCheckbox
                label="Payment In"
                checked={modalFilterOptions.paymentIn}
                onToggle={() => handleFilterToggle('paymentIn')}
              />
              <FilterCheckbox
                label="Payment Out"
                checked={modalFilterOptions.paymentOut}
                onToggle={() => handleFilterToggle('paymentOut')}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.clearFiltersButton} 
                onPress={clearFilters}
                activeOpacity={isAndroid ? 0.7 : 0.2}
                {...(isAndroid && {
                  android_ripple: { color: ANDROID_CONSTANTS.rippleColor },
                })}
              >
                <Text style={styles.clearFiltersText}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.applyFiltersButton} 
                onPress={applyFilters}
                activeOpacity={isAndroid ? 0.7 : 0.2}
                {...(isAndroid && {
                  android_ripple: { color: ANDROID_CONSTANTS.rippleColor },
                })}
              >
                <Text style={styles.applyFiltersText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Party Filter Modal */}
      <Modal
        visible={showPartyFilterModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowPartyFilterModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter Parties</Text>
              <TouchableOpacity 
                onPress={() => setShowPartyFilterModal(false)}
                activeOpacity={isAndroid ? 0.7 : 0.2}
                {...(isAndroid && {
                  android_ripple: { color: ANDROID_CONSTANTS.rippleColor },
                })}
              >
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.filterOptions}>
              <FilterCheckbox
                label="All Parties"
                checked={partyFilterOptions.all}
                onToggle={() => handlePartyFilterToggle('all')}
              />
              <FilterCheckbox
                label="Customers"
                checked={partyFilterOptions.customers}
                onToggle={() => handlePartyFilterToggle('customers')}
              />
              <FilterCheckbox
                label="Suppliers"
                checked={partyFilterOptions.suppliers}
                onToggle={() => handlePartyFilterToggle('suppliers')}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.clearFiltersButton} 
                onPress={clearPartyFilters}
                activeOpacity={isAndroid ? 0.7 : 0.2}
                {...(isAndroid && {
                  android_ripple: { color: ANDROID_CONSTANTS.rippleColor },
                })}
              >
                <Text style={styles.clearFiltersText}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.applyFiltersButton} 
                onPress={applyPartyFilters}
                activeOpacity={isAndroid ? 0.7 : 0.2}
                {...(isAndroid && {
                  android_ripple: { color: ANDROID_CONSTANTS.rippleColor },
                })}
              >
                <Text style={styles.applyFiltersText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: {
    flex: 1,
  },
  settingsButton: {
    padding: 8,
    marginTop: 4,
    // Android-specific: Ensure minimum touch target
    minWidth: ANDROID_CONSTANTS.touchTargetMinSize,
    minHeight: ANDROID_CONSTANTS.touchTargetMinSize,
    justifyContent: 'center',
    alignItems: 'center',
  },
  greeting: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  companyName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 4,
    // Android-specific: Add elevation for Material Design
    ...(isAndroid && {
      elevation: ANDROID_CONSTANTS.elevation.low,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.22,
      shadowRadius: 2.22,
    }),
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    // Android-specific: Ensure minimum touch target
    minHeight: ANDROID_CONSTANTS.touchTargetMinSize,
    justifyContent: 'center',
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

  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 16,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    // Android-specific: Add elevation and optimize input
    ...(isAndroid && {
      elevation: ANDROID_CONSTANTS.elevation.low,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.22,
      shadowRadius: 2.22,
    }),
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
    // Android-specific: Optimize text input
    ...(isAndroid && {
      textAlignVertical: 'center',
      includeFontPadding: false,
    }),
  },
  clearButton: {
    marginLeft: 8,
    // Android-specific: Ensure minimum touch target
    minWidth: ANDROID_CONSTANTS.touchTargetMinSize,
    minHeight: ANDROID_CONSTANTS.touchTargetMinSize,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterButton: {
    marginLeft: 8,
    // Android-specific: Ensure minimum touch target
    minWidth: ANDROID_CONSTANTS.touchTargetMinSize,
    minHeight: ANDROID_CONSTANTS.touchTargetMinSize,
    justifyContent: 'center',
    alignItems: 'center',
  },
  transactionsContainer: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  transactionItem: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    // Android-specific: Add elevation and optimize touch
    ...(isAndroid && {
      elevation: ANDROID_CONSTANTS.elevation.low,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.22,
      shadowRadius: 2.22,
    }),
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  transactionLeft: {
    flexDirection: 'row',
    flex: 1,
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionReference: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  transactionCustomer: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 2,
  },
  transactionDate: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
  transactionRight: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    minHeight: 60,
  },
  transactionAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  transactionTypeContainer: {
    alignItems: 'flex-end',
  },
  transactionType: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  transactionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  transactionBadgeText: {
    fontSize: 10,
    color: Colors.text,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  itemsPreview: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  itemsPreviewText: {
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '60%',
    // Android-specific: Add elevation for modal
    ...(isAndroid && {
      elevation: ANDROID_CONSTANTS.elevation.high,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text,
  },
  filterOptions: {
    marginBottom: 20,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: Colors.border,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  checkboxLabel: {
    fontSize: 16,
    color: Colors.text,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  clearFiltersButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    // Android-specific: Ensure minimum touch target
    minHeight: ANDROID_CONSTANTS.touchTargetMinSize,
    justifyContent: 'center',
  },
  clearFiltersText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  applyFiltersButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    // Android-specific: Ensure minimum touch target and add elevation
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
  applyFiltersText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
  },
  actionIconsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
  },

  actionIcon: {
    padding: 8,
    marginLeft: 8,
    borderRadius: 8,
    backgroundColor: Colors.surface,
    // Android-specific: Ensure minimum touch target
    minWidth: ANDROID_CONSTANTS.touchTargetMinSize,
    minHeight: ANDROID_CONSTANTS.touchTargetMinSize,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Customer styles
  customerItem: {
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
  customerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  customerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
    flex: 1,
  },
  customerBalance: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  partyInfo: {
    flex: 1,
  },
  partyType: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
});
