// import mongoose from "mongoose";

// export async function connectDB() {
//   const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
//   if (!uri) {
//     throw new Error("MONGODB_URI environment variable is not defined");
//   }

//   try {
//     await mongoose.connect(uri);
//     console.log("Connected to MongoDB successfully via Mongoose");
//   } catch (error) {
//     console.error("Failed to connect to MongoDB:", error);
//     process.exit(1);
//   }
// }
