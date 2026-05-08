const db = require('../config/db');

exports.createOrder = async (req, res) => {
    // Note: When sending from React, 'order' will be a stringified JSON in FormData
    const orderData = JSON.parse(req.body.order);
    const paymentProofPath = req.file ? `/uploads/${req.file.filename}` : null;

    try {
        // 1. Insert main order
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

        const orderId = orderResult.insertId;

        // 2. Insert order items (loop through the cart)
        for (const item of orderData.items) {
            await db.execute(
                `INSERT INTO order_items (order_id, product_id, quantity_kg, subtotal) VALUES (?, ?, ?, ?)`,
                [orderId, item.id, item.quantity, item.subtotal]
            );
        }

        // 3. Initial Tracking Entry
        await db.execute(
            `INSERT INTO order_tracking (order_id, description) VALUES (?, ?)`,
            [orderId, "Order placed and awaiting vendor confirmation."]
        );

        res.status(201).json({ message: "Order placed successfully!", orderId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getBuyerOrders = async (req, res) => {
    const { buyerId } = req.params;
    try {
        const [orders] = await db.execute(`SELECT * FROM orders WHERE buyer_id = ? ORDER BY order_date DESC`, [buyerId]);
        res.json(orders);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.updateOrderStatus = async (req, res) => {
    const { orderId, status, description } = req.body;
    try {
        await db.execute(`UPDATE orders SET status = ? WHERE id = ?`, [status, orderId]);
        await db.execute(`INSERT INTO order_tracking (order_id, description) VALUES (?, ?)`, [orderId, description]);
        res.json({ message: "Status updated successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};