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
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { Colors } from '../../constants/Colors';
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

interface Item {
  id: string;
  productName: string;
  category: 'Primary' | 'Kirana';
  purchasePrice: number;
  salePrice: number;
  openingStock: number; // in bags
  asOfDate: string;
  lowStockAlert: number; // in bags
  createdAt: string;
  updatedAt: string;
}

export default function ItemsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [filteredItems, setFilteredItems] = useState<Item[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<'Primary' | 'Kirana'>('Primary');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [activeFilterOptions, setActiveFilterOptions] = useState({
    all: true,
    primary: false,
    kirana: false,
  });
  const [tempFilterOptions, setTempFilterOptions] = useState({
    all: true,
    primary: false,
    kirana: false,
  });
  
  // Form states
  const [itemForm, setItemForm] = useState({
    productName: '',
    category: 'Primary' as 'Primary' | 'Kirana',
    purchasePrice: '',
    salePrice: '',
    openingStock: '',
    asOfDate: new Date().toISOString().split('T')[0], // Today's date in YYYY-MM-DD format
    lowStockAlert: '',
  });

  useEffect(() => {
    loadItems();
  }, []);

  useEffect(() => {
    filterItems();
  }, [items, searchQuery, activeFilterOptions]);

  // Reload items when screen comes into focus to reflect stock updates
  useFocusEffect(
    useCallback(() => {
      loadItems();
    }, [])
  );

  const loadItems = async () => {
    try {
      const itemsData = await Storage.getObject<Item[]>(STORAGE_KEYS.ITEMS);
      if (itemsData) {
        setItems(itemsData);
      }
    } catch (error) {
      console.error('Error loading items:', error);
    }
  };

  const filterItems = () => {
    let filtered = items;
    
    // Apply search filter
    if (searchQuery.trim()) {
      filtered = filtered.filter(item =>
        item.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    // Apply category filter
    if (!activeFilterOptions.all) {
      const selectedCategories: string[] = [];
      if (activeFilterOptions.primary) selectedCategories.push('Primary');
      if (activeFilterOptions.kirana) selectedCategories.push('Kirana');
      
      if (selectedCategories.length > 0) {
        filtered = filtered.filter(item => selectedCategories.includes(item.category));
      }
    }
    
    setFilteredItems(filtered);
  };

  const handleFilterToggle = (filterType: 'all' | 'primary' | 'kirana') => {
    setTempFilterOptions(prev => {
      const newOptions = { ...prev };
      
      if (filterType === 'all') {
        newOptions.all = true;
        newOptions.primary = false;
        newOptions.kirana = false;
      } else {
        newOptions.all = false;
        newOptions[filterType] = !newOptions[filterType];
        
        // If no specific filters are selected, enable 'all'
        if (!newOptions.primary && !newOptions.kirana) {
          newOptions.all = true;
        }
      }
      
      return newOptions;
    });
  };

  const clearFilters = () => {
    setTempFilterOptions({
      all: true,
      primary: false,
      kirana: false,
    });
  };

  // Get items with low stock
  const getLowStockItems = () => {
    return items.filter(item => item.openingStock <= item.lowStockAlert);
  };



  const handleCreateItem = async () => {
    // Validate required fields
    const missingFields = [];
    if (!itemForm.productName.trim()) missingFields.push('Product Name');
    if (!itemForm.purchasePrice.trim()) missingFields.push('Purchase Price');
    if (!itemForm.salePrice.trim()) missingFields.push('Sale Price');
    if (!itemForm.openingStock.trim()) missingFields.push('Opening Stock');
    if (!itemForm.lowStockAlert.trim()) missingFields.push('Low Stock Alert');
    
    if (missingFields.length > 0) {
      Alert.alert('Error', `Please fill the following required fields:\n• ${missingFields.join('\n• ')}`);
      return;
    }

    // Validate numeric fields
    const purchasePrice = parseFloat(itemForm.purchasePrice);
    const salePrice = parseFloat(itemForm.salePrice);
    const openingStockKg = parseFloat(itemForm.openingStock);
    const lowStockAlertKg = parseFloat(itemForm.lowStockAlert);

    if (isNaN(purchasePrice) || purchasePrice < 0) {
      Alert.alert('Error', 'Please enter a valid purchase price');
      return;
    }

    if (isNaN(salePrice) || salePrice < 0) {
      Alert.alert('Error', 'Please enter a valid sale price');
      return;
    }

    if (isNaN(openingStockKg) || openingStockKg < 0) {
      Alert.alert('Error', 'Please enter a valid opening stock');
      return;
    }

    if (isNaN(lowStockAlertKg) || lowStockAlertKg < 0) {
      Alert.alert('Error', 'Please enter a valid low stock alert');
      return;
    }

    // Convert kg to bags (1 bag = 30 kg)
    const openingStockBags = openingStockKg / 30;
    const lowStockAlertBags = lowStockAlertKg / 30;

    // Check if product name already exists
    const existingItem = items.find(item => 
      item.productName.toLowerCase() === itemForm.productName.trim().toLowerCase()
    );

    if (existingItem) {
      Alert.alert('Error', 'A product with this name already exists');
      return;
    }

    const newItem: Item = {
      id: Date.now().toString(),
      productName: itemForm.productName.trim(),
      category: itemForm.category,
      purchasePrice,
      salePrice,
      openingStock: openingStockBags, // Store in bags
      asOfDate: itemForm.asOfDate,
      lowStockAlert: lowStockAlertBags, // Store in bags
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const updatedItems = [...items, newItem];
    setItems(updatedItems);
    
    // Reset form
    setItemForm({
      productName: '',
      category: 'Primary',
      purchasePrice: '',
      salePrice: '',
      openingStock: '',
      asOfDate: new Date().toISOString().split('T')[0],
      lowStockAlert: '',
    });
    setShowCreateModal(false);
    
    // Save to storage
    try {
      await Storage.setObject(STORAGE_KEYS.ITEMS, updatedItems);
      Alert.alert('Success', 'Product created successfully!');
    } catch (error) {
      console.error('Error saving item:', error);
      Alert.alert('Error', 'Failed to save product. Please try again.');
    }
  };

  const handleDeleteItem = async (itemId: string, itemName: string) => {
    Alert.alert(
      'Delete Product',
      `Are you sure you want to delete "${itemName}"? This action cannot be undone.`,
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
              const updatedItems = items.filter(item => item.id !== itemId);
              setItems(updatedItems);
              await Storage.setObject(STORAGE_KEYS.ITEMS, updatedItems);
              Alert.alert('Success', 'Product deleted successfully!');
            } catch (error) {
              console.error('Error deleting item:', error);
              Alert.alert('Error', 'Failed to delete product. Please try again.');
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: Item }) => (
    <View style={styles.itemCard}>
      <View style={styles.itemHeader}>
        <View style={styles.itemLeft}>
          <Text style={styles.itemName}>{item.productName}</Text>
          <View style={styles.itemCategory}>
            <View style={[
              styles.categoryBadge,
              { backgroundColor: item.category === 'Primary' ? Colors.primary + '20' : Colors.success + '20' }
            ]}>
              <Text style={[
                styles.categoryText,
                { color: item.category === 'Primary' ? Colors.primary : Colors.success }
              ]}>
                {item.category}
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.itemRight}>
          <View style={styles.priceRow}>
            <Text style={styles.itemPrice}>₹{item.salePrice.toLocaleString()}</Text>
            <TouchableOpacity
              style={styles.deleteIcon}
              onPress={() => handleDeleteItem(item.id, item.productName)}
            >
              <Ionicons name="trash-outline" size={16} color={Colors.error} />
            </TouchableOpacity>
          </View>
                     <View style={styles.stockRow}>
             <Text style={[
               styles.itemStock,
               item.openingStock <= item.lowStockAlert && styles.lowStockText
             ]}>
               Stock: {item.openingStock.toFixed(2)} bags ({Math.round(item.openingStock * 30)} kg)
             </Text>
             {item.openingStock <= item.lowStockAlert && (
               <Ionicons name="warning" size={16} color={Colors.error} />
             )}
           </View>
        </View>
      </View>
      
      <View style={styles.itemDetails}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Purchase Price:</Text>
          <Text style={styles.detailValue}>₹{item.purchasePrice.toLocaleString()}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Low Stock Alert:</Text>
          <Text style={[
            styles.detailValue,
            { color: item.openingStock <= item.lowStockAlert ? Colors.error : Colors.textSecondary }
          ]}>
            {item.lowStockAlert.toFixed(2)} bags ({Math.round(item.lowStockAlert * 30)} kg)
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>As of Date:</Text>
          <Text style={styles.detailValue}>{item.asOfDate}</Text>
        </View>
      </View>
    </View>
  );

  const renderCreateModal = () => (
    <Modal
      visible={showCreateModal}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <KeyboardAvoidingView 
        style={styles.modalContainer} 
        behavior="padding"
        keyboardVerticalOffset={100}
      >
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Create New Product</Text>
          <TouchableOpacity onPress={() => setShowCreateModal(false)}>
            <Ionicons name="close" size={24} color={Colors.text} />
          </TouchableOpacity>
        </View>
        
        <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled">
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Product Details</Text>
            
            <Text style={styles.fieldLabel}>Product Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter product name..."
              placeholderTextColor={Colors.textTertiary}
              value={itemForm.productName}
              onChangeText={(text) => setItemForm(prev => ({ ...prev, productName: text }))}
            />
            
            <Text style={styles.fieldLabel}>Product Category *</Text>
            <View style={styles.categorySelector}>
              <TouchableOpacity
                style={[
                  styles.categoryOption,
                  itemForm.category === 'Primary' && styles.categoryOptionSelected
                ]}
                onPress={() => setItemForm(prev => ({ ...prev, category: 'Primary' }))}
              >
                <Text style={[
                  styles.categoryOptionText,
                  itemForm.category === 'Primary' && styles.categoryOptionTextSelected
                ]}>
                  Primary
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.categoryOption,
                  itemForm.category === 'Kirana' && styles.categoryOptionSelected
                ]}
                onPress={() => setItemForm(prev => ({ ...prev, category: 'Kirana' }))}
              >
                <Text style={[
                  styles.categoryOptionText,
                  itemForm.category === 'Kirana' && styles.categoryOptionTextSelected
                ]}>
                  Kirana
                </Text>
              </TouchableOpacity>
            </View>
            
            <Text style={styles.fieldLabel}>Purchase Price (₹) *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter purchase price..."
              placeholderTextColor={Colors.textTertiary}
              value={itemForm.purchasePrice}
              onChangeText={(text) => setItemForm(prev => ({ ...prev, purchasePrice: text }))}
              keyboardType="numeric"
            />
            
            <Text style={styles.fieldLabel}>Sale Price (₹) *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter sale price..."
              placeholderTextColor={Colors.textTertiary}
              value={itemForm.salePrice}
              onChangeText={(text) => setItemForm(prev => ({ ...prev, salePrice: text }))}
              keyboardType="numeric"
            />
            
            <Text style={styles.fieldLabel}>Opening Stock (Kg) *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter opening stock in kg..."
              placeholderTextColor={Colors.textTertiary}
              value={itemForm.openingStock}
              onChangeText={(text) => setItemForm(prev => ({ ...prev, openingStock: text }))}
              keyboardType="numeric"
            />
            <Text style={styles.helperText}>
              Note: 1 Bag = 30 Kg (Will be converted to bags automatically)
            </Text>
            
            <Text style={styles.fieldLabel}>As of Date *</Text>
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={Colors.textTertiary}
              value={itemForm.asOfDate}
              onChangeText={(text) => setItemForm(prev => ({ ...prev, asOfDate: text }))}
            />
            
            <Text style={styles.fieldLabel}>Low Stock Alert (Kg) *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter low stock alert threshold in kg..."
              placeholderTextColor={Colors.textTertiary}
              value={itemForm.lowStockAlert}
              onChangeText={(text) => setItemForm(prev => ({ ...prev, lowStockAlert: text }))}
              keyboardType="numeric"
            />
          </View>
        </ScrollView>
        
        <View style={styles.modalFooter}>
          <TouchableOpacity style={styles.cancelButton} onPress={() => setShowCreateModal(false)}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.createButton} onPress={handleCreateItem}>
            <Text style={styles.createButtonText}>Create Product</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
         </Modal>
   );

     const renderFilterModal = () => (
    <Modal
      visible={showFilterModal}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowFilterModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Filter Products</Text>
            <TouchableOpacity onPress={() => setShowFilterModal(false)}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.filterOptions}>
            <TouchableOpacity
              style={styles.checkboxContainer}
              onPress={() => handleFilterToggle('all')}
            >
              <View style={[
                styles.checkbox,
                tempFilterOptions.all && styles.checkboxChecked
              ]}>
                {tempFilterOptions.all && <Ionicons name="checkmark" size={16} color={Colors.text} />}
              </View>
              <Text style={styles.checkboxLabel}>All Categories</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.checkboxContainer}
              onPress={() => handleFilterToggle('primary')}
            >
              <View style={[
                styles.checkbox,
                tempFilterOptions.primary && styles.checkboxChecked
              ]}>
                {tempFilterOptions.primary && <Ionicons name="checkmark" size={16} color={Colors.text} />}
              </View>
              <Text style={styles.checkboxLabel}>Primary</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.checkboxContainer}
              onPress={() => handleFilterToggle('kirana')}
            >
              <View style={[
                styles.checkbox,
                tempFilterOptions.kirana && styles.checkboxChecked
              ]}>
                {tempFilterOptions.kirana && <Ionicons name="checkmark" size={16} color={Colors.text} />}
              </View>
              <Text style={styles.checkboxLabel}>Kirana</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.clearFiltersButton} onPress={clearFilters}>
              <Text style={styles.clearFiltersText}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.applyFiltersButton} onPress={() => {
              setActiveFilterOptions(tempFilterOptions);
              setShowFilterModal(false);
            }}>
              <Text style={styles.applyFiltersText}>Apply</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

   return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Items</Text>
      </View>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        // Android-specific: Optimize scrolling
        {...(isAndroid && {
          overScrollMode: 'never',
          nestedScrollEnabled: true,
        })}
      >
                 {/* Header Stats */}
         <View style={styles.headerStats}>
           <View style={styles.statCard}>
             <Text style={styles.statValue}>{items.length}</Text>
             <Text style={styles.statLabel}>Total Products</Text>
           </View>
                       <View style={styles.statCard}>
              <Text style={styles.statValue}>
                ₹{Math.round(items.reduce((total, item) => total + ((item.openingStock * 30) * item.purchasePrice), 0)).toLocaleString()}
              </Text>
              <Text style={styles.statLabel}>Total Stock Value</Text>
            </View>
                   </View>

          {/* Low Stock Alert Banner */}
          {getLowStockItems().length > 0 && (
            <TouchableOpacity 
              style={styles.lowStockAlert}
              onPress={() => {
                const lowStockItems = getLowStockItems();
                const itemNames = lowStockItems.map(item => 
                  `• ${item.productName}: ${item.openingStock.toFixed(2)} bags (${Math.round(item.openingStock * 30)} kg)`
                ).join('\n');
                Alert.alert(
                  'Low Stock Items',
                  `The following items are below their low stock threshold:\n\n${itemNames}`,
                  [{ text: 'OK', style: 'default' }]
                );
              }}
              activeOpacity={isAndroid ? 0.7 : 0.2}
              {...(isAndroid && {
                android_ripple: { color: ANDROID_CONSTANTS.rippleColor },
              })}
            >
              <Ionicons name="warning" size={20} color={Colors.error} />
              <Text style={styles.lowStockAlertText}>
                {getLowStockItems().length} item{getLowStockItems().length > 1 ? 's' : ''} below low stock threshold
              </Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.error} />
            </TouchableOpacity>
          )}

                  {/* Search Bar */}
          <View style={styles.searchContainer}>
           <View style={styles.searchBar}>
             <Ionicons name="search" size={20} color={Colors.textTertiary} />
             <TextInput
               style={styles.searchInput}
               placeholder="Search products..."
               placeholderTextColor={Colors.textTertiary}
               value={searchQuery}
               onChangeText={setSearchQuery}
             />
             {searchQuery.length > 0 && (
               <TouchableOpacity onPress={() => setSearchQuery('')}>
                 <Ionicons name="close-circle" size={20} color={Colors.textTertiary} />
               </TouchableOpacity>
             )}
                           <TouchableOpacity 
                style={[
                  styles.filterButton,
                  (!activeFilterOptions.all) && styles.filterButtonActive
                ]}
                onPress={() => {
                  setTempFilterOptions(activeFilterOptions);
                  setShowFilterModal(true);
                }}
              >
               <Ionicons 
                 name="filter" 
                 size={20} 
                 color={!activeFilterOptions.all ? Colors.text : Colors.textTertiary} 
               />
             </TouchableOpacity>
           </View>
         </View>

                 {/* Action Button */}
         <View style={styles.actionContainer}>
           <TouchableOpacity 
             style={styles.createButton} 
             onPress={() => setShowCreateModal(true)}
           >
             <Ionicons name="add-circle" size={24} color={Colors.text} />
             <Text style={styles.createButtonText}>Create New Product</Text>
           </TouchableOpacity>
         </View>

        {/* Items List */}
        <View style={styles.listContainer}>
          <Text style={styles.sectionTitle}>Products ({filteredItems.length})</Text>
          {filteredItems.length > 0 ? (
            <FlatList
              data={filteredItems}
              renderItem={renderItem}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
            />
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="cube-outline" size={64} color={Colors.textTertiary} />
              <Text style={styles.emptyStateTitle}>No Products Yet</Text>
              <Text style={styles.emptyStateSubtitle}>
                {searchQuery ? 'No products match your search' : 'Create your first product to get started'}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

             {renderCreateModal()}
       {renderFilterModal()}
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
    paddingTop: isAndroid ? 60 : 20, // Increased padding for Android status bar
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'left',
  },
  content: {
    flex: 1,
    // Android-specific: Optimize scrolling performance
    ...(isAndroid && {
      overScrollMode: 'never',
      nestedScrollEnabled: true,
    }),
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
    // Android-specific: Add elevation for Material Design
    ...(isAndroid && {
      elevation: ANDROID_CONSTANTS.elevation.low,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.22,
      shadowRadius: 2.22,
    }),
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
  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    // Android-specific: Add elevation and optimize input
    ...(isAndroid && {
      elevation: ANDROID_CONSTANTS.elevation.low,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.22,
      shadowRadius: 2.22,
    }),
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
   filterButton: {
     padding: 8,
     borderRadius: 8,
     backgroundColor: Colors.surface,
     // Android-specific: Ensure minimum touch target
     minWidth: ANDROID_CONSTANTS.touchTargetMinSize,
     minHeight: ANDROID_CONSTANTS.touchTargetMinSize,
     justifyContent: 'center',
     alignItems: 'center',
   },
   filterButtonActive: {
     backgroundColor: Colors.primary + '20',
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
  itemCard: {
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
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  itemLeft: {
    flex: 1,
  },
  itemName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 8,
  },
  itemCategory: {
    flexDirection: 'row',
    gap: 8,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
  },
  itemRight: {
    alignItems: 'flex-end',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.success,
  },
  deleteIcon: {
    padding: 4,
    // Android-specific: Ensure minimum touch target
    minWidth: ANDROID_CONSTANTS.touchTargetMinSize,
    minHeight: ANDROID_CONSTANTS.touchTargetMinSize,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemStock: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  itemDetails: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  detailLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
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
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text,
  },
     filterOptions: {
     marginBottom: 20,
   },
  formSection: {
    marginBottom: 20,
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
  helperText: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: -12,
    marginBottom: 16,
    marginLeft: 4,
    fontStyle: 'italic',
  },
  categorySelector: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  categoryOption: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    // Android-specific: Ensure minimum touch target
    minHeight: ANDROID_CONSTANTS.touchTargetMinSize,
    justifyContent: 'center',
  },
  categoryOptionSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  categoryOptionText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  categoryOptionTextSelected: {
    color: Colors.text,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  cancelButton: {
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
   applyFiltersText: {
     fontSize: 16,
     fontWeight: '500',
     color: Colors.text,
   },
   checkboxContainer: {
     flexDirection: 'row',
     alignItems: 'center',
     paddingVertical: 12,
     // Android-specific: Ensure minimum touch target
     minHeight: ANDROID_CONSTANTS.touchTargetMinSize,
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
   modalContainer: {
     flex: 1,
     backgroundColor: Colors.background,
   },
   modalFooter: {
     flexDirection: 'row',
     gap: 12,
     padding: 20,
     borderTopWidth: 1,
     borderTopColor: Colors.border,
   },
       cancelButtonText: {
      fontSize: 16,
      fontWeight: '500',
      color: Colors.textSecondary,
    },
      lowStockAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.error + '20',
    borderWidth: 1,
    borderColor: Colors.error,
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 16,
    gap: 12,
    // Android-specific: Add elevation for Material Design
    ...(isAndroid && {
      elevation: ANDROID_CONSTANTS.elevation.low,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.22,
      shadowRadius: 2.22,
    }),
  },
    lowStockAlertText: {
      fontSize: 16,
      fontWeight: '600',
      color: Colors.error,
      flex: 1,
    },
    stockRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    lowStockText: {
      color: Colors.error,
      fontWeight: '600',
    },
  });
