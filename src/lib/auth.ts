import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import mongoose from "mongoose";

let authInstance: any = null;

export function getAuth(): any {
  if (authInstance) {
    return authInstance;
  }

  if (mongoose.connection.readyState !== 1) {
    throw new Error("Mongoose must be connected to MongoDB before initializing Better Auth.");
  }

  const client = mongoose.connection.getClient();
  const db = client.db();

  authInstance = betterAuth({
    database: mongodbAdapter(db, {
      client,
      usePlural: true,
    }),
    emailAndPassword: {
      enabled: true,
    },
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID || "",
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      },
    },
    secret: process.env.BETTER_AUTH_SECRET || "default_auth_secret_for_development_purposes",
  });

  return authInstance;
}
