import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
    apiKey: "AIzaSyC5yYYeociWUJ-mNuHy09MVPxNgdSg_cLo",
    authDomain: "movie-night-154c6.firebaseapp.com",
    databaseURL: "https://movie-night-154c6-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "movie-night-154c6",
    storageBucket: "movie-night-154c6.firebasestorage.app",
    messagingSenderId: "972866472098",
    appId: "1:972866472098:web:7eaf6cce2fc227e8f8affb",
    measurementId: "G-D9X0G7XX6C"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);
