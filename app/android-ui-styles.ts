/**
 * Android UI Standard Styles Configuration
 * 
 * This file contains comprehensive styling configurations specifically optimized
 * for Android devices to ensure consistent UI/UX across different Android versions
 * and device manufacturers.
 */

// Device Detection Utilities
export const DeviceUtils = {
  isAndroid: (): boolean => {
    return /Android/i.test(navigator.userAgent);
  },
  
  getAndroidVersion: (): number => {
    const match = navigator.userAgent.match(/Android\s([0-9.]*)/);
    return match ? parseFloat(match[1]) : 0;
  },
  
  isChrome: (): boolean => {
    return /Chrome/i.test(navigator.userAgent);
  },
  
  isSamsung: (): boolean => {
    return /Samsung/i.test(navigator.userAgent);
  },
  
  hasNotch: (): boolean => {
    // Check for devices with notch/cutout
    const ratio = window.screen.height / window.screen.width;
    return ratio > 2 || window.screen.height >= 812;
  }
};

// Viewport and Screen Dimensions
export const ViewportConfig = {
  // Standard viewport meta tag configuration for Android
  metaViewport: 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover',
  
  // Safe area calculations for Android devices
  safeArea: {
    top: 24, // Standard Android status bar height in px
    bottom: 0, // Navigation bar handled separately
    left: 0,
    right: 0,
  },
  
  // Navigation bar heights for different Android versions
  navigationBarHeight: {
    standard: 48, // dp converted to px
    androidPie: 56, // Android 9+
    gestureNav: 24, // Android 10+ with gesture navigation
  },
  
  // Get actual safe dimensions
  getSafeDimensions: () => {
    const statusBarHeight = DeviceUtils.hasNotch() ? 32 : 24;
    const navBarHeight = DeviceUtils.getAndroidVersion() >= 10 ? 24 : 48;
    
    return {
      width: window.innerWidth,
      height: window.innerHeight - statusBarHeight - navBarHeight,
      statusBarHeight,
      navBarHeight,
    };
  }
};

// Base Container Styles
export const ContainerStyles = {
  // Root container that ensures content stays within screen bounds
  rootContainer: {
    position: 'relative' as const,
    width: '100%',
    height: '100vh',
    maxWidth: '100vw',
    overflow: 'hidden',
    boxSizing: 'border-box' as const,
    // Prevent horizontal scroll
    overflowX: 'hidden' as const,
    // Handle safe areas
    paddingTop: 'env(safe-area-inset-top, 24px)',
    paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    paddingLeft: 'env(safe-area-inset-left, 0px)',
    paddingRight: 'env(safe-area-inset-right, 0px)',
  },
  
  // Scrollable content container
  scrollContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
    overflowY: 'auto' as const,
    overflowX: 'hidden' as const,
    // Smooth scrolling with momentum
    WebkitOverflowScrolling: 'touch' as const,
    // Prevent overscroll bounce
    overscrollBehavior: 'contain' as const,
    // Hide scrollbar on Android
    scrollbarWidth: 'none' as const,
    '&::-webkit-scrollbar': {
      display: 'none',
    },
  },
  
  // Fixed header container
  headerContainer: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    width: '100%',
    zIndex: 1000,
    backgroundColor: '#ffffff',
    // Account for status bar
    paddingTop: 'env(safe-area-inset-top, 24px)',
    // Standard Android app bar height
    height: 'calc(56px + env(safe-area-inset-top, 24px))',
    // Shadow for Material Design
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  
  // Fixed bottom navigation
  bottomNavContainer: {
    position: 'fixed' as const,
    bottom: 0,
    left: 0,
    right: 0,
    width: '100%',
    zIndex: 1000,
    backgroundColor: '#ffffff',
    // Account for navigation bar
    paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    // Standard bottom nav height
    height: 'calc(56px + env(safe-area-inset-bottom, 0px))',
    // Shadow for elevation
    boxShadow: '0 -2px 4px rgba(0,0,0,0.1)',
  },
  
  // Content area with proper spacing
  contentArea: {
    width: '100%',
    minHeight: '100%',
    paddingTop: 'calc(56px + env(safe-area-inset-top, 24px))', // Header height
    paddingBottom: 'calc(56px + env(safe-area-inset-bottom, 0px))', // Bottom nav height
    boxSizing: 'border-box' as const,
  },
};

