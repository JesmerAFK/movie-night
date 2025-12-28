import React, { useState, useEffect, useRef } from 'react';
import {
    Users, MessageSquare, Send, X,
    Check, Ban, RotateCw, User, Link, Share2, Crown
} from 'lucide-react';
import { ref, onValue, set, push, onChildAdded, serverTimestamp, update, remove, get, off } from 'firebase/database';
import { db, auth } from '../../services/firebase';
import { v4 as uuidv4 } from 'uuid';

interface WatchTogetherProps {
    movie: any;
    videoRef: React.RefObject<HTMLVideoElement | null>;
    isPlaying: boolean;
    currentTime: number;
    onSyncPlay: (playing: boolean) => void;
    onSyncSeek: (time: number) => void;
    onClose: () => void;
    onChatToggle?: (isOpen: boolean) => void;
}

interface UserData {
    id: string;
    name: string;
    role: 'host' | 'viewer';
    permissions: {
        canControl: boolean;
    };
}

interface Message {
    id: string;
    userId: string;
    userName: string;
    text: string;
    timestamp: number;
}

const WatchTogether: React.FC<WatchTogetherProps> = ({
    movie,
    isPlaying,
    currentTime,
    onSyncPlay,
    onSyncSeek,
    onClose,
    onChatToggle
}) => {
    const [roomId, setRoomId] = useState<string | null>(null);

    // PERSISTENT USER ID: Prevents losing host status on close/reopen
    const [userId] = useState(() => {
        const saved = sessionStorage.getItem('wt_userId');
        if (saved) return saved;
        const fresh = uuidv4();
        sessionStorage.setItem('wt_userId', fresh);
        return fresh;
    });

    const [userName] = useState(() => localStorage.getItem('wt_userName') || `User_${Math.floor(Math.random() * 800) + 100}`);
    const [users, setUsers] = useState<Record<string, UserData>>({});
    const [messages, setMessages] = useState<Message[]>([]);
    const [showChat, setShowChat] = useState(true);
    const [inputValue, setInputValue] = useState('');
    const [isHost, setIsHost] = useState(false);
    const [copied, setCopied] = useState(false);
    const [myPermissions, setMyPermissions] = useState({ canControl: false });
    const [floatingEmotes, setFloatingEmotes] = useState<{ id: string, emote: string, x: number }[]>([]);

    const chatEndRef = useRef<HTMLDivElement>(null);
    const isInternalUpdate = useRef(false);
    const blockTimeoutRef = useRef<any>(null);
    const playingRef = useRef(isPlaying);
    const timeRef = useRef(currentTime);
    const isHostRef = useRef(false);
    const roomIdRef = useRef<string | null>(null);
    const initialized = useRef(false);

    useEffect(() => {
        playingRef.current = isPlaying;
        timeRef.current = currentTime;
    }, [isPlaying, currentTime]);

    useEffect(() => {
        onChatToggle?.(showChat);
    }, [showChat]);

    useEffect(() => {
        if (initialized.current) return;
        initialized.current = true;

        localStorage.setItem('wt_userName', userName);
        const params = new URLSearchParams(window.location.search);
        const rid = params.get('room');

        if (rid) {
            // Check if we are the host of this existing room before joining as viewer
            validateAndJoin(rid);
        } else {
            createRoom();
        }

        return () => {
            if (roomIdRef.current) {
                const rRef = roomIdRef.current;
                off(ref(db, `rooms/${rRef}/users`));
                off(ref(db, `rooms/${rRef}/state`));
                // We keep the user in the database so they can rejoin easily
            }
        };
    }, []);

    const validateAndJoin = async (rid: string) => {
        const snapshot = await get(ref(db, `rooms/${rid}`));
        if (snapshot.exists()) {
            const data = snapshot.val();
            // If my ID matches the hostId, restore my host powers!
            if (data.hostId === userId) {
                console.log("👑 [AUTH] Welcome back, King. Restoring Host status.");
                setRoomId(rid);
                roomIdRef.current = rid;
                setIsHost(true);
                isHostRef.current = true;
                setMyPermissions({ canControl: true });
                setupRoomListeners(rid);
            } else {
                joinRoom(rid);
            }
        } else {
            createRoom(); // Room doesn't exist anymore, make a new one
        }
    };

    useEffect(() => {
        if (chatEndRef.current) {
            chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    const createRoom = () => {
        if (!auth.currentUser) {
            alert("🔒 Sign in required to host a movie party!");
            onClose();
            return;
        }

        const rid = uuidv4().substring(0, 8);
        setRoomId(rid);
        roomIdRef.current = rid;
        setIsHost(true);
        isHostRef.current = true;
        setMyPermissions({ canControl: true });

        const displayName = auth.currentUser.displayName || userName;

        set(ref(db, `rooms/${rid}`), {
            movieId: movie.id,
            hostId: userId,
            state: {
                isPlaying: playingRef.current,
                currentTime: timeRef.current,
                lastUpdated: serverTimestamp(),
                updatedBy: userId
            },
            users: {
                [userId]: { id: userId, name: displayName, role: 'host', permissions: { canControl: true } }
            }
        });

        setupRoomListeners(rid);
        const newUrl = `${window.location.origin}${window.location.pathname}?room=${rid}`;
        window.history.pushState({}, '', newUrl);
    };

    const joinRoom = (rid: string) => {
        setRoomId(rid);
        roomIdRef.current = rid;

        const displayName = auth.currentUser?.displayName || userName;

        const viewer: UserData = {
            id: userId,
            name: displayName,
            role: 'viewer',
            permissions: { canControl: false }
        };

        update(ref(db, `rooms/${rid}/users`), {
            [userId]: viewer
        }).then(() => {
            setupRoomListeners(rid);
            forceResync(rid);
        });
    };

    const setupRoomListeners = (rid: string) => {
        onValue(ref(db, `rooms/${rid}/users`), (snapshot) => {
            const data = snapshot.val();
            if (data) {
                setUsers(data);
                if (data[userId]) {
                    setMyPermissions(data[userId].permissions);
                    const hostStatus = data[userId].role === 'host';
                    setIsHost(hostStatus);
                    isHostRef.current = hostStatus;
                }
            }
        });

        onValue(ref(db, `rooms/${rid}/state`), (snapshot) => {
            const state = snapshot.val();
            if (state && state.updatedBy !== userId) {
                if (isHostRef.current) return;

                isInternalUpdate.current = true;
                if (blockTimeoutRef.current) clearTimeout(blockTimeoutRef.current);

                if (state.isPlaying !== undefined && state.isPlaying !== playingRef.current) {
                    onSyncPlay(state.isPlaying);
                }

                const drift = Math.abs(state.currentTime - timeRef.current);
                if (state.currentTime !== undefined && drift > 3) {
                    onSyncSeek(state.currentTime);
                }

                blockTimeoutRef.current = setTimeout(() => {
                    isInternalUpdate.current = false;
                }, 2000);
            }
        });

        onValue(ref(db, `rooms/${rid}/messages`), (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const msgList = Object.entries(data).map(([id, msg]: [string, any]) => ({ id, ...msg }));
                setMessages(msgList.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0)));
            }
        });

        onChildAdded(ref(db, `rooms/${rid}/emotes`), (snapshot) => {
            const emoteData = snapshot.val();
            const id = uuidv4();
            setFloatingEmotes(prev => [...prev, { id, emote: emoteData.emote, x: Math.random() * 80 + 10 }]);
            setTimeout(() => setFloatingEmotes(prev => prev.filter(e => e.id !== id)), 3000);
        });
    };

    useEffect(() => {
        if (!roomId || !myPermissions.canControl || isInternalUpdate.current) return;

        update(ref(db, `rooms/${roomId}/state`), {
            isPlaying,
            lastUpdated: serverTimestamp(),
            updatedBy: userId
        });

        push(ref(db, `rooms/${roomId}/messages`), {
            userId: 'system',
            userName: 'Room',
            text: `${userName} ${isPlaying ? 'played' : 'paused'} movie`,
            timestamp: serverTimestamp()
        });
    }, [isPlaying]);

    useEffect(() => {
        if (!roomId || !myPermissions.canControl || isInternalUpdate.current) return;
        const timer = setTimeout(() => {
            update(ref(db, `rooms/${roomId}/state`), {
                currentTime,
                lastUpdated: serverTimestamp(),
                updatedBy: userId
            });
        }, 2000);
        return () => clearTimeout(timer);
    }, [currentTime]);

    const forceResync = async (forcedRid?: string) => {
        const targetRid = forcedRid || roomId;
        if (!targetRid) return;

        const snapshot = await get(ref(db, `rooms/${targetRid}/state`));
        if (snapshot.exists()) {
            const state = snapshot.val();
            onSyncPlay(state.isPlaying);
            if (state.currentTime !== undefined) onSyncSeek(state.currentTime);
        }
    };

    const togglePermission = (targetUserId: string, canControl: boolean) => {
        if (!isHost || !roomId) return;
        update(ref(db, `rooms/${roomId}/users/${targetUserId}/permissions`), {
            canControl
        });
    };

    const copyInviteLink = () => {
        navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const sendMessage = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!inputValue.trim() || !roomId) return;
        push(ref(db, `rooms/${roomId}/messages`), {
            userId, userName, text: inputValue.trim(), timestamp: serverTimestamp()
        });
        setInputValue('');
    };

    const handleClose = () => {
        // Remove room from URL when closing, but keep the session alive
        const newUrl = `${window.location.origin}${window.location.pathname}`;
        window.history.pushState({}, '', newUrl);
        onClose();
    };

    return (
        <div className="absolute inset-0 z-50 pointer-events-none flex items-start justify-end p-4 md:p-6">
            <div className="absolute inset-0 overflow-hidden pointer-events-none z-[60]">
                {floatingEmotes.map(e => (
                    <div key={e.id} className="absolute bottom-0 animate-float-up text-6xl select-none filter drop-shadow-2xl" style={{ left: `${e.x}%` }}>
                        {e.emote}
                    </div>
                ))}
            </div>

            <div className={`h-[calc(100%-2rem)] bg-black/40 backdrop-blur-3xl border border-white/10 rounded-3xl flex flex-col transition-all duration-500 pointer-events-auto shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden ${showChat ? 'w-full md:w-96' : 'w-20'}`}>
                {/* Header */}
                <div className="p-5 border-b border-white/10 flex items-center justify-between bg-white/5">
                    {showChat ? (
                        <>
                            <div className="flex items-center space-x-3">
                                <div className="bg-[#e50914] p-2 rounded-xl shadow-[0_0_15px_rgba(229,9,20,0.4)]">
                                    <Users className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-white font-bold text-sm tracking-tight">Movie Party</h3>
                                    <div className="flex items-center space-x-1.5">
                                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                        <span className="text-[10px] text-gray-400 font-medium uppercase tracking-widest">{Object.keys(users).length} Watching</span>
                                    </div>
                                </div>
                            </div>
                            <button onClick={handleClose} className="p-2 hover:bg-white/10 rounded-full transition-colors group">
                                <X className="w-5 h-5 text-gray-400 group-hover:text-white" />
                            </button>
                        </>
                    ) : (
                        <button onClick={() => setShowChat(true)} className="w-full h-full flex items-center justify-center hover:bg-white/10 transition-all group">
                            <MessageSquare className="w-6 h-6 text-gray-400 group-hover:text-white group-hover:scale-110" />
                        </button>
                    )}
                </div>

                {showChat && (
                    <>
                        <div className="p-4 flex gap-2 border-b border-white/5 bg-white/5">
                            <button onClick={copyInviteLink} className={`flex-1 flex items-center justify-center space-x-2 py-2.5 rounded-xl text-xs font-bold transition-all ${copied ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 hover:border-white/20'}`}>
                                {copied ? <Check className="w-4 h-4" /> : <Link className="w-4 h-4" />}
                                <span>{copied ? 'Link Copied' : 'Invite Friends'}</span>
                            </button>
                            {!isHost && (
                                <button onClick={() => forceResync()} className="p-2.5 bg-white/5 hover:bg-white/10 text-blue-400 rounded-xl border border-white/10 transition-all active:rotate-180 duration-500" title="Resync to Host">
                                    <RotateCw className="w-4 h-4" />
                                </button>
                            )}
                        </div>

                        <div className="p-4 flex flex-wrap gap-2 max-h-32 overflow-y-auto no-scrollbar border-b border-white/5">
                            {Object.values(users).map((u: UserData) => (
                                <div key={u.id} className={`flex items-center space-x-2 px-3 py-1.5 rounded-full text-[10px] font-bold border transition-all ${u.role === 'host' ? 'bg-[#e50914]/10 border-[#e50914]/30 text-[#e50914]' : 'bg-white/5 border-white/10 text-gray-300'}`}>
                                    {u.role === 'host' ? <Crown className="w-3 h-3 text-[#e50914]" /> : <div className="w-1.5 h-1.5 rounded-full bg-green-500" />}
                                    <span className="truncate max-w-[80px]">{u.name} {u.id === userId && "(You)"}</span>
                                    {isHost && u.id !== userId && (
                                        <button onClick={() => togglePermission(u.id, !u.permissions.canControl)} className={`ml-2 hover:scale-125 transition-transform ${u.permissions.canControl ? 'text-blue-400' : 'text-gray-500'}`}>
                                            {u.permissions.canControl ? <Check className="w-3 h-3" /> : <Ban className="w-3 h-3" />}
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>

                        <div className="flex-1 overflow-y-auto p-5 space-y-6 no-scrollbar scrolling-touch">
                            {messages.map((msg) => (
                                <div key={msg.id} className={`flex flex-col ${msg.userId === userId ? 'items-end' : (msg.userId === 'system' ? 'items-center py-2' : 'items-start')}`}>
                                    {msg.userId !== 'system' && (
                                        <div className="flex items-center space-x-2 mb-1.5 px-1">
                                            <span className="text-[10px] text-gray-500 font-black uppercase tracking-tighter">{msg.userName}</span>
                                            {users[msg.userId]?.role === 'host' && <span className="text-[8px] bg-[#e50914] text-white px-1.5 rounded-sm font-black uppercase tracking-widest">Host</span>}
                                        </div>
                                    )}
                                    <div className={`px-4 py-2.5 rounded-2xl text-[13px] leading-relaxed max-w-[90%] transition-all ${msg.userId === 'system'
                                        ? 'bg-white/5 text-gray-500 text-[9px] font-bold uppercase tracking-widest px-3 py-1 rounded-full'
                                        : (msg.userId === userId ? 'bg-[#e50914] text-white rounded-tr-none shadow-[0_4px_15px_rgba(229,9,20,0.3)]' : 'bg-white/10 text-gray-200 rounded-tl-none border border-white/5 shadow-xl')
                                        }`}>
                                        {msg.text}
                                    </div>
                                </div>
                            ))}
                            <div ref={chatEndRef} />
                        </div>

                        <div className="px-5 py-3 flex items-center justify-between border-t border-white/5 bg-black/40 backdrop-blur-md">
                            {['❤️', '😂', '🔥', '😮', '👍', '👏'].map(emoji => (
                                <button key={emoji} onClick={() => {
                                    push(ref(db, `rooms/${roomId}/emotes`), { userId, emote: emoji, timestamp: serverTimestamp() });
                                }} className="text-2xl hover:scale-150 active:scale-95 transition transform duration-300">
                                    {emoji}
                                </button>
                            ))}
                        </div>

                        <form onSubmit={sendMessage} className="p-5 bg-black/60 border-t border-white/10">
                            <div className="relative group">
                                <input
                                    id="chat-input"
                                    type="text"
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    placeholder="Say something..."
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl pl-4 pr-12 py-3.5 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-[#e50914]/50 focus:bg-white/10 transition-all font-medium"
                                />
                                <button type="submit" className="absolute right-2 top-1.5 p-2 text-[#e50914] hover:scale-110 active:scale-95 transition-all">
                                    <div className="bg-[#e50914]/20 p-1.5 rounded-xl">
                                        <Send className="w-5 h-5" />
                                    </div>
                                </button>
                            </div>
                        </form>
                    </>
                )}
            </div>

            <style>{`
                @keyframes float-up {
                    0% { transform: translateY(0) scale(0.3) rotate(0deg); opacity: 0; }
                    15% { opacity: 1; transform: translateY(-15vh) scale(1.3) rotate(15deg); }
                    80% { opacity: 0.8; }
                    100% { transform: translateY(-95vh) scale(1.8) rotate(-15deg); opacity: 0; }
                }
                .animate-float-up { animation: float-up 3.5s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
                .shadow-glow { box-shadow: 0 0 20px rgba(229,9,20,0.4); }
                .no-scrollbar::-webkit-scrollbar { display: none; }
            `}</style>
        </div>
    );
};

export default WatchTogether;
