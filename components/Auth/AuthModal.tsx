import React, { useState } from 'react';
import { X, Mail, Lock, User, AlertCircle, Loader2 } from 'lucide-react';
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    updateProfile
} from 'firebase/auth';
import { auth } from '../../services/firebase';

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            if (isLogin) {
                await signInWithEmailAndPassword(auth, email, password);
            } else {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                await updateProfile(userCredential.user, {
                    displayName: name
                });
            }
            onClose();
        } catch (err: any) {
            console.error("Auth error:", err);
            if (err.code === 'auth/user-not-found') setError('No account found with this email.');
            else if (err.code === 'auth/wrong-password') setError('Incorrect password.');
            else if (err.code === 'auth/email-already-in-use') setError('Email already in use.');
            else setError('Authentication failed. Please check your details.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="relative w-full max-w-[450px] bg-black/90 border border-white/10 p-8 md:p-16 rounded-lg shadow-2xl">
                <button
                    onClick={onClose}
                    className="absolute top-6 right-6 p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white"
                >
                    <X className="w-6 h-6" />
                </button>

                <h2 className="text-3xl font-bold text-white mb-8">
                    {isLogin ? 'Sign In' : 'Sign Up'}
                </h2>

                {error && (
                    <div className="mb-6 p-4 bg-orange-600/20 border border-orange-600/50 rounded flex items-start space-x-3">
                        <AlertCircle className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
                        <p className="text-sm text-orange-200">{error}</p>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    {!isLogin && (
                        <div className="relative">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                            <input
                                type="text"
                                placeholder="Full Name"
                                required
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full bg-[#333] text-white rounded px-12 py-4 outline-none focus:bg-[#444] transition-colors border-b-2 border-transparent focus:border-[#e50914]"
                            />
                        </div>
                    )}
                    <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                        <input
                            type="email"
                            placeholder="Email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-[#333] text-white rounded px-12 py-4 outline-none focus:bg-[#444] transition-colors border-b-2 border-transparent focus:border-[#e50914]"
                        />
                    </div>
                    <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                        <input
                            type="password"
                            placeholder="Password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-[#333] text-white rounded px-12 py-4 outline-none focus:bg-[#444] transition-colors border-b-2 border-transparent focus:border-[#e50914]"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-[#e50914] hover:bg-[#b81d24] text-white font-bold py-4 rounded transition-all active:scale-95 flex items-center justify-center space-x-2 shadow-lg shadow-red-600/20 mt-4"
                    >
                        {loading && <Loader2 className="w-5 h-5 animate-spin" />}
                        <span>{isLogin ? 'Sign In' : 'Sign Up'}</span>
                    </button>
                </form>

                <div className="mt-8 flex flex-col space-y-4">
                    <div className="flex items-center space-x-2 text-gray-500 text-sm">
                        <input type="checkbox" className="w-4 h-4 accent-[#e50914]" id="remember" />
                        <label htmlFor="remember">Remember me</label>
                    </div>

                    <p className="text-gray-500">
                        {isLogin ? "New to JMAFK?" : "Already have an account?"}{' '}
                        <button
                            onClick={() => setIsLogin(!isLogin)}
                            className="text-white hover:underline font-medium"
                        >
                            {isLogin ? 'Sign up now.' : 'Sign in here.'}
                        </button>
                    </p>

                    <p className="text-[13px] text-gray-500 leading-tight">
                        This page is protected by Google reCAPTCHA to ensure you're not a bot.
                        <span className="text-blue-500 hover:underline cursor-pointer ml-1">Learn more.</span>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default AuthModal;