// Typography Styles (Material Design for Android)
export const TypographyStyles = {
  // Display styles
  display1: {
    fontSize: '34px',
    lineHeight: '40px',
    fontWeight: 400,
    letterSpacing: '0px',
    // Prevent text overflow
    wordWrap: 'break-word' as const,
    overflowWrap: 'break-word' as const,
  },
  
  // Headline styles
  headline1: {
    fontSize: '24px',
    lineHeight: '32px',
    fontWeight: 400,
    letterSpacing: '0px',
    wordWrap: 'break-word' as const,
  },
  
  headline2: {
    fontSize: '20px',
    lineHeight: '28px',
    fontWeight: 500,
    letterSpacing: '0.15px',
    wordWrap: 'break-word' as const,
  },
  
  // Body text
  body1: {
    fontSize: '16px',
    lineHeight: '24px',
    fontWeight: 400,
    letterSpacing: '0.5px',
    wordWrap: 'break-word' as const,
  },
  
  body2: {
    fontSize: '14px',
    lineHeight: '20px',
    fontWeight: 400,
    letterSpacing: '0.25px',
    wordWrap: 'break-word' as const,
  },
  
  // Caption and overline
  caption: {
    fontSize: '12px',
    lineHeight: '16px',
    fontWeight: 400,
    letterSpacing: '0.4px',
    wordWrap: 'break-word' as const,
  },
  
  // Button text
  button: {
    fontSize: '14px',
    lineHeight: '16px',
    fontWeight: 500,
    letterSpacing: '1.25px',
    textTransform: 'uppercase' as const,
  },
};

// Touch and Interaction Styles
export const TouchStyles = {
  // Touchable area (minimum 48x48dp for Android)
  touchTarget: {
    minWidth: '48px',
    minHeight: '48px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    // Disable text selection
    userSelect: 'none' as const,
    WebkitUserSelect: 'none' as const,
    // Disable tap highlight on Android
    WebkitTapHighlightColor: 'transparent',
    // Remove touch feedback to eliminate ripple
    transition: 'none',
    '&:active': {
      backgroundColor: 'transparent',
    },
  },
  
  // Button styles with proper touch areas
  button: {
    minWidth: '64px',
    minHeight: '36px',
    padding: '8px 16px',
    borderRadius: '4px',
    border: 'none',
    fontSize: '14px',
    fontWeight: 500,
    letterSpacing: '1.25px',
    textTransform: 'uppercase' as const,
    cursor: 'pointer',
    userSelect: 'none' as const,
    WebkitUserSelect: 'none' as const,
    WebkitTapHighlightColor: 'transparent',
    transition: 'none',
    // Ensure touch target
    touchAction: 'manipulation' as const,
  },
  
  // FAB (Floating Action Button)
  fab: {
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    userSelect: 'none' as const,
    WebkitTapHighlightColor: 'transparent',
    boxShadow: '0 6px 10px rgba(0,0,0,0.2)',
    transition: 'none',
  },
};

// Input and Form Styles
export const InputStyles = {
  // Text input field
  textInput: {
    width: '100%',
    minHeight: '56px',
    padding: '16px',
    fontSize: '16px', // Prevents zoom on focus in Android
    lineHeight: '24px',
    border: '1px solid rgba(0, 0, 0, 0.12)',
    borderRadius: '4px',
    backgroundColor: '#ffffff',
    boxSizing: 'border-box' as const,
    // Disable auto-zoom on Android
    touchAction: 'manipulation' as const,
    // Remove default styling
    WebkitAppearance: 'none' as const,
    appearance: 'none' as const,
    // Focus styles
    '&:focus': {
      outline: 'none',
      borderColor: '#1976d2',
      borderWidth: '2px',
    },
  },
  
  // Textarea
  textArea: {
    width: '100%',
    minHeight: '100px',
    padding: '16px',
    fontSize: '16px',
    lineHeight: '24px',
    border: '1px solid rgba(0, 0, 0, 0.12)',
    borderRadius: '4px',
    backgroundColor: '#ffffff',
    boxSizing: 'border-box' as const,
    resize: 'vertical' as const,
    WebkitAppearance: 'none' as const,
    appearance: 'none' as const,
    // Prevent auto-resize issues
    maxWidth: '100%',
  },
  
  // Select dropdown
  select: {
    width: '100%',
    minHeight: '56px',
    padding: '16px',
    fontSize: '16px',
    border: '1px solid rgba(0, 0, 0, 0.12)',
    borderRadius: '4px',
    backgroundColor: '#ffffff',
    boxSizing: 'border-box' as const,
    WebkitAppearance: 'none' as const,
    appearance: 'none' as const,
    backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\'%3e%3cpath d=\'M7 10l5 5 5-5z\'/%3e%3c/svg%3e")',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 16px center',
    backgroundSize: '24px',
    paddingRight: '48px',
  },
  
  // Checkbox and Radio
  checkbox: {
    width: '18px',
    height: '18px',
    minWidth: '18px',
    minHeight: '18px',
    margin: '15px', // To make touch target 48x48
    cursor: 'pointer',
    WebkitAppearance: 'none' as const,
    appearance: 'none' as const,
    border: '2px solid rgba(0, 0, 0, 0.54)',
    borderRadius: '2px',
    transition: 'none',
    '&:checked': {
      backgroundColor: '#1976d2',
      borderColor: '#1976d2',
    },
  },
};

// List and Card Styles
export const ListStyles = {
  // List container
  listContainer: {
    width: '100%',
    padding: 0,
    margin: 0,
    listStyle: 'none',
    boxSizing: 'border-box' as const,
  },
  
  // List item
  listItem: {
    width: '100%',
    minHeight: '48px',
    padding: '12px 16px',
    display: 'flex',
    alignItems: 'center',
    boxSizing: 'border-box' as const,
    borderBottom: '1px solid rgba(0, 0, 0, 0.12)',
    cursor: 'pointer',
    transition: 'none',
    WebkitTapHighlightColor: 'transparent',
    '&:active': {
      backgroundColor: 'transparent',
    },
  },
  
  // Card container
  card: {
    width: '100%',
    padding: '16px',
    backgroundColor: '#ffffff',
    borderRadius: '4px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    boxSizing: 'border-box' as const,
    // Prevent content overflow
    overflow: 'hidden',
    wordWrap: 'break-word' as const,
  },
  
  // Card with image
  cardMedia: {
    width: '100%',
    height: 'auto',
    maxWidth: '100%',
    objectFit: 'cover' as const,
    // Prevent image from breaking layout
    display: 'block',
  },
};

// Grid and Layout Styles
export const LayoutStyles = {
  // Flexible row layout
  flexRow: {
    display: 'flex',
    flexDirection: 'row' as const,
    width: '100%',
    boxSizing: 'border-box' as const,
    // Prevent overflow
    flexWrap: 'wrap' as const,
  },
  
  // Flexible column layout
  flexColumn: {
    display: 'flex',
    flexDirection: 'column' as const,
    width: '100%',
    boxSizing: 'border-box' as const,
  },
  
  // Grid layout
  grid: {
    display: 'grid',
    width: '100%',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '16px',
    boxSizing: 'border-box' as const,
  },
  
  // Centered content
  centerContent: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
  },
  
  // Spacing utilities
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
  },
};

// Modal and Dialog Styles
export const ModalStyles = {
  // Overlay
  overlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px',
    boxSizing: 'border-box' as const,
  },
  
  // Modal container
  modal: {
    width: '100%',
    maxWidth: '480px',
    maxHeight: '90vh',
    backgroundColor: '#ffffff',
    borderRadius: '4px',
    boxShadow: '0 11px 15px rgba(0,0,0,0.2)',
    overflow: 'auto',
    WebkitOverflowScrolling: 'touch' as const,
    // Ensure modal doesn't go off-screen
    margin: 'auto',
    position: 'relative' as const,
  },
  
  // Bottom sheet
  bottomSheet: {
    position: 'fixed' as const,
    bottom: 0,
    left: 0,
    right: 0,
    width: '100%',
    backgroundColor: '#ffffff',
    borderTopLeftRadius: '16px',
    borderTopRightRadius: '16px',
    boxShadow: '0 -4px 12px rgba(0,0,0,0.15)',
    paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    maxHeight: '90vh',
    overflow: 'auto',
    WebkitOverflowScrolling: 'touch' as const,
  },
};

// Animation Styles
export const AnimationStyles = {
  // Slide animations
  slideIn: {
    animation: 'slideIn 0.3s ease-out',
    '@keyframes slideIn': {
      from: {
        transform: 'translateX(100%)',
      },
      to: {
        transform: 'translateX(0)',
      },
    },
  },
  
  // Fade animations
  fadeIn: {
    animation: 'fadeIn 0.3s ease-out',
    '@keyframes fadeIn': {
      from: {
        opacity: 0,
      },
      to: {
        opacity: 1,
      },
    },
  },
  
  // Scale animations
  scaleIn: {
    animation: 'scaleIn 0.3s ease-out',
    '@keyframes scaleIn': {
      from: {
        transform: 'scale(0.8)',
        opacity: 0,
      },
      to: {
        transform: 'scale(1)',
        opacity: 1,
      },
    },
  },
};

// Utility Functions
export const UIUtils = {
  // Apply Android-specific styles
  applyAndroidStyles: (styles: any) => {
    if (DeviceUtils.isAndroid()) {
      return {
        ...styles,
        WebkitTapHighlightColor: 'transparent',
        WebkitUserSelect: 'none',
        touchAction: 'manipulation',
      };
    }
    return styles;
  },
  
  // Get status bar height
  getStatusBarHeight: (): number => {
    if (DeviceUtils.hasNotch()) {
      return 32;
    }
    return 24;
  },
  
  // Get navigation bar height
  getNavBarHeight: (): number => {
    if (DeviceUtils.getAndroidVersion() >= 10) {
      return 24; // Gesture navigation
    }
    return 48; // Traditional navigation buttons
  },
  
  // Calculate safe content height
  getSafeContentHeight: (): number => {
    return window.innerHeight - UIUtils.getStatusBarHeight() - UIUtils.getNavBarHeight();
  },
  
  // Prevent body scroll (useful for modals)
  preventBodyScroll: (prevent: boolean) => {
    if (prevent) {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
    } else {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    }
  },
  
  // Handle keyboard visibility
  handleKeyboard: {
    onShow: (callback: () => void) => {
      window.addEventListener('resize', () => {
        if (window.innerHeight < window.screen.height * 0.75) {
          callback();
        }
      });
    },
    onHide: (callback: () => void) => {
      window.addEventListener('resize', () => {
        if (window.innerHeight > window.screen.height * 0.75) {
          callback();
        }
      });
    },
  },
};

// Theme Configuration
export const ThemeConfig = {
  // Material Design color palette
  colors: {
    primary: '#1976d2',
    primaryDark: '#004ba0',
    primaryLight: '#63a4ff',
    secondary: '#dc004e',
    secondaryDark: '#9a0036',
    secondaryLight: '#ff5983',
    background: '#f5f5f5',
    surface: '#ffffff',
    error: '#f44336',
    warning: '#ff9800',
    info: '#2196f3',
    success: '#4caf50',
    onPrimary: '#ffffff',
    onSecondary: '#ffffff',
    onBackground: '#000000',
    onSurface: '#000000',
    onError: '#ffffff',
    divider: 'rgba(0, 0, 0, 0.12)',
    disabled: 'rgba(0, 0, 0, 0.38)',
  },
  
  // Elevation shadows (Material Design)
  elevation: {
    0: 'none',
    1: '0 2px 1px -1px rgba(0,0,0,0.2), 0 1px 1px 0 rgba(0,0,0,0.14), 0 1px 3px 0 rgba(0,0,0,0.12)',
    2: '0 3px 1px -2px rgba(0,0,0,0.2), 0 2px 2px 0 rgba(0,0,0,0.14), 0 1px 5px 0 rgba(0,0,0,0.12)',
    3: '0 3px 3px -2px rgba(0,0,0,0.2), 0 3px 4px 0 rgba(0,0,0,0.14), 0 1px 8px 0 rgba(0,0,0,0.12)',
    4: '0 2px 4px -1px rgba(0,0,0,0.2), 0 4px 5px 0 rgba(0,0,0,0.14), 0 1px 10px 0 rgba(0,0,0,0.12)',
    6: '0 3px 5px -1px rgba(0,0,0,0.2), 0 6px 10px 0 rgba(0,0,0,0.14), 0 1px 18px 0 rgba(0,0,0,0.12)',
    8: '0 5px 5px -3px rgba(0,0,0,0.2), 0 8px 10px 1px rgba(0,0,0,0.14), 0 3px 14px 2px rgba(0,0,0,0.12)',
    12: '0 7px 8px -4px rgba(0,0,0,0.2), 0 12px 17px 2px rgba(0,0,0,0.14), 0 5px 22px 4px rgba(0,0,0,0.12)',
    16: '0 8px 10px -5px rgba(0,0,0,0.2), 0 16px 24px 2px rgba(0,0,0,0.14), 0 6px 30px 5px rgba(0,0,0,0.12)',
    24: '0 11px 15px -7px rgba(0,0,0,0.2), 0 24px 38px 3px rgba(0,0,0,0.14), 0 9px 46px 8px rgba(0,0,0,0.12)',
  },
  
  // Border radius
  borderRadius: {
    small: '4px',
    medium: '8px',
    large: '16px',
    round: '50%',
  },
};

// Performance Optimizations
export const PerformanceStyles = {
  // Hardware acceleration
  accelerated: {
    transform: 'translateZ(0)',
    backfaceVisibility: 'hidden' as const,
    perspective: 1000,
    willChange: 'transform',
  },
  
  // Optimize animations
  smoothAnimation: {
    transition: 'none',
  },
  
  // Optimize scrolling
  optimizedScroll: {
    overflowY: 'auto' as const,
    WebkitOverflowScrolling: 'touch' as const,
    overscrollBehavior: 'contain' as const,
    scrollbarWidth: 'none' as const,
    '&::-webkit-scrollbar': {
      display: 'none',
    },
  },
  
  // Image optimization
  optimizedImage: {
    loading: 'lazy' as const,
    decoding: 'async' as const,
    willChange: 'transform',
  },
};

// Export all styles as a single object for easy access
export const AndroidUI = {
  DeviceUtils,
  ViewportConfig,
  ContainerStyles,
  TypographyStyles,
  TouchStyles,
  InputStyles,
  ListStyles,
  LayoutStyles,
  ModalStyles,
  AnimationStyles,
  UIUtils,
  ThemeConfig,
  PerformanceStyles,
};

// Default export for convenience
export default AndroidUI;