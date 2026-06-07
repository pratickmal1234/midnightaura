import admin from "firebase-admin";
import { readFileSync } from "fs";

// Download from: Firebase Console → Project Settings
// → Service Accounts → Generate new private key
const serviceAccount = JSON.parse(
  readFileSync("./src/config/serviceAccountKey.json", "utf-8")
);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

export default admin;