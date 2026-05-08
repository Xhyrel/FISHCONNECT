const express = require('express');
const router = express.Router();
const db = require('../config/db');
const multer = require('multer');

// Configure Image Uploads
const storage = multer.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

router.post('/create', upload.single('paymentProof'), async (req, res) => {
    const orderData = JSON.parse(req.body.order); // Sending order as stringified JSON
    const paymentProofPath = req.file ? `/uploads/${req.file.filename}` : null;

    try {
        // 1. Insert into orders table
        const [orderResult] = await db.execute(
            `INSERT INTO orders (order_number, buyer_id, vendor_id, recipient_name, mobile_number, shipping_address, total_amount, payment_method, payment_proof, status) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                orderData.orderNumber, orderData.buyerId, orderData.vendorId, 
                orderData.recipientName, orderData.mobileNumber, orderData.shippingAddress, 
                orderData.totalAmount, orderData.paymentMethod, paymentProofPath, 
                orderData.paymentMethod === 'gcash' ? 'waiting_verification' : 'pending_confirmation'
            ]
        );

        // 2. Insert Tracking
        await db.execute(
            `INSERT INTO order_tracking (order_id, description) VALUES (?, ?)`,
            [orderResult.insertId, "Order placed successfully."]
        );

        res.status(201).json({ message: "Order placed!", orderId: orderResult.insertId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;