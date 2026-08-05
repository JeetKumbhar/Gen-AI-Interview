const userModel = require("../models/user.model");
const bycrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

/**
 * @name registerUserController
 * @description Register a new user, expects username, email and password in the request body
 * @access Public
 */
async function registerUserController(req, res) {
    const { username, email, password } = req.body;

    if(!username || !email || !password) {
        return res.status(400).json({ message: "Username, email and password are required" });
    }

    const isUserAlreadyExists = await userModel.findOne({ 
        $or: [{ username }, { email }]
    });

    if(isUserAlreadyExists) {
        return res.status(400).json({ message: "User with this username or email already exists" });
    }

    const hash = await bycrypt.hash(password, 10);

    const user = await userModel.create({
        username,
        email,
        password: hash
    });

    const token = jwt.sign({ id: user._id }, 
        process.env.JWT_SECRET, 
        { expiresIn: "1d" }
    );

    res.cookie("token", token)

    res.status(201).json({
        message: "User registered successfully",
        user: {
            _id: user._id,
            username: user.username,
            email: user.email
        }
    });
}

module.exports = { registerUserController };