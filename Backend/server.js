require("dotenv").config();
const app = require("./src/app")
const connectDB = require("./src/config/database")

async function startServer() {
    await connectDB(); 

    app.listen(process.env.PORT || 3000, () => {
        console.log("Server is running");
    });
}

startServer();