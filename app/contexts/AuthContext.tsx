"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
    User,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
} from "firebase/auth";
import { auth } from "../utils/firebase";

interface AuthContextType {
    currentUser: User | null;
    login: (email: string, password: string) => Promise<any>;
    signup: (email: string, password: string) => Promise<any>;
    logout: () => Promise<void>;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [firebaseError, setFirebaseError] = useState<string | null>(null);

    function signup(email: string, password: string) {
        if (!auth) {
            throw new Error("Firebase is not initialized. Please check your environment variables.");
        }
        return createUserWithEmailAndPassword(auth, email, password);
    }

    function login(email: string, password: string) {
        if (!auth) {
            throw new Error("Firebase is not initialized. Please check your environment variables.");
        }
        return signInWithEmailAndPassword(auth, email, password);
    }

    function logout() {
        if (!auth) {
            throw new Error("Firebase is not initialized. Please check your environment variables.");
        }
        return signOut(auth);
    }

    useEffect(() => {
        if (!auth) {
            setFirebaseError("Firebase is not configured. Please set up your environment variables.");
            setLoading(false);
            return;
        }

        try {
            const unsubscribe = onAuthStateChanged(auth, (user) => {
                setCurrentUser(user);
                setLoading(false);
                setFirebaseError(null);
            });

            return unsubscribe;
        } catch (error: any) {
            console.error("Error setting up auth state listener:", error);
            setFirebaseError("Failed to initialize authentication.");
            setLoading(false);
        }
    }, []);

    const value = {
        currentUser,
        login,
        signup,
        logout,
        loading,
    };

    // Show error message if Firebase is not configured
    if (firebaseError) {
        return (
            <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6">
                <div className="max-w-2xl bg-[#14151B] rounded-lg border border-slate-800 p-8">
                    <h1 className="text-2xl font-bold mb-4 text-[#DD3129]">Firebase Configuration Error</h1>
                    <p className="text-[#8991A1] mb-4">{firebaseError}</p>
                    <div className="bg-[#1A1B23] p-4 rounded mb-4">
                        <p className="text-sm text-white mb-2">Please create a <code className="bg-[#14151B] px-2 py-1 rounded">.env.local</code> file in the root directory with:</p>
                        <pre className="text-xs text-[#8991A1] overflow-x-auto">
                            {`NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id`}
                        </pre>
                    </div>
                    <p className="text-sm text-[#8991A1]">
                        After creating the file, restart your development server with <code className="bg-[#1A1B23] px-2 py-1 rounded">npm run dev</code>
                    </p>
                </div>
            </div>
        );
    }

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
}

