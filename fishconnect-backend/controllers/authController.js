// controllers/authController.js
const db = require('../config/db');
const bcrypt = require('bcryptjs');

exports.register = async (req, res) => {
    const { firstName, middleName, lastName, mobile, address, email, username, password, role } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const [result] = await db.execute(
            `INSERT INTO users (first_name, middle_name, last_name, mobile, address, email, username, password, role) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [firstName, middleName, lastName, mobile, address, email, username, hashedPassword, role]
        );
        res.status(201).json({ message: "User created", userId: result.insertId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.login = async (req, res) => {
    const { email, password } = req.body;
    try {
        const [users] = await db.execute('SELECT * FROM users WHERE email = ? OR username = ?', [email, email]);
        if (users.length === 0) return res.status(404).json({ message: "User not found" });

        const user = users[0];
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ message: "Invalid credentials" });

        res.json({ id: user.id, name: user.first_name, role: user.role });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};