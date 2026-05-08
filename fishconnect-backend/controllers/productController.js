const db = require('../config/db');

exports.getAllProducts = async (req, res) => {
    try {
        const [products] = await db.execute('SELECT * FROM products WHERE is_available = 1');
        res.json(products);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.addProduct = async (req, res) => {
    const { vendorId, name, category, price, stockKg, description, imageUrl } = req.body;
    try {
        const [result] = await db.execute(
            `INSERT INTO products (vendor_id, name, category, price, stock_kg, description, image_url) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [vendorId, name, category, price, stockKg, description, imageUrl]
        );
        res.status(201).json({ message: "Product added!", productId: result.insertId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};