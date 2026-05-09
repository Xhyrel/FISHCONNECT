import React, { useState, useEffect } from 'react';
import './App.css';
import AuthModal from './AuthModal';

const HERO_IMAGES = [
  'https://images.unsplash.com/photo-1534948216015-843149f72be3?q=80&w=1200&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1550989460-0adf9ea622e2?q=80&w=1200&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1615141982883-c7ad0e69fd62?q=80&w=1200&auto=format&fit=crop'
];

// API Base URL - Change this to your backend URL
const API_URL = 'http://localhost:5000/api';

function App() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState([]);
  const [view, setView] = useState('home');
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [heroImageIndex, setHeroImageIndex] = useState(0);
  const [quantities, setQuantities] = useState({});
  const [newProduct, setNewProduct] = useState({ name: '', price: '', stock: '', category: 'Fish', images: [],imageFiles: [],description: '' });
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [orders, setOrders] = useState([]);
  const [paymentProof, setPaymentProof] = useState(null);
  const [paymentProofPreview, setPaymentProofPreview] = useState(null);
  const [wishlist, setWishlist] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [showCancelModal, setShowCancelModal] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchOrder, setSearchOrder] = useState('');
  const [vendors, setVendors] = useState([]);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  // Helper function to get auth headers
 const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : ''
  };
};



  // ============== DATABASE CONNECTION FUNCTIONS ==============
  
  // FETCH PRODUCTS FROM DATABASE
const fetchProducts = async () => {
  try {
    setLoading(true);
    const response = await fetch(`${API_URL}/products`);
    
    if (response.ok) {
      const data = await response.json();
      console.log('Products data received:', data);
      
      const formatted = data.map(p => {
        // Fix: Add base URL to images
        let images = [];
        if (p.images && Array.isArray(p.images)) {
          images = p.images.map(img => {
            if (img.startsWith('/uploads/')) {
              return `http://localhost:5000${img}`;
            }
            return img;
          });
        } else if (p.image_url) {
          try {
            const parsed = JSON.parse(p.image_url);
            images = Array.isArray(parsed) ? parsed.map(img => 
              img.startsWith('/uploads/') ? `http://localhost:5000${img}` : img
            ) : [p.image_url];
          } catch {
            images = [p.image_url];
          }
        }
        
        if (images.length === 0) {
          images = ['https://via.placeholder.com/300x200?text=No+Image'];
        }
        
        // Calculate average rating from reviews
        const productReviews = reviews.filter(r => Number(r.productId) === Number(p.id));
        let averageRating = 5; // Default to 5 if no reviews
        let ratingCount = 0;
        
        if (productReviews.length > 0) {
          const sum = productReviews.reduce((acc, r) => acc + r.rating, 0);
          averageRating = sum / productReviews.length;
          ratingCount = productReviews.length;
        } else if (p.average_rating && p.average_rating > 0) {
          averageRating = parseFloat(p.average_rating);
          ratingCount = p.rating_count || 0;
        }
        
        return {
          id: p.id,
          vendor_id: p.vendor_id,
          vendor: p.vendor_name || 'Unknown Vendor',
          name: p.name,
          price: p.price,
          stock: p.stock_kg,
          category: p.category,
          images: images,
          description: p.description,
          stars: averageRating,
          ratingCount: ratingCount,
          is_available: p.is_available !== 0
        };
      });
      
      console.log('Formatted products with ratings:', formatted);
      setProducts(formatted);
    }
  } catch (error) {
    console.error("Failed to fetch products:", error);
  } finally {
    setLoading(false);
  }
};
  // FETCH VENDORS
  const fetchVendors = async () => {
    try {
      const response = await fetch(`${API_URL}/vendors`);
      if (response.ok) {
        const data = await response.json();
        setVendors(data);
      }
    } catch (error) {
      console.error("Failed to fetch vendors:", error);
    }
  };

  // ADD NEW PRODUCT (Seller)
  const addProductToDB = async (productData) => {
    try {
      const formData = new FormData();
      formData.append('name', productData.name);
      formData.append('price', productData.price);
      formData.append('stock_kg', productData.stock);
      formData.append('category', productData.category);
      formData.append('description', productData.description || '');
      
      // Handle multiple images
      productData.imageFiles.forEach(file => {
        formData.append('images', file);
      });
      
      const response = await fetch(`${API_URL}/products`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });
      
      if (!response.ok) throw new Error('Failed to add product');
      
      const newProduct = await response.json();
      await fetchProducts(); // Refresh products list
      return newProduct;
    } catch (error) {
      console.error("Error adding product:", error);
      throw error;
    }
  };

  // DELETE PRODUCT (Seller)
  const deleteProductFromDB = async (productId) => {
    try {
      const response = await fetch(`${API_URL}/products/${productId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      
      if (!response.ok) throw new Error('Failed to delete product');
      
      await fetchProducts(); // Refresh products list
      return true;
    } catch (error) {
      console.error("Error deleting product:", error);
      return false;
    }
  };

  // UPDATE PRODUCT STOCK (After order)
  const updateProductStock = async (productId, newStock) => {
    try {
      const response = await fetch(`${API_URL}/products/${productId}/stock`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ stock_kg: newStock })
      });
      
      if (!response.ok) throw new Error('Failed to update stock');
      return true;
    } catch (error) {
      console.error("Error updating stock:", error);
      return false;
    }
  };

  // CREATE ORDER
  const createOrder = async (orderData) => {
    try {
      const response = await fetch(`${API_URL}/orders`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(orderData)
      });
      
      if (!response.ok) throw new Error('Failed to create order');
      
      const newOrder = await response.json();
      await fetchOrders(); // Refresh orders
      return newOrder;
    } catch (error) {
      console.error("Error creating order:", error);
      throw error;
    }
  };

 const fetchOrders = async () => {
  try {
    const token = localStorage.getItem('token');
    if (!token) return;
    
    const response = await fetch(`${API_URL}/orders`, {
      headers: getAuthHeaders()
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('Raw orders from backend:', data);
      
      // Format orders to match frontend expectations
      const formatted = data.map(order => ({
        id: order.id,
        orderNumber: order.orderNumber,
        buyerId: order.buyerId,
        vendorId: order.vendorId,
        vendorName: order.vendorName,  // FIXED: Use vendorName from backend
        buyerName: order.buyerName,
        items: order.items || [],
        totalAmount: order.totalAmount,
        paymentMethod: order.paymentMethod,
        paymentProof: order.paymentProof,
        orderDate: order.orderDate,
        status: order.status,
        cancellationReason: order.cancellationReason,
        recipientName: order.recipientName,
        mobileNumber: order.mobileNumber,
        shippingAddress: order.shippingAddress,
        tracking: {
          status: order.status,
          history: order.tracking?.history || [
            { 
              status: order.status, 
              date: order.orderDate, 
              description: `Order ${order.status === 'pending_confirmation' ? 'placed' : order.status}` 
            }
          ]
        }
      }));
      
      setOrders(formatted);
      console.log('Formatted orders:', formatted);
    }
  } catch (error) {
    console.error("Error fetching orders:", error);
  }
};

  // UPDATE ORDER STATUS
  const updateOrderStatus = async (orderId, newStatus, description = '') => {
    try {
      const response = await fetch(`${API_URL}/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status: newStatus, description })
      });
      
      if (!response.ok) throw new Error('Failed to update order status');
      
      await fetchOrders(); // Refresh orders
      return true;
    } catch (error) {
      console.error("Error updating order status:", error);
      return false;
    }
  };

  // CANCEL ORDER
  const cancelOrderInDB = async (orderId, reason) => {
    try {
      const response = await fetch(`${API_URL}/orders/${orderId}/cancel`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ cancel_reason: reason })
      });
      
      if (!response.ok) throw new Error('Failed to cancel order');
      
      await fetchOrders(); // Refresh orders
      return true;
    } catch (error) {
      console.error("Error cancelling order:", error);
      return false;
    }
  };



  // FETCH REVIEWS
  const fetchReviews = async () => {
    try {
      const response = await fetch(`${API_URL}/reviews`);
      if (response.ok) {
        const data = await response.json();
        const formatted = data.map(r => ({
          id: r.id,
          orderId: r.order_id,
          productId: r.product_id,
          userId: r.buyer_name || r.buyer_id,
          userName: r.buyer_name || 'User',
          rating: r.rating,
          comment: r.comment,
          date: r.review_date
        }));
        setReviews(formatted);
      }
    } catch (error) {
      console.error("Error fetching reviews:", error);
    }
  };

  // FETCH WISHLIST
  const fetchWishlist = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      
      const response = await fetch(`${API_URL}/wishlist`, {
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        const data = await response.json();
        const formatted = data.map(item => ({
          id: item.product_id,
          vendor: item.vendor_name,
          name: item.product_name,
          price: parseFloat(item.price),
          stock: parseFloat(item.stock_kg),
          category: item.category,
          images: item.image_url ? [item.image_url] : ['https://via.placeholder.com/300x200?text=No+Image']
        }));
        setWishlist(formatted);
      }
    } catch (error) {
      console.error("Error fetching wishlist:", error);
    }
  };

  // ADD TO WISHLIST
  const addToWishlistDB = async (productId) => {
    try {
      const response = await fetch(`${API_URL}/wishlist`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ product_id: productId })
      });
      
      if (!response.ok) throw new Error('Failed to add to wishlist');
      
      await fetchWishlist(); // Refresh wishlist
      return true;
    } catch (error) {
      console.error("Error adding to wishlist:", error);
      return false;
    }
  };

  // REMOVE FROM WISHLIST
  const removeFromWishlistDB = async (productId) => {
    try {
      const response = await fetch(`${API_URL}/wishlist/${productId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      
      if (!response.ok) throw new Error('Failed to remove from wishlist');
      
      await fetchWishlist(); // Refresh wishlist
      return true;
    } catch (error) {
      console.error("Error removing from wishlist:", error);
      return false;
    }
  };

  // USER LOGIN/REGISTER
  const handleAuthSuccess = (authData) => {
  console.log('Auth success:', authData);
  setCurrentUser(authData.user);
  localStorage.setItem('token', authData.token);
  localStorage.setItem('user', JSON.stringify(authData.user));
  setIsAuthOpen(false);
  setView(authData.user.role === 'seller' ? 'sellerDashboard' : 'home');
  
  // Fetch all data after login
  fetchProducts();
  fetchOrders();
  fetchWishlist();
  fetchReviews();
};

  // USER LOGOUT
  const handleLogout = async () => {
    const confirmLogout = window.confirm("Are you sure you want to log out?");
    if (confirmLogout) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setCurrentUser(null);
      setCart([]);
      setWishlist([]);
      setOrders([]);
      setView('home');
      alert("You have been successfully logged out.");
    }
  };

  // Load user from localStorage on mount
  useEffect(() => {
    const loadUser = async () => {
      const token = localStorage.getItem('token');
      const savedUser = localStorage.getItem('user');
      
      if (token && savedUser) {
        const user = JSON.parse(savedUser);
        setCurrentUser(user);
        setView(user.role === 'seller' ? 'sellerDashboard' : 'home');
      }
      
      // Load all data
      await fetchProducts();
      await fetchVendors();
      await fetchReviews();
      
      if (token) {
        await fetchOrders();
        await fetchWishlist();
      }
    };
    
    loadUser();
  }, []);

  // Hero image slideshow
  useEffect(() => {
    const interval = setInterval(() => {
      setHeroImageIndex((prevIndex) => (prevIndex + 1) % HERO_IMAGES.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Save cart to localStorage
  useEffect(() => {
    localStorage.setItem('fishconnect_cart', JSON.stringify(cart));
  }, [cart]);

  // Refresh reviews when product modal opens
useEffect(() => {
  if (selectedProduct) {
    fetchReviews();
  }
}, [selectedProduct]);

// Refresh products when reviews are updated
useEffect(() => {
  fetchProducts();
}, [reviews]);

// Close profile dropdown when clicking outside
useEffect(() => {
  const handleClickOutside = (event) => {
    if (showProfileMenu && !event.target.closest('.profile-dropdown')) {
      setShowProfileMenu(false);
    }
  };
  document.addEventListener('mousedown', handleClickOutside);
  return () => document.removeEventListener('mousedown', handleClickOutside);
}, [showProfileMenu]);

  const categories = ['Fish', 'Shellfish', 'Crabs', 'Squid'];
  const vendorProducts = products.filter(p => p.vendor_id === currentUser?.id);
  const buyerOrders = orders.filter(order => order.buyerId === currentUser?.name || order.buyerId === currentUser?.id);
  const sellerOrders = orders.filter(order => order.vendorId === currentUser?.name || order.vendorId === currentUser?.id);

  const handleQuantityChange = (productId, value, maxStock) => {
    let val = parseInt(value);
    if (val > maxStock) {
      alert(`Invalid! Only ${maxStock}kg available in stock.`);
      val = maxStock;
    }
    setQuantities({ ...quantities, [productId]: val || '' });
  };

  const addToCart = (product, e) => {
    if (e) e.stopPropagation();
    const kilos = parseInt(quantities[product.id]) || 1;
    if (kilos > product.stock) return alert(`Sorry! Only ${product.stock}kg available.`);
    
    const existingItem = cart.find(item => item.id === product.id);
    if (existingItem) {
      if (existingItem.quantity + kilos > product.stock) {
         return alert(`You already have ${existingItem.quantity}kg in your cart. You cannot exceed the stock of ${product.stock}kg.`);
      }
      setCart(cart.map(item => item.id === product.id ? { ...item, quantity: item.quantity + kilos } : item));
    } else {
      setCart([...cart, { ...product, quantity: kilos }]);
    }
    alert(`${kilos}kg of ${product.name} added to your cart!`);
  };

  // Wishlist Functions
  const addToWishlist = async (product, e) => {
    if (e) e.stopPropagation();
    if (!currentUser) {
      alert("Please login to add items to wishlist");
      setIsAuthOpen(true);
      return;
    }
    if (currentUser.role === 'seller') {
      alert("Sellers cannot use wishlist. Please login as buyer.");
      return;
    }
    
    const exists = wishlist.find(item => item.id === product.id);
    if (exists) {
      await removeFromWishlistDB(product.id);
      alert(`${product.name} removed from wishlist`);
    } else {
      await addToWishlistDB(product.id);
      alert(`${product.name} added to wishlist`);
    }
  };

  const isInWishlist = (productId) => {
    return wishlist.some(item => item.id === productId);
  };

  // Review Functions
// KEEP THIS NEW VERSION (around line 554):
const addReview = async (orderId, productId, rating, comment) => {
  console.log("=== SUBMITTING REVIEW ===");
  console.log("Order ID:", orderId);
  console.log("Product ID:", productId);
  console.log("Rating:", rating);
  console.log("Comment:", comment);
  
  try {
    const response = await fetch(`${API_URL}/reviews`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        order_id: parseInt(orderId),
        product_id: parseInt(productId),
        rating: parseInt(rating),
        comment: comment
      })
    });
    
    const data = await response.json();
    console.log("Review response:", data);
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to add review');
    }
    
    // Refresh reviews and products
    await fetchReviews();
    await fetchProducts();
    
    alert(`✅ Review submitted! You rated this product ${rating} stars.`);
    return data;
    
  } catch (error) {
    console.error("Error adding review:", error);
    alert(`Failed to submit review: ${error.message}`);
    throw error;
  }
};

  // Cancel Order Function
  const cancelOrder = async (orderId) => {
    const order = orders.find(o => o.id === orderId);
    
    if (order.status !== 'waiting_verification' && order.status !== 'pending_confirmation') {
      alert("Order cannot be cancelled at this stage.");
      return;
    }
    
    if (!cancelReason.trim()) {
      alert("Please provide a reason for cancellation.");
      return;
    }
    
    const success = await cancelOrderInDB(orderId, cancelReason);
    if (success) {
      setShowCancelModal(null);
      setCancelReason('');
      alert("Order cancelled successfully!");
    } else {
      alert("Failed to cancel order. Please try again.");
    }
  };

  const handleDeleteProduct = async (productId, e) => {
  if (e) e.stopPropagation();
  
  console.log('🗑️ Attempting to delete product ID:', productId);
  
  const confirmDelete = window.confirm("Are you sure you want to delete this product?");
  if (!confirmDelete) return;
  
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      alert('You must be logged in to delete products');
      return;
    }
    
    const response = await fetch(`${API_URL}/products/${productId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    console.log('Delete response:', data);
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to delete product');
    }
    
    alert('Product deleted successfully!');
    
    // Refresh the products list
    await fetchProducts();
    
  } catch (error) {
    console.error('Error deleting product:', error);
    alert(`Failed to delete product: ${error.message}`);
  }
};

  const calculateTotal = () => cart.reduce((total, item) => total + (item.price * item.quantity), 0);

  const handleProceedToCheckout = () => {
    if (!currentUser) {
      alert("Please log in or create an account before checking out.");
      setIsAuthOpen(true);
    } else if (currentUser.role === 'seller') {
      alert("You are logged in as a Vendor. Please log in as a Buyer to make purchases.");
    } else {
      setView('checkout');
    }
  };

const handleMultipleImageUpload = (e) => {
  const files = Array.from(e.target.files);
  if (files.length === 0) return;
  
  // Store actual files for upload
  setNewProduct({ ...newProduct, imageFiles: files });
  
  // Create previews
  const previews = [];
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = (event) => {
      previews.push(event.target.result);
      if (previews.length === files.length) {
        setNewProduct(prev => ({ ...prev, images: previews }));
      }
    };
    reader.readAsDataURL(file);
  });
};

const handleAddProduct = async (e) => {
  e.preventDefault();
  
  if (!newProduct.name || !newProduct.price || !newProduct.stock || !newProduct.category) {
    alert("Please fill in all product details");
    return;
  }
  
  if (!newProduct.imageFiles || newProduct.imageFiles.length === 0) {
    alert("Please upload at least one product image");
    return;
  }
  
  // Create FormData for file upload
  const formData = new FormData();
  formData.append('name', newProduct.name);
  formData.append('price', newProduct.price);
  formData.append('stock_kg', newProduct.stock);
  formData.append('category', newProduct.category);
  formData.append('description', newProduct.description || '');
  
  // Append all images
  for (let i = 0; i < newProduct.imageFiles.length; i++) {
    formData.append('images', newProduct.imageFiles[i]);
  }
  
  try {
    const token = localStorage.getItem('token');
    console.log('Sending product data...');
    
    const response = await fetch(`${API_URL}/products`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
        // Don't set Content-Type for FormData - browser will set it with boundary
      },
      body: formData
    });
    
    const data = await response.json();
    console.log('Response:', data);
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to add product');
    }
    
    alert(`${newProduct.name} published successfully!`);
    
    // Reset form
    setNewProduct({ 
      name: '', 
      price: '', 
      stock: '', 
      category: 'Fish', 
      images: [], 
      imageFiles: [],
      description: '' 
    });
    
    // Refresh products list
    await fetchProducts();
    
  } catch (error) {
    console.error('Error adding product:', error);
    alert(`Failed to publish product: ${error.message}`);
  }
};

  const openProductModal = (product) => { setSelectedProduct(product); setCurrentImageIndex(0); };

  const handlePaymentProofUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setPaymentProofPreview(event.target.result);
        setPaymentProof(file);
      };
      reader.readAsDataURL(file);
    }
  };

const handlePlaceOrder = async (e, orderData) => {
  e.preventDefault();
  
  const paymentMethod = orderData.paymentMethod;
  
  // Handle payment proof upload if GCash
  let paymentProofUrl = null;
  if (paymentMethod === 'gcash' && paymentProof) {
    try {
      const formData = new FormData();
      formData.append('payment_proof', paymentProof);
      
      const token = localStorage.getItem('token');
      const uploadResponse = await fetch(`${API_URL}/upload-payment-proof`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      
      if (uploadResponse.ok) {
        const uploadData = await uploadResponse.json();
        paymentProofUrl = uploadData.file_url;
        console.log('Payment proof uploaded:', paymentProofUrl);
      } else {
        console.error('Upload failed:', await uploadResponse.text());
      }
    } catch (error) {
      console.error("Error uploading payment proof:", error);
    }
  }
  
  const newOrderData = {
    items: cart.map(item => ({
      product_id: item.id,
      quantity_kg: item.quantity,
      subtotal: item.price * item.quantity
    })),
    recipient_name: orderData.recipientName,
    mobile_number: orderData.mobileNumber,
    shipping_address: orderData.address,
    payment_method: paymentMethod,
    payment_proof: paymentProofUrl, // This should be saved
    total_amount: calculateTotal()
  };
  
  console.log('Sending order data:', newOrderData);
  
  try {
    const response = await fetch(`${API_URL}/orders`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(newOrderData)
    });
    
    const data = await response.json();
    console.log('Order response:', data);
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to create order');
    }
    
    // Update local product stock
    const updatedProducts = products.map(prod => {
      const cartItem = cart.find(c => c.id === prod.id);
      if (cartItem) {
        return { ...prod, stock: Math.max(0, prod.stock - cartItem.quantity) };
      }
      return prod;
    });
    
    setProducts(updatedProducts);
    setCart([]);
    setPaymentProof(null);
    setPaymentProofPreview(null);
    
    alert(`Order placed successfully!`);
    setView('orders');
    await fetchOrders(); // Refresh orders
  } catch (error) {
    console.error("Error placing order:", error);
    alert("Failed to place order. Please try again.");
  }
};

  const handleConfirmPayment = async (orderId) => {
    await updateOrderStatus(orderId, 'pending_confirmation', 'Payment verified. Waiting for vendor confirmation.');
    alert('Payment confirmed! Order is now waiting for preparation.');
  };

  const handleConfirmOrder = async (orderId) => {
    await updateOrderStatus(orderId, 'preparing', 'Order confirmed. Now being prepared.');
    alert('Order confirmed! Now preparing the order.');
  };

  const handleUpdateOrderStatus = async (orderId, newStatus, description) => {
    await updateOrderStatus(orderId, newStatus, description);
    alert(`Order status updated to: ${newStatus}`);
  };

  const getOrderStatusBadge = (status) => {
    const statusConfig = {
      'waiting_verification': { text: 'Waiting for Verification', color: '#ff9800', bg: '#fff3e0' },
      'pending_confirmation': { text: 'Pending Confirmation', color: '#ff9800', bg: '#fff3e0' },
      'preparing': { text: 'Being Prepared', color: '#2196f3', bg: '#e3f2fd' },
      'shipping': { text: 'Shipping', color: '#9c27b0', bg: '#f3e5f5' },
      'delivered': { text: 'Delivered', color: '#4caf50', bg: '#e8f5e9' },
      'cancelled': { text: 'Cancelled', color: '#dc3545', bg: '#f8d7da' }
    };
    const config = statusConfig[status] || statusConfig.waiting_verification;
    return <span style={{ backgroundColor: config.bg, color: config.color, padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' }}>{config.text}</span>;
  };

  const renderStars = (rating) => {
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
  
  return (
    <span className="star-rating" style={{ color: '#ffc107', fontSize: '16px' }}>
      {'★'.repeat(fullStars)}
      {hasHalfStar && '½'}
      {'☆'.repeat(emptyStars)}
    </span>
  );
};

  const getReviewBreakdown = (product) => {
  if (!product) return { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  
  // Get all reviews for this specific product
  const productReviews = reviews.filter(r => Number(r.productId) === Number(product.id));
  
  console.log('Product ID:', product.id);
  console.log('All reviews:', reviews);
  console.log('Reviews for this product:', productReviews);
  
  // Initialize breakdown counts
  const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  
  // Count reviews by rating
  productReviews.forEach(review => {
    const rating = Math.floor(review.rating);
    if (rating >= 1 && rating <= 5) {
      breakdown[rating]++;
    }
  });
  
  console.log('Breakdown:', breakdown);
  return breakdown;
};

  if (loading && products.length === 0) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading fresh seafood from Dagupan...</p>
      </div>
    );
  }

  return (
    <div className="app-container">
      <nav className="navbar">
  <div className="brand" onClick={() => {setView('home'); setSearchQuery('');}}>🐟 FishConnect</div>
  
  <div className="nav-links">
    {/* Marketplace - visible to everyone */}
    <button onClick={() => {setView('home'); setSearchQuery('');}}>Marketplace</button>
    
    {/* BUYER VIEW */}
    {currentUser?.role === 'buyer' && (
      <>
        <button onClick={() => setView('cart')}>Cart ({cart.length})</button>
        <button onClick={() => setView('wishlist')}>Wishlist ({wishlist.length})</button>
        <button onClick={() => setView('orders')}>My Orders</button>
      </>
    )}
    
    {/* SELLER VIEW */}
    {currentUser?.role === 'seller' && (
      <>
        <button onClick={() => setView('sellerDashboard')}>Vendor Dashboard</button>
        <button onClick={() => setView('sellerOrders')}>Order Management</button>
      </>
    )}
    
    {/* Profile Dropdown - visible when logged in */}
    {currentUser ? (
      <div className="profile-dropdown">
        <button className="profile-btn" onClick={() => setShowProfileMenu(!showProfileMenu)}>
          👤 {currentUser.first_name || currentUser.name}
          <span className="dropdown-arrow">▼</span>
        </button>
        {showProfileMenu && (
           <div className="dropdown-menu">
            <button 
              onClick={handleLogout} 
              className="dropdown-item logout-item"
              style={{ color: '#000000', backgroundColor: 'transparent' }}
            >
              🚪 Logout
            </button>
          </div>
        )}
      </div>
    ) : (
      <button className="login-btn" onClick={() => setIsAuthOpen(true)}>
        🔑 Login / Sign Up
      </button>
    )}
  </div>
</nav>

      <main className="main-content">
        
        {view === 'home' && (
          <div className="home-view">
            <header className="hero-section" style={{ backgroundImage: `url(${HERO_IMAGES[heroImageIndex]})` }}>
              <div className="hero-overlay">
                <h1>The Freshest Catch, Delivered.</h1>
                <p>FishConnect bridges the gap between Dagupan's hardworking fishermen and your kitchen table.</p>
                <div className="search-container">
                  <span className="search-icon">🔍</span>
                  <input type="text" placeholder="Search for bangus, tilapia, crabs..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="search-input" />
                </div>
              </div>
            </header>

            <div className="netflix-catalog">
              {categories.map(category => {
                const categoryProducts = products.filter(p => p.category === category && p.is_available !== false && (p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.category.toLowerCase().includes(searchQuery.toLowerCase())));
                if (categoryProducts.length === 0) return null;

                return (
                  <div key={category} className="netflix-category-section">
                    <h2 className="row-title">Fresh {category}</h2>
                    <div className="netflix-row">
                      {categoryProducts.map(product => {
                        const isOutOfStock = product.stock <= 0;

                        return (
                          <div key={product.id} className={`product-card netflix-card ${isOutOfStock ? 'out-of-stock-card' : ''}`} style={{position: 'relative'}} onClick={() => openProductModal(product)}>
                            
                            {currentUser?.role === 'buyer' && (
                              <button 
                                className={`wishlist-btn ${isInWishlist(product.id) ? 'active' : ''}`}
                                onClick={(e) => addToWishlist(product, e)}
                              >
                                {isInWishlist(product.id) ? '❤️' : '🤍'}
                              </button>
                            )}
                            
                            {currentUser?.role === 'seller' && currentUser.id === product.vendor_id && (
                              <button className="delete-btn" onClick={(e) => handleDeleteProduct(product.id, e)}>✕ Delete</button>
                            )}

<div className="image-wrapper">
  {product.images && product.images.length > 0 ? (
    <img 
      src={product.images[0].startsWith('/uploads/') 
        ? `http://localhost:5000${product.images[0]}` 
        : product.images[0]} 
      alt={product.name} 
      className="product-image"
      onError={(e) => {
        e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200"%3E%3Crect width="300" height="200" fill="%23f0f0f0"/%3E%3Ctext x="150" y="100" font-family="Arial" font-size="14" fill="%23999" text-anchor="middle"%3ENo Image%3C/text%3E%3C/svg%3E';
      }}
    />
  ) : (
    <div className="card-image-placeholder">No Image</div>
  )}
</div>

                            <div className="product-info">
                              <h3>{product.name}</h3>
                              <p className="vendor-name">{product.vendor}</p>
                              
                              <div className="product-stars">
  <span className="star-symbols">{renderStars(product.stars)}</span>
  <span className="review-count"> ({product.ratingCount || 0} reviews)</span>
</div>

                              <p className="price">₱{product.price} / kg</p>
                              <p className="stock" style={{color: isOutOfStock ? '#ae2012' : '#2a9d8f'}}>Stock: {product.stock} kg</p>
                              
                              {product.stock <= 5 && product.stock > 0 && (
                                <div className="stock-alert">
                                  ⚠️ Only {product.stock}kg left! Order soon.
                                </div>
                              )}
                              
                              <div className="purchase-controls" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="number"
                                  min="1"
                                  max={product.stock}
                                  placeholder="1"
                                  className="qty-input"
                                  value={quantities[product.id] || ''}
                                  onChange={(e) => handleQuantityChange(product.id, e.target.value, product.stock)}
                                  disabled={isOutOfStock}
                                />
                                <button
                                  className="add-to-cart-btn"
                                  onClick={(e) => addToCart(product, e)}
                                  disabled={isOutOfStock}
                                  style={{ background: isOutOfStock ? '#ccc' : '', cursor: isOutOfStock ? 'not-allowed' : 'pointer' }}
                                >
                                  {isOutOfStock ? 'Sold Out' : 'Add'}
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {view === 'wishlist' && (
          <div className="cart-container">
            <h2>My Wishlist ❤️</h2>
            {wishlist.length === 0 ? (
              <div style={{padding: '40px 0', textAlign: 'center'}}>
                <p style={{fontSize: '18px', color: '#666', marginBottom: '20px'}}>Your wishlist is empty.</p>
                <button className="checkout-btn" style={{width: 'auto'}} onClick={() => setView('home')}>Start Shopping</button>
              </div>
            ) : (
              <div className="wishlist-grid">
                {wishlist.map(product => (
                  <div key={product.id} className="wishlist-item">
                    <img src={product.images[0]} alt={product.name} className="wishlist-img" />
                    <div className="wishlist-details">
                      <h3>{product.name}</h3>
                      <p>₱{product.price}/kg</p>
                      <p className="vendor-name">{product.vendor}</p>
                    </div>
                    <div className="wishlist-actions">
                      <button 
                        className="add-to-cart-btn"
                        onClick={() => {
                          setQuantities({...quantities, [product.id]: 1});
                          addToCart(product, null);
                        }}
                      >
                        Add to Cart
                      </button>
                      <button 
                        className="remove-wishlist-btn"
                        onClick={(e) => addToWishlist(product, e)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Product Modal */}
        {selectedProduct && (
          <div className="modal-overlay" onClick={() => setSelectedProduct(null)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <button className="close-modal" onClick={() => setSelectedProduct(null)}>✕</button>
              <div className="modal-gallery">
  {selectedProduct.images && selectedProduct.images.length > 0 ? (
    <div className="main-image-container">
      <img 
        src={selectedProduct.images[currentImageIndex].startsWith('/uploads/') 
          ? `http://localhost:5000${selectedProduct.images[currentImageIndex]}` 
          : selectedProduct.images[currentImageIndex]} 
        alt={selectedProduct.name} 
        className={`main-modal-image ${selectedProduct.stock <= 0 ? 'faded' : ''}`} 
      />
      
      {selectedProduct.images.length > 1 && (
        <button 
          className="gallery-nav prev-btn"
          onClick={() => setCurrentImageIndex((prev) => 
            prev === 0 ? selectedProduct.images.length - 1 : prev - 1
          )}
        >
          ❮
        </button>
      )}
      
      {selectedProduct.images.length > 1 && (
        <button 
          className="gallery-nav next-btn"
          onClick={() => setCurrentImageIndex((prev) => 
            prev === selectedProduct.images.length - 1 ? 0 : prev + 1
          )}
        >
          ❯
        </button>
      )}
      
      {selectedProduct.images.length > 1 && (
        <div className="image-counter">
          {currentImageIndex + 1} / {selectedProduct.images.length}
        </div>
      )}
    </div>
  ) : (
    <div className="card-image-placeholder large">No Image</div>
  )}
</div>
              <div className="modal-info">
                <h2>{selectedProduct.name}</h2>
                <span className="category-tag">{selectedProduct.category}</span>
                <p><strong>Vendor:</strong> {selectedProduct.vendor}</p>
                
                <div className="modal-stars-container">
                  <div className="modal-stars">
  <span className="star-symbols">{renderStars(selectedProduct.stars)}</span>
  <span className="review-count"> 
    ({reviews.filter(r => Number(r.productId) === Number(selectedProduct?.id)).length} reviews)
  </span>
</div>

                  <div className="ratings-breakdown">
  <h4>Review Breakdown</h4>
  {[5, 4, 3, 2, 1].map(rating => {
    const breakdown = getReviewBreakdown(selectedProduct);
    const count = breakdown[rating] || 0;
    const productReviews = reviews.filter(r => Number(r.productId) === Number(selectedProduct?.id));
    const total = productReviews.length;
    const percentage = total > 0 ? (count / total) * 100 : 0;
    
    return (
      <div key={rating} className="breakdown-row">
        <span className="breakdown-label">{rating} ★</span>
        <div className="breakdown-bar-bg">
          <div 
            className="breakdown-bar-fill" 
            style={{ 
              width: `${percentage}%`,
              backgroundColor: rating === 5 ? '#4caf50' : 
                              rating === 4 ? '#8bc34a' :
                              rating === 3 ? '#ffc107' :
                              rating === 2 ? '#ff9800' : '#f44336'
            }}
          ></div>
        </div>
        <span className="breakdown-count">{count}</span>
      </div>
    );
  })}
</div>
                </div>

                <div className="product-reviews">
                  <h4>Customer Reviews</h4>
                  {reviews.filter(r => Number(r.productId) === Number(selectedProduct?.id)).length === 0 ? (
                    <p className="no-reviews">No reviews yet. Be the first to review this product!</p>
                  ) : (
                    <div className="reviews-list">
                      {reviews.filter(r => Number(r.productId) === Number(selectedProduct?.id)).map(review => (
                        <div key={review.id} className="review-item">
                          <strong>{review.userName}</strong> - 
                          <span className="review-rating">{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span>
                          <br />
                          <small>{new Date(review.date).toLocaleDateString()}</small>
                          <p className="review-comment">"{review.comment}"</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <p className="price large">₱{selectedProduct.price} / kg</p>
                <p style={{color: selectedProduct.stock <= 0 ? '#ae2012' : '#333'}}><strong>Available Stock:</strong> {selectedProduct.stock} kg</p>
                <div className="purchase-controls modal-purchase">
                  <input type="number" min="1" max={selectedProduct.stock} placeholder="1" className="qty-input" value={quantities[selectedProduct.id] || ''} onChange={(e) => handleQuantityChange(selectedProduct.id, e.target.value, selectedProduct.stock)} disabled={selectedProduct.stock <= 0}/>
                  <span className="kg-label">kg</span>
                  <button className="add-to-cart-btn" onClick={() => { addToCart(selectedProduct, null); setSelectedProduct(null); }} disabled={selectedProduct.stock <= 0} style={{ background: selectedProduct.stock <= 0 ? '#ccc' : '' }}>
                    {selectedProduct.stock <= 0 ? 'Sold Out' : 'Add to Cart'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Seller Dashboard */}
        {view === 'sellerDashboard' && (
          <div className="dashboard-container">
            <h2>Vendor Dashboard: {currentUser?.first_name || currentUser?.name}</h2>
            
            <div className="dashboard-grid">
             <div className="form-container add-product-form" style={{ margin: '0' }}>
  <h3>Publish New Seafood</h3>
  <form onSubmit={handleAddProduct} className="checkout-form">
    <label className="upload-label">Upload Product Photos (Max 5):</label>
    <input 
      type="file" 
      multiple 
      accept="image/*" 
      onChange={handleMultipleImageUpload} 
      className="file-input" 
      required 
    />
    {newProduct.images && newProduct.images.length > 0 && (
      <div className="thumbnail-strip">
        {newProduct.images.map((img, index) => (
          <img key={index} src={img} alt="Preview" className="thumbnail" />
        ))}
      </div>
    )}
    <input 
      type="text" 
      placeholder="Seafood Name" 
      value={newProduct.name} 
      onChange={e => setNewProduct({...newProduct, name: e.target.value})} 
      required 
    />
    <select 
      value={newProduct.category} 
      onChange={e => setNewProduct({...newProduct, category: e.target.value})} 
      className="dropdown"
    >
      <option value="Fish">Fish</option>
      <option value="Shellfish">Shellfish</option>
      <option value="Crabs">Crabs</option>
      <option value="Squid">Squid</option>
    </select>
    <input 
      type="number" 
      placeholder="Price per kg (₱)" 
      value={newProduct.price} 
      onChange={e => setNewProduct({...newProduct, price: e.target.value})} 
      required 
    />
    <input 
      type="number" 
      placeholder="Total Stock Available (kg)" 
      value={newProduct.stock} 
      onChange={e => setNewProduct({...newProduct, stock: e.target.value})} 
      required 
    />
    <textarea 
      placeholder="Product Description (optional)" 
      value={newProduct.description || ''} 
      onChange={e => setNewProduct({...newProduct, description: e.target.value})}
      rows="3"
    />
    <button type="submit" className="add-to-cart-btn">
      Publish to Marketplace
    </button>
  </form>
</div>

              <div className="vendor-listings">
                <h3>Your Active Listings ({vendorProducts.length})</h3>
                {vendorProducts.length === 0 ? (
                  <p className="no-listings-text">You haven't listed any products yet. Use the form on the left to add items!</p>
                ) : (
                  <div className="vendor-listings-grid">
                    {vendorProducts.map((product) => (
                      <div key={product.id} className="vendor-listing-card">
                      <img
  src={product.images && product.images.length > 0 
    ? (product.images[0].startsWith('/uploads/') 
        ? `http://localhost:5000${product.images[0]}` 
        : product.images[0])
    : 'https://via.placeholder.com/150'}
  alt={product.name}
  className="vendor-listing-img"
/>
                        <div className="vendor-listing-details">
                          <h4>{product.name}</h4>
                          <span className="listing-tag">{product.category}</span>
                          <p className="listing-price">₱{product.price} / kg</p>
                          <p className="listing-stock" style={{ color: product.stock <= 0 ? '#ae2012' : '#2a9d8f' }}>
                            Stock: {product.stock} kg
                          </p>
                        </div>
                        <button className="vendor-delete-btn" onClick={(e) => handleDeleteProduct(product.id, e)}>
  ✕ Delete
</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Cart View */}
        {view === 'cart' && (
          <div className="cart-container">
            <h2>Your Shopping Cart</h2>
            {cart.length === 0 ? (
              <div style={{padding: '40px 0'}}>
                <p style={{fontSize: '18px', color: '#666', marginBottom: '20px'}}>Your cart is currently empty.</p>
                <button className="checkout-btn" style={{width: 'auto'}} onClick={() => setView('home')}>Go Shopping</button>
              </div>
            ) : (
              <div>
                {cart.map(item => (
                  <div key={item.id} className="cart-item">
                    <div style={{textAlign: 'left'}}>
                      <strong>{item.name}</strong> <span style={{fontSize: '14px', color: '#666'}}>({item.vendor})</span>
                      <div style={{fontSize: '14px', color: '#666'}}>{item.quantity} kg x ₱{item.price}</div>
                    </div>
                    <div>
                      <strong style={{color: '#ae2012'}}>₱{item.price * item.quantity}</strong>
                      <button
                        onClick={() => setCart(cart.filter(c => c.id !== item.id))}
                        style={{marginLeft: '20px', background: 'none', border: 'none', color: '#ae2012', cursor: 'pointer', fontWeight: 'bold'}}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
                <div className="cart-summary">
                  <h3>Total: ₱{calculateTotal()}</h3>
                  <div style={{display: 'flex', gap: '15px', justifyContent: 'flex-end'}}>
                    <button className="back-btn" onClick={() => setView('home')}>Keep Shopping</button>
                    <button className="checkout-btn" style={{width: 'auto', padding: '12px 30px'}} onClick={handleProceedToCheckout}>Proceed to Checkout</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Checkout View */}
        {view === 'checkout' && (
          <div className="form-container" style={{maxWidth: '700px'}}>
            <h2>Delivery & Checkout</h2>
            <p style={{marginBottom: '20px', color: '#666'}}>Complete your order of <strong>₱{calculateTotal()}</strong></p>
            <form className="checkout-form" onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.target);
              const paymentMethod = formData.get('paymentMethod');
              
              if (paymentMethod === 'gcash' && !paymentProof) {
                alert('Please upload your GCash payment proof receipt.');
                return;
              }
              
              const orderData = {
                recipientName: formData.get('recipientName'),
                mobileNumber: formData.get('mobileNumber'),
                address: formData.get('address'),
                paymentMethod: paymentMethod
              };
              
              handlePlaceOrder(e, orderData);
            }}>
              <input type="text" name="recipientName" placeholder="Recipient's Name" required />
              <input type="tel" name="mobileNumber" placeholder="Mobile Number" required />
              <textarea name="address" placeholder="Complete Delivery Address in Pangasinan" rows="3" required></textarea>
              <select name="paymentMethod" className="dropdown" required onChange={(e) => {
                if (e.target.value !== 'gcash') {
                  setPaymentProof(null);
                  setPaymentProofPreview(null);
                }
              }}>
                <option value="">Select Payment Method</option>
                <option value="cod">Cash on Delivery (COD)</option>
                <option value="gcash">GCash Transfer</option>
              </select>
              
              {document.querySelector('select[name="paymentMethod"]')?.value === 'gcash' && (
                <div style={{marginTop: '10px'}}>
                  <label style={{display: 'block', marginBottom: '8px', fontWeight: 'bold'}}>Upload GCash Payment Proof:</label>
                  <input type="file" accept="image/*" onChange={handlePaymentProofUpload} required />
                  {paymentProofPreview && (
                    <div style={{marginTop: '10px'}}>
                      <img src={paymentProofPreview} alt="Payment Proof" style={{maxWidth: '200px', borderRadius: '8px'}} />
                    </div>
                  )}
                  <p style={{fontSize: '12px', color: '#666', marginTop: '5px'}}>Please upload screenshot of your GCash payment transaction.</p>
                </div>
              )}
              
              <div style={{display: 'flex', gap: '15px', marginTop: '10px'}}>
                <button type="button" className="back-btn" onClick={() => setView('cart')}>Back to Cart</button>
                <button type="submit" className="checkout-btn" style={{flex: 1}}>Place Order Now</button>
              </div>
            </form>
          </div>
        )}

{/* Orders View - Buyer */}
{view === 'orders' && (
  <div className="cart-container">
    <h2>My Orders</h2>
    
    <div className="order-filters">
      <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
        <option value="all">All Orders</option>
        <option value="waiting_verification">Waiting Verification</option>
        <option value="pending_confirmation">Pending Confirmation</option>
        <option value="preparing">Preparing</option>
        <option value="shipping">Shipping</option>
        <option value="delivered">Delivered</option>
        <option value="cancelled">Cancelled</option>
      </select>
      
      <input
        type="text"
        placeholder="Search orders..."
        value={searchOrder}
        onChange={(e) => setSearchOrder(e.target.value)}
        className="search-input"
        style={{width: '250px'}}
      />
    </div>
    
    {buyerOrders.length === 0 ? (
      <div style={{padding: '40px 0', textAlign: 'center'}}>
        <p style={{fontSize: '18px', color: '#666', marginBottom: '20px'}}>You haven't placed any orders yet.</p>
        <button className="checkout-btn" style={{width: 'auto'}} onClick={() => setView('home')}>Start Shopping</button>
      </div>
    ) : (
      <div>
        {buyerOrders
          .filter(order => filterStatus === 'all' || order.status === filterStatus)
          .filter(order => order.orderNumber?.toLowerCase().includes(searchOrder.toLowerCase()) ||
                           order.items?.some(item => item.name?.toLowerCase().includes(searchOrder.toLowerCase())))
          .map(order => (
          <div key={order.id} className="order-card" style={{border: '1px solid #ddd', borderRadius: '8px', marginBottom: '20px', padding: '20px', backgroundColor: '#fff'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '15px', borderBottom: '1px solid #eee', paddingBottom: '10px'}}>
              <div>
                <h3 style={{margin: 0, color: '#2a9d8f'}}>Order #{order.orderNumber}</h3>
                <p style={{margin: '5px 0 0', fontSize: '12px', color: '#666'}}>Placed on: {new Date(order.orderDate).toLocaleString()}</p>
              </div>
              {getOrderStatusBadge(order.status)}
            </div>
            
            {/* Order Details - SINGLE BLOCK */}
            <div style={{marginBottom: '15px'}}>
              <p><strong>Vendor:</strong> {order.vendorName || order.vendorId}</p>
              <p><strong>Payment Method:</strong> {order.paymentMethod === 'cod' ? 'Cash on Delivery' : 'GCash'}</p>
              <p><strong>Total Amount:</strong> <span style={{color: '#ae2012', fontWeight: 'bold'}}>₱{order.totalAmount}</span></p>
              <p><strong>Shipping Address:</strong> {order.shippingAddress}</p>
            </div>

            {/* GCash Receipt Display */}
            {order.paymentMethod === 'gcash' && order.paymentProof && (
              <div style={{ marginBottom: '15px', padding: '10px', background: '#f5f5f5', borderRadius: '8px' }}>
                <h4 style={{ margin: '0 0 10px 0' }}>📱 GCash Payment Receipt:</h4>
                <img 
                  src={order.paymentProof.startsWith('http') ? order.paymentProof : `http://localhost:5000${order.paymentProof}`}
                  alt="Payment Proof" 
                  style={{ maxWidth: '200px', borderRadius: '8px', border: '1px solid #ddd', cursor: 'pointer' }}
                  onClick={() => window.open(order.paymentProof.startsWith('http') ? order.paymentProof : `http://localhost:5000${order.paymentProof}`, '_blank')}
                />
                <p style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>Click image to view full size</p>
              </div>
            )}
            
            {(order.status === 'waiting_verification' || order.status === 'pending_confirmation') && (
              <button 
                className="cancel-order-btn"
                onClick={() => setShowCancelModal(order.id)}
              >
                Cancel Order
              </button>
            )}
            
            {order.status === 'delivered' && (
              <div className="review-section">
                <h4>Rate Your Order</h4>
                {order.items && order.items.map((item, idx) => {
                  const existingReview = reviews.find(r => r.orderId === order.id && r.productId === item.id);
                  if (!existingReview) {
                    return (
                      <div key={idx} className="review-form">
                        <p><strong>{item.name}</strong></p>
                        <div className="rating-input">
                          {[1,2,3,4,5].map(star => (
                            <span 
                              key={star}
                              className="star-rating"
                              style={{ cursor: 'pointer', fontSize: '24px' }}
                              onClick={() => {
                                const comment = prompt(`Rate ${item.name} (1-5 stars):\nLeave a comment about this product.`);
                                if (comment && comment.trim()) {
                                  addReview(order.id, item.id, star, comment);
                                } else if (comment) {
                                  addReview(order.id, item.id, star, "Great product!");
                                }
                              }}
                            >
                              ☆
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div key={idx} className="existing-review">
                      <strong>{item.name}</strong> - {existingReview.rating}★ 
                      <em> "{existingReview.comment}"</em>
                    </div>
                  );
                })}
              </div>
            )}
            
            <div style={{marginBottom: '15px'}}>
              <h4 style={{margin: '0 0 10px 0'}}>Order Tracking:</h4>
              <div style={{borderLeft: '2px solid #2a9d8f', paddingLeft: '15px'}}>
                {order.tracking && order.tracking.history && order.tracking.history.map((track, idx) => (
                  <div key={idx} style={{marginBottom: '10px'}}>
                    <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                      <div style={{width: '10px', height: '10px', borderRadius: '50%', backgroundColor: idx === order.tracking.history.length - 1 ? '#2a9d8f' : '#ccc'}}></div>
                      <div>
                        <strong style={{fontSize: '14px'}}>{track.description}</strong>
                        <p style={{margin: '2px 0 0', fontSize: '12px', color: '#666'}}>{new Date(track.date).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    )}
    
    {showCancelModal && (
      <div className="modal-overlay" onClick={() => setShowCancelModal(null)}>
        <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
          <h3>Cancel Order</h3>
          <p>Please provide a reason for cancellation:</p>
          <textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="e.g., Changed my mind, Found better price, etc."
            rows="3"
            style={{width: '100%', padding: '8px', marginBottom: '15px', borderRadius: '5px', border: '1px solid #ddd'}}
          />
          <div className="confirm-buttons">
            <button className="cancel-btn" onClick={() => setShowCancelModal(null)}>No, Keep Order</button>
            <button className="confirm-btn" onClick={() => cancelOrder(showCancelModal)}>Yes, Cancel Order</button>
          </div>
        </div>
      </div>
    )}
  </div>
)}
        {/* Seller Orders Management */}
        {view === 'sellerOrders' && currentUser?.role === 'seller' && (
          <div className="cart-container">
            <h2>Orders Management - {currentUser.first_name || currentUser.name}</h2>
            {sellerOrders.length === 0 ? (
              <div style={{padding: '40px 0', textAlign: 'center'}}>
                <p style={{fontSize: '18px', color: '#666'}}>No orders received yet.</p>
              </div>
            ) : (
              <div>
                {sellerOrders.map(order => (
                  <div key={order.id} className="order-card" style={{border: '1px solid #ddd', borderRadius: '8px', marginBottom: '20px', padding: '20px', backgroundColor: '#fff'}}>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '15px', borderBottom: '1px solid #eee', paddingBottom: '10px'}}>
                      <div>
                        <h3 style={{margin: 0, color: '#2a9d8f'}}>Order #{order.orderNumber}</h3>
                        <p style={{margin: '5px 0 0', fontSize: '12px', color: '#666'}}>Placed on: {new Date(order.orderDate).toLocaleString()}</p>
                      </div>
                      {getOrderStatusBadge(order.status)}
                    </div>
                    
                    <div style={{marginBottom: '15px'}}>
                      <p><strong>Buyer:</strong> {order.buyerName || order.buyerId}</p>
                      <p><strong>Vendor:</strong> {order.vendorName || order.vendorId}</p>
                      <p><strong>Payment Method:</strong> {order.paymentMethod === 'cod' ? 'Cash on Delivery' : 'GCash'}</p>
                      <p><strong>Total Amount:</strong> <span style={{color: '#ae2012', fontWeight: 'bold'}}>₱{order.totalAmount}</span></p>
                      <p><strong>Recipient:</strong> {order.recipientName}</p>
                      <p><strong>Mobile:</strong> {order.mobileNumber}</p>
                      <p><strong>Shipping Address:</strong> {order.shippingAddress}</p>
                    </div>
                    
                    {/* GCash Receipt Display for Seller */}
{order.paymentMethod === 'gcash' && order.paymentProof && (
  <div style={{ marginBottom: '15px' }}>
    <h4 style={{ margin: '0 0 10px 0' }}>📱 GCash Payment Receipt (from buyer):</h4>
    <img 
      src={order.paymentProof.startsWith('http') ? order.paymentProof : `http://localhost:5000${order.paymentProof}`}
      alt="Payment Proof" 
      style={{ 
        maxWidth: '200px', 
        borderRadius: '8px', 
        border: '1px solid #ddd',
        cursor: 'pointer'
      }}
      onClick={() => window.open(
        order.paymentProof.startsWith('http') ? order.paymentProof : `http://localhost:5000/${order.paymentProof}`, 
        '_blank'
      )}
    />
    
    {/* Confirm Payment Button - only show if order is waiting_verification */}
    {order.status === 'waiting_verification' && (
      <div style={{ marginTop: '10px' }}>
        <button 
          className="checkout-btn" 
          onClick={() => handleConfirmPayment(order.id)} 
          style={{ width: 'auto', padding: '8px 20px' }}
        >
          ✓ Confirm Payment
        </button>
      </div>
    )}
  </div>
)}

                    {order.paymentMethod === 'gcash' && order.status === 'waiting_verification' && (
                      <div style={{marginBottom: '15px'}}>
                        <h4>Payment Proof:</h4>
                        {order.paymentProof && <img src={order.paymentProof} alt="Payment Proof" style={{maxWidth: '200px', borderRadius: '8px', border: '1px solid #ddd'}} />}
                        <div style={{marginTop: '10px'}}>
                          <button className="checkout-btn" onClick={() => handleConfirmPayment(order.id)} style={{width: 'auto', padding: '8px 20px'}}>
                            Confirm Payment
                          </button>
                        </div>
                      </div>
                    )}
                    
                    {order.status === 'pending_confirmation' && (
                      <div style={{marginBottom: '15px'}}>
                        <button className="checkout-btn" onClick={() => handleConfirmOrder(order.id)} style={{width: 'auto', padding: '8px 20px'}}>
                          Confirm Order & Start Preparing
                        </button>
                      </div>
                    )}
                    
                    {order.status === 'preparing' && (
                      <div style={{marginBottom: '15px'}}>
                        <div style={{display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center'}}>
                          <button className="checkout-btn" onClick={() => handleUpdateOrderStatus(order.id, 'shipping', 'Order has been shipped out.')} style={{width: 'auto', padding: '8px 20px'}}>
                            Mark as Shipped
                          </button>
                        </div>
                      </div>
                    )}
                    
                    {order.status === 'shipping' && (
                      <div style={{marginBottom: '15px'}}>
                        <button className="checkout-btn" onClick={() => handleUpdateOrderStatus(order.id, 'delivered', 'Order has been delivered to the buyer.')} style={{width: 'auto', padding: '8px 20px'}}>
                          Mark as Delivered
                        </button>
                      </div>
                    )}
                    
                    <div style={{marginBottom: '15px'}}>
                      <h4 style={{margin: '0 0 10px 0'}}>Order Tracking History:</h4>
                      <div style={{borderLeft: '2px solid #2a9d8f', paddingLeft: '15px'}}>
                        {order.tracking && order.tracking.history && order.tracking.history.map((track, idx) => (
                          <div key={idx} style={{marginBottom: '10px'}}>
                            <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                              <div style={{width: '10px', height: '10px', borderRadius: '50%', backgroundColor: idx === order.tracking.history.length - 1 ? '#2a9d8f' : '#ccc'}}></div>
                              <div>
                                <strong style={{fontSize: '14px'}}>{track.description}</strong>
                                <p style={{margin: '2px 0 0', fontSize: '12px', color: '#666'}}>{new Date(track.date).toLocaleString()}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {isAuthOpen && (
        <AuthModal
          onClose={() => setIsAuthOpen(false)}
          onAuthSuccess={handleAuthSuccess}
          apiUrl={API_URL}
        />
      )}

      <footer className="app-footer">
        <div className="footer-container">
          <div className="footer-section">
            <h3>FishConnect</h3>
            <p>Fresh seafood marketplace connecting Dagupan fishermen to your home.</p>
          </div>
          <div className="footer-section">
            <h4>Quick Links</h4>
            <ul>
              <li onClick={() => setView('home')}>Marketplace</li>
              <li onClick={() => setView('cart')}>Cart</li>
              {currentUser?.role === 'buyer' && <li onClick={() => setView('wishlist')}>Wishlist</li>}
              {currentUser && <li onClick={() => setView('orders')}>My Orders</li>}
              {currentUser?.role === 'seller' && <li onClick={() => setView('sellerDashboard')}>Vendor Dashboard</li>}
            </ul>
          </div>
          <div className="footer-section">
            <h4>Contact</h4>
            <p>Dagupan City, Pangasinan</p>
            <p>Email: support@fishconnect.com</p>
            <p>Phone: +63 900 000 0000</p>
          </div>
          <div className="footer-section">
            <h4>Follow Us</h4>
            <p>Facebook | Instagram | TikTok</p>
          </div>
        </div>
        <div className="footer-bottom">
          <p>© {new Date().getFullYear()} FishConnect. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

export default App;