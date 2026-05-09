const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 5000;
const JWT_SECRET = 'fishconnect_secret_key_2024';

// CORS middleware - SINGLE CONFIGURATION (FIXED)
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Ensure uploads directory exists
const uploadsDir = './uploads';
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
  console.log('✅ Created uploads directory');
}

// Configure multer for image upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Database connection
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'fishconnect_db',
  waitForConnections: true,
  connectionLimit: 10
});

async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Connected to database');
    connection.release();
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
  }
}
testConnection();

// ========== AUTHENTICATION MIDDLEWARE ==========
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
};

// ========== AUTH ROUTES ==========
app.post('/api/auth/register', async (req, res) => {
  console.log('Registration attempt:', req.body.username);
  
  try {
    const { first_name, middle_name, last_name, mobile, address, email, username, password, role } = req.body;
    
    if (!first_name || !last_name || !mobile || !address || !email || !username || !password || !role) {
      return res.status(400).json({ error: 'All fields except middle name are required' });
    }
    
    const [existing] = await pool.query(
      'SELECT id FROM users WHERE email = ? OR username = ?',
      [email, username]
    );
    
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Email or username already exists' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const middleNameValue = (middle_name && middle_name.trim() !== '') ? middle_name.trim() : null;
    
    const [result] = await pool.query(
      `INSERT INTO users (first_name, middle_name, last_name, mobile, address, email, username, password, role) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [first_name, middleNameValue, last_name, mobile, address, email, username, hashedPassword, role]
    );
    
    const token = jwt.sign(
      { id: result.insertId, username, role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({
      token,
      user: { id: result.insertId, first_name, last_name, username, email, role }
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  
  try {
    const [users] = await pool.query(
      'SELECT * FROM users WHERE username = ? OR email = ?',
      [username, username]
    );
    
    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const user = users[0];
    const validPassword = await bcrypt.compare(password, user.password);
    
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    const { password: _, ...userWithoutPassword } = user;
    res.json({ token, user: userWithoutPassword });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const [users] = await pool.query(
      'SELECT id, first_name, last_name, username, email, role FROM users WHERE id = ?',
      [req.user.id]
    );
    if (users.length > 0) {
      res.json(users[0]);
    } else {
      res.status(404).json({ error: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== PRODUCT ROUTES ==========
app.get('/api/products', async (req, res) => {
  console.log('Fetching products...');
  
  try {
    const [products] = await pool.query(`
      SELECT 
        p.*,
        CONCAT(u.first_name, ' ', u.last_name) as vendor_name
      FROM products p
      LEFT JOIN users u ON p.vendor_id = u.id
      WHERE p.is_available = 1 OR p.is_available IS NULL
      ORDER BY p.id DESC
    `);
    
    const formattedProducts = products.map(product => {
      let images = [];
      if (product.image_url) {
        try {
          const parsed = JSON.parse(product.image_url);
          if (Array.isArray(parsed)) {
            images = parsed;
          } else {
            images = [product.image_url];
          }
        } catch (e) {
          images = [product.image_url];
        }
      }
      if (images.length === 0) {
        images = ['https://via.placeholder.com/300x200?text=No+Image'];
      }
      
      return {
        id: product.id,
        vendor_id: product.vendor_id,
        vendor_name: product.vendor_name,
        name: product.name,
        category: product.category,
        price: parseFloat(product.price),
        stock_kg: parseFloat(product.stock_kg),
        description: product.description,
        images: images,
        is_available: product.is_available,
        created_at: product.created_at
      };
    });
    
    res.json(formattedProducts);
    
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products: ' + error.message });
  }
});

// ADD PRODUCT - FIXED VERSION
app.post('/api/products', authenticateToken, upload.array('images', 5), async (req, res) => {
  console.log('🔵 PRODUCT ADD REQUEST RECEIVED');
  console.log('Files count:', req.files ? req.files.length : 0);
  console.log('Body:', req.body);
  
  try {
    // Check if user is seller
    if (req.user.role !== 'seller') {
      return res.status(403).json({ error: 'Only sellers can add products' });
    }
    
    const { name, price, stock_kg, category, description } = req.body;
    
    // Validate required fields
    if (!name || !price || !stock_kg || !category) {
      return res.status(400).json({ error: 'Name, price, stock, and category are required' });
    }
    
    // Check if images were uploaded
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'At least one product image is required' });
    }
    
    // Save image URLs
    const imageUrls = req.files.map(file => `/uploads/${file.filename}`);
    const imageUrlsJson = JSON.stringify(imageUrls);
    
    console.log('Saving product:', { name, price, stock_kg, category, images: imageUrlsJson });
    
    // Insert into database
    const [result] = await pool.query(
      `INSERT INTO products (vendor_id, name, category, price, stock_kg, description, image_url, is_available) 
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [req.user.id, name, category, price, stock_kg, description || null, imageUrlsJson]
    );
    
    console.log('✅ Product added, ID:', result.insertId);
    
    res.status(201).json({ 
      success: true,
      id: result.insertId, 
      message: 'Product added successfully', 
      images: imageUrls 
    });
    
  } catch (error) {
    console.error('❌ Error adding product:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== UPLOAD PAYMENT PROOF ENDPOINT ==========
app.post('/api/upload-payment-proof', authenticateToken, upload.single('payment_proof'), async (req, res) => {
  console.log('💰 Payment proof upload received');
  console.log('File:', req.file);
  
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  const fileUrl = `/uploads/${req.file.filename}`;
  console.log('✅ File saved at:', fileUrl);
  res.json({ file_url: fileUrl });
});

// ========== ORDER ROUTES ==========
// Create order - Updated to save payment_proof
app.post('/api/orders', authenticateToken, async (req, res) => {
  console.log('Order creation request:', req.body);
  
  const { items, recipient_name, mobile_number, shipping_address, payment_method, payment_proof, total_amount } = req.body;
  
  const connection = await pool.getConnection();
  await connection.beginTransaction();
  
  try {
    // Get vendor_id from the first product's vendor
    const [productInfo] = await connection.query(
      'SELECT vendor_id FROM products WHERE id = ?',
      [items[0].product_id]
    );
    
    if (productInfo.length === 0) {
      throw new Error('Product not found');
    }
    
    const vendor_id = productInfo[0].vendor_id;
    const orderNumber = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    // Create order with payment_proof
    const [orderResult] = await connection.query(
      `INSERT INTO orders (order_number, buyer_id, vendor_id, recipient_name, mobile_number, shipping_address, 
       total_amount, payment_method, payment_proof, status, order_date) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_confirmation', NOW())`,
      [orderNumber, req.user.id, vendor_id, recipient_name, mobile_number, shipping_address, total_amount, payment_method, payment_proof || null]
    );
    
    const orderId = orderResult.insertId;
    
    // Add order items and update stock
    for (const item of items) {
      await connection.query(
        'INSERT INTO order_items (order_id, product_id, quantity_kg, subtotal) VALUES (?, ?, ?, ?)',
        [orderId, item.product_id, item.quantity_kg, item.subtotal]
      );
      
      // Update product stock
      await connection.query(
        'UPDATE products SET stock_kg = stock_kg - ? WHERE id = ?',
        [item.quantity_kg, item.product_id]
      );
    }
    
    // Add tracking history
    await connection.query(
      `INSERT INTO order_tracking (order_id, description, status_reached, update_date) 
       VALUES (?, ?, 'pending_confirmation', NOW())`,
      [orderId, 'Order placed. Waiting for vendor confirmation.']
    );
    
    await connection.commit();
    console.log('Order created successfully, ID:', orderId, 'Payment proof:', payment_proof);
    res.json({ id: orderId, order_number: orderNumber, message: 'Order created successfully', payment_proof: payment_proof });
    
  } catch (error) {
    await connection.rollback();
    console.error('Error creating order:', error);
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

// ========== GET ORDERS ROUTE ==========
app.get('/api/orders', authenticateToken, async (req, res) => {
  console.log('Fetching orders for user:', req.user.id, 'Role:', req.user.role);
  
  try {
    let orders;
    
    if (req.user.role === 'seller') {
      [orders] = await pool.query(`
        SELECT 
          o.*,
          CONCAT(b.first_name, ' ', b.last_name) as buyer_name
        FROM orders o
        JOIN users b ON o.buyer_id = b.id
        WHERE o.vendor_id = ?
        ORDER BY o.order_date DESC
      `, [req.user.id]);
    } else {
      [orders] = await pool.query(`
        SELECT 
          o.*,
          CONCAT(v.first_name, ' ', v.last_name) as vendor_name
        FROM orders o
        JOIN users v ON o.vendor_id = v.id
        WHERE o.buyer_id = ?
        ORDER BY o.order_date DESC
      `, [req.user.id]);
    }
    
    const ordersWithDetails = await Promise.all(orders.map(async (order) => {
      const [items] = await pool.query(`
        SELECT oi.*, p.name as product_name, p.price as product_price
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = ?
      `, [order.id]);
      
      const [tracking] = await pool.query(`
        SELECT * FROM order_tracking WHERE order_id = ? ORDER BY update_date ASC
      `, [order.id]);
      
      const formattedItems = items.map(item => ({
        id: item.product_id,
        name: item.product_name,
        quantity: parseFloat(item.quantity_kg),
        price: parseFloat(item.product_price),
        subtotal: parseFloat(item.subtotal)
      }));
      
      return {
        id: order.id,
        orderNumber: order.order_number,
        buyerId: order.buyer_id,
        vendorId: order.vendor_id,
        vendorName: order.vendor_name,
        buyerName: order.buyer_name,
        items: formattedItems,
        totalAmount: parseFloat(order.total_amount),
        paymentMethod: order.payment_method,
        paymentProof: order.payment_proof,
        orderDate: order.order_date,
        status: order.status,
        recipientName: order.recipient_name,
        mobileNumber: order.mobile_number,
        shippingAddress: order.shipping_address,
        tracking: {
          status: order.status,
          history: tracking.map(t => ({
            status: t.status_reached,
            description: t.description,
            date: t.update_date
          }))
        }
      };
    }));
    
    res.json(ordersWithDetails);
    
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders: ' + error.message });
  }
});

// ========== VENDORS ROUTE ==========
app.get('/api/vendors', async (req, res) => {
  try {
    const [vendors] = await pool.query(
      'SELECT id, first_name, last_name, username FROM users WHERE role = "seller"'
    );
    res.json(vendors);
  } catch (error) {
    console.error('Error fetching vendors:', error);
    res.status(500).json({ error: 'Failed to fetch vendors' });
  }
});

// ========== REVIEWS ROUTES ==========
app.get('/api/reviews', async (req, res) => {
  try {
    const [reviews] = await pool.query(`
      SELECT r.*, CONCAT(u.first_name, ' ', u.last_name) as buyer_name
      FROM reviews r
      JOIN users u ON r.buyer_id = u.id
      ORDER BY r.review_date DESC
    `);
    res.json(reviews);
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/reviews', authenticateToken, async (req, res) => {
  const { order_id, product_id, rating, comment } = req.body;
  
  try {
    const [existing] = await pool.query(
      'SELECT id FROM reviews WHERE order_id = ? AND product_id = ? AND buyer_id = ?',
      [order_id, product_id, req.user.id]
    );
    
    if (existing.length > 0) {
      return res.status(400).json({ error: 'You have already reviewed this product' });
    }
    
    const [result] = await pool.query(
      `INSERT INTO reviews (order_id, product_id, buyer_id, rating, comment, review_date) 
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [order_id, product_id, req.user.id, rating, comment || null]
    );
    
    res.json({ success: true, id: result.insertId, message: 'Review added successfully' });
    
  } catch (error) {
    console.error('Error adding review:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== WISHLIST ROUTES ==========
app.get('/api/wishlist', authenticateToken, async (req, res) => {
  try {
    const [items] = await pool.query(`
      SELECT w.*, p.name as product_name, p.price
      FROM wishlist w
      JOIN products p ON w.product_id = p.id
      WHERE w.buyer_id = ?
    `, [req.user.id]);
    res.json(items);
  } catch (error) {
    console.error('Error fetching wishlist:', error);
    res.status(500).json({ error: 'Failed to fetch wishlist' });
  }
});

app.post('/api/wishlist', authenticateToken, async (req, res) => {
  const { product_id } = req.body;
  
  try {
    await pool.query(
      'INSERT INTO wishlist (buyer_id, product_id) VALUES (?, ?)',
      [req.user.id, product_id]
    );
    res.json({ message: 'Added to wishlist' });
  } catch (error) {
    console.error('Error adding to wishlist:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/wishlist/:productId', authenticateToken, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM wishlist WHERE buyer_id = ? AND product_id = ?',
      [req.user.id, req.params.productId]
    );
    res.json({ message: 'Removed from wishlist' });
  } catch (error) {
    console.error('Error removing from wishlist:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== DELETE PRODUCT ==========
app.delete('/api/products/:id', authenticateToken, async (req, res) => {
  console.log('DELETE request for product:', req.params.id);
  
  try {
    const [products] = await pool.query(
      'SELECT id, vendor_id, name FROM products WHERE id = ?',
      [req.params.id]
    );
    
    if (products.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    const product = products[0];
    
    if (product.vendor_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only delete your own products' });
    }
    
    await pool.query('DELETE FROM products WHERE id = ?', [req.params.id]);
    
    res.json({ success: true, message: `Product "${product.name}" deleted successfully` });
    
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== UPDATE ORDER STATUS ==========
app.patch('/api/orders/:id/status', authenticateToken, async (req, res) => {
  const { status, description } = req.body;
  
  const connection = await pool.getConnection();
  await connection.beginTransaction();
  
  try {
    const [orders] = await connection.query(
      'SELECT vendor_id FROM orders WHERE id = ?',
      [req.params.id]
    );
    
    if (orders.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    if (orders[0].vendor_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    await connection.query('UPDATE orders SET status = ? WHERE id = ?', [status, req.params.id]);
    
    const descriptionText = description || `Order status updated to ${status}`;
    await connection.query(
      `INSERT INTO order_tracking (order_id, description, status_reached, update_date) 
       VALUES (?, ?, ?, NOW())`,
      [req.params.id, descriptionText, status]
    );
    
    await connection.commit();
    res.json({ message: 'Order status updated successfully' });
    
  } catch (error) {
    await connection.rollback();
    console.error('Error updating order:', error);
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

// ========== CANCEL ORDER ==========
app.patch('/api/orders/:id/cancel', authenticateToken, async (req, res) => {
  const { cancel_reason } = req.body;
  
  const connection = await pool.getConnection();
  await connection.beginTransaction();
  
  try {
    const [orders] = await connection.query(
      'SELECT buyer_id, status FROM orders WHERE id = ?',
      [req.params.id]
    );
    
    if (orders.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    const order = orders[0];
    
    if (req.user.id !== order.buyer_id) {
      return res.status(403).json({ error: 'Only the buyer can cancel the order' });
    }
    
    if (order.status !== 'pending_confirmation' && order.status !== 'waiting_verification') {
      return res.status(400).json({ error: 'Order cannot be cancelled at this stage' });
    }
    
    await connection.query(
      'UPDATE orders SET status = "cancelled", cancel_reason = ? WHERE id = ?',
      [cancel_reason, req.params.id]
    );
    
    const [items] = await connection.query(
      'SELECT product_id, quantity_kg FROM order_items WHERE order_id = ?',
      [req.params.id]
    );
    
    for (const item of items) {
      await connection.query(
        'UPDATE products SET stock_kg = stock_kg + ? WHERE id = ?',
        [item.quantity_kg, item.product_id]
      );
    }
    
    await connection.query(
      `INSERT INTO order_tracking (order_id, description, status_reached, update_date) 
       VALUES (?, ?, "cancelled", NOW())`,
      [req.params.id, `Order cancelled. Reason: ${cancel_reason}`]
    );
    
    await connection.commit();
    res.json({ message: 'Order cancelled successfully' });
    
  } catch (error) {
    await connection.rollback();
    console.error('Error cancelling order:', error);
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

// ========== TEST ENDPOINT ==========
app.get('/api/test', async (req, res) => {
  res.json({ message: 'Database connection OK', timestamp: new Date() });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  console.log(`📝 API endpoints available:`);
  console.log(`   POST   /api/auth/register`);
  console.log(`   POST   /api/auth/login`);
  console.log(`   GET    /api/auth/me`);
  console.log(`   GET    /api/products`);
  console.log(`   POST   /api/products (requires auth & image upload)`);
  console.log(`   POST   /api/upload-payment-proof (requires auth)`);
  console.log(`   POST   /api/orders (requires auth)`);
  console.log(`   GET    /api/orders (requires auth)`);
  console.log(`   PATCH  /api/orders/:id/status (requires auth)`);
  console.log(`   PATCH  /api/orders/:id/cancel (requires auth)`);
  console.log(`   GET    /api/vendors`);
  console.log(`   GET    /api/reviews`);
  console.log(`   POST   /api/reviews (requires auth)`);
  console.log(`   GET    /api/wishlist (requires auth)`);
  console.log(`   POST   /api/wishlist (requires auth)`);
  console.log(`   DELETE /api/wishlist/:productId (requires auth)`);
  console.log(`   DELETE /api/products/:id (requires auth)`);
  console.log(`   GET    /api/test\n`);
});