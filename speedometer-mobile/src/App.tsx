import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Geolocation, Position } from '@capacitor/geolocation';
import './App.css';

const KMH_CONVERSION = 3.6;
const MPH_CONVERSION = 2.23694;

// ===========================================
// PRECISION & REAL-TIME CONFIGURATION
// ===========================================
const CONFIG = {
    // Location update settings
    UPDATE_INTERVAL_MS: 100,          // Request updates every 100ms (10 Hz)
    UI_REFRESH_INTERVAL_MS: 16,       // Refresh UI every 16ms (60 Hz) for ultra-smooth rolling counter

    // Accuracy thresholds
    MAX_ACCEPTABLE_ACCURACY: 50,      // Accept readings up to 50m (relaxed for more data)
    GOOD_ACCURACY_THRESHOLD: 15,      // Consider < 15m as "good" signal

    // Speed filtering - FASTER RESPONSE
    KALMAN_PROCESS_NOISE: 0.1,        // Higher for faster raw speed response
    KALMAN_MEASUREMENT_NOISE: 1.0,    // Lower = trust GPS more
    EMA_ALPHA: 0.6,                   // Higher alpha = faster response to changes

    // Speed thresholds - VERY LOW (only for auto-pause if enabled)
    AUTO_PAUSE_THRESHOLD_MPS: 0.15,   // Auto-pause below 0.15 m/s (~0.5 km/h) - basically stopped
    AUTO_RESUME_THRESHOLD_MPS: 0.2,   // Resume at 0.2 m/s (~0.7 km/h)
    MIN_VALID_SPEED_MPS: 0.05,        // Very low threshold
    MAX_REALISTIC_SPEED_MPS: 100,     // ~360 km/h max realistic speed

    // Distance calculation - VERY RELAXED
    MIN_DISTANCE_FOR_UPDATE: 0.3,     // Minimum 0.3m movement to count distance
    MIN_SPEED_FOR_DISTANCE: 0.1,      // Very low threshold for distance accumulation

    // Speed display behavior
    SPEED_ZERO_TIMEOUT_MS: 3000,      // Return to 0 after 3 seconds of no GPS updates
};

// ===========================================
// KALMAN FILTER CLASS FOR SPEED SMOOTHING
// ===========================================
class KalmanFilter {
    private q: number; // Process noise
    private r: number; // Measurement noise
    private p: number; // Estimation error covariance
    private x: number; // Current estimate
    private k: number; // Kalman gain

    constructor(processNoise: number, measurementNoise: number, initialValue: number = 0) {
        this.q = processNoise;
        this.r = measurementNoise;
        this.p = 1;
        this.x = initialValue;
        this.k = 0;
    }

    filter(measurement: number): number {
        // Prediction update
        this.p = this.p + this.q;

        // Measurement update
        this.k = this.p / (this.p + this.r);
        this.x = this.x + this.k * (measurement - this.x);
        this.p = (1 - this.k) * this.p;

        return this.x;
    }

    reset(value: number = 0): void {
        this.x = value;
        this.p = 1;
    }

    getCurrentEstimate(): number {
        return this.x;
    }
}

// ===========================================
// SPEED PROCESSOR CLASS
// ===========================================
class SpeedProcessor {
    private kalmanFilter: KalmanFilter;
    private lastEmaSpeed: number = 0;
    private lastValidSpeed: number = 0;
    private lastTimestamp: number = 0;
    private lastPosition: { lat: number; lon: number } | null = null;
    private speedHistory: number[] = [];
    private readonly historySize = 5;

    constructor() {
        this.kalmanFilter = new KalmanFilter(
            CONFIG.KALMAN_PROCESS_NOISE,
            CONFIG.KALMAN_MEASUREMENT_NOISE
        );
    }

    processSpeed(
        gpsSpeed: number | null | undefined,
        accuracy: number,
        lat: number,
        lon: number,
        timestamp: number
    ): { speed: number; calculatedSpeed: number; isCalculated: boolean } {
        let rawSpeed = 0;
        let calculatedSpeed = 0;
        let isCalculated = false;

        // Calculate speed from position change as fallback/verification
        if (this.lastPosition && this.lastTimestamp > 0) {
            const timeDiff = (timestamp - this.lastTimestamp) / 1000; // seconds
            if (timeDiff > 0 && timeDiff < 5) { // Only if reasonable time gap
                const distance = this.haversineDistance(
                    this.lastPosition.lat, this.lastPosition.lon,
                    lat, lon
                );
                calculatedSpeed = distance / timeDiff;
            }
        }

        // Determine which speed source to use
        if (gpsSpeed !== null && gpsSpeed !== undefined && gpsSpeed >= 0) {
            rawSpeed = gpsSpeed;
        } else if (calculatedSpeed > CONFIG.MIN_VALID_SPEED_MPS) {
            rawSpeed = calculatedSpeed;
            isCalculated = true;
        }

        // Validate speed
        if (rawSpeed < CONFIG.MIN_VALID_SPEED_MPS) {
            rawSpeed = 0;
        }
        if (rawSpeed > CONFIG.MAX_REALISTIC_SPEED_MPS) {
            rawSpeed = this.lastValidSpeed; // Use last valid if unrealistic
        }

        // Weight speed based on accuracy
        const accuracyWeight = accuracy < CONFIG.GOOD_ACCURACY_THRESHOLD
            ? 1.0
            : Math.max(0.3, 1 - (accuracy - CONFIG.GOOD_ACCURACY_THRESHOLD) / 50);

        // Apply Kalman filter
        const kalmanSpeed = this.kalmanFilter.filter(rawSpeed * accuracyWeight);

        // Apply exponential moving average for additional smoothing
        const emaSpeed = CONFIG.EMA_ALPHA * kalmanSpeed + (1 - CONFIG.EMA_ALPHA) * this.lastEmaSpeed;
        this.lastEmaSpeed = emaSpeed;

        // Update history for spike detection
        this.speedHistory.push(emaSpeed);
        if (this.speedHistory.length > this.historySize) {
            this.speedHistory.shift();
        }

        // Detect and reject spikes
        const finalSpeed = this.rejectSpikes(emaSpeed);

        // Store for next iteration
        this.lastValidSpeed = finalSpeed > 0 ? finalSpeed : this.lastValidSpeed;
        this.lastPosition = { lat, lon };
        this.lastTimestamp = timestamp;

        return {
            speed: Math.max(0, finalSpeed),
            calculatedSpeed,
            isCalculated
        };
    }

    private haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const R = 6371e3; // Earth's radius in meters
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    private rejectSpikes(currentSpeed: number): number {
        if (this.speedHistory.length < 3) return currentSpeed;

        const avgRecent = this.speedHistory.slice(-3).reduce((a, b) => a + b, 0) / 3;
        const maxAllowedChange = Math.max(avgRecent * 0.5, 5); // 50% change or 5 m/s max

        if (Math.abs(currentSpeed - avgRecent) > maxAllowedChange) {
            return avgRecent; // Reject spike, use average
        }
        return currentSpeed;
    }

    reset(): void {
        this.kalmanFilter.reset();
        this.lastEmaSpeed = 0;
        this.lastValidSpeed = 0;
        this.lastTimestamp = 0;
        this.lastPosition = null;
        this.speedHistory = [];
    }
}

const App: React.FC = () => {
    const [units, setUnits] = useState(() => localStorage.getItem('speedo_units') || 'km/h');
    const [showSettings, setShowSettings] = useState(false);
    const [isStarted, setIsStarted] = useState(() => localStorage.getItem('speedo_started') === 'true');
    const [isAutoPaused, setIsAutoPaused] = useState(false);
    const [isOrientationLocked, setIsOrientationLocked] = useState(false);
    const [isScreenLocked, setIsScreenLocked] = useState(false); // Combined lock state
    const [showResetConfirm, setShowResetConfirm] = useState(false);
    const [distanceUnit, setDistanceUnit] = useState<'m' | 'km'>(() =>
        (localStorage.getItem('speedo_dist_unit') as 'm' | 'km') || 'km'
    );
    // Auto-pause feature toggle (OFF by default)
    const [autoPauseEnabled, setAutoPauseEnabled] = useState(() =>
        localStorage.getItem('speedo_auto_pause') === 'true'
    );

    // Wake lock ref
    const wakeLockRef = useRef<WakeLockSentinel | null>(null);

    // Last GPS update timestamp for speed-to-zero timeout
    const lastGpsUpdateRef = useRef<number>(Date.now());

    // Refs for real-time data (avoid state update overhead)
    const isStartedRef = useRef(isStarted);
    const lastTap = useRef(0);
    const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastPos = useRef<Position | null>(null);
    const speedProcessorRef = useRef<SpeedProcessor>(new SpeedProcessor());
    const lastDisplayUpdateRef = useRef<number>(0);
    const rawSpeedRef = useRef<number>(0);
    const smoothedSpeedRef = useRef<number>(0);
    const displaySpeedRef = useRef<number>(0);    // Current displayed speed (for rolling counter)
    const targetSpeedRef = useRef<number>(0);     // Target speed to animate towards
    const lastFrameTimeRef = useRef<number>(Date.now()); // For delta time calculation
    const isAutoPausedRef = useRef(false);        // Ref for immediate auto-pause checks

    // State for UI display
    const [gps, setGps] = useState({
        speed: 0,
        rawSpeed: 0,
        lat: 0,
        lon: 0,
        accuracy: 0,
        signalQuality: 'poor' as 'excellent' | 'good' | 'fair' | 'poor',
        isCalculatedSpeed: false,
        lastUpdate: Date.now()
    });
    const [status, setStatus] = useState<'inactive' | 'searching' | 'stable' | 'excellent'>('inactive');
    const [currentTime, setCurrentTime] = useState(new Date());
    const [elapsedTime, setElapsedTime] = useState(() => parseInt(localStorage.getItem('speedo_elapsed') || '0'));

    const [trip, setTrip] = useState(() => {
        const saved = localStorage.getItem('speedo_trip_v7');
        return saved ? JSON.parse(saved) : { dist: 0, max: 0 };
    });

    // Sync ref with state
    useEffect(() => {
        isStartedRef.current = isStarted;
    }, [isStarted]);

    // High-frequency clock update
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // High-frequency UI refresh with ROLLING COUNTER effect
    useEffect(() => {
        let animationFrameId: number;

        const updateDisplay = () => {
            const now = Date.now();
            const deltaTime = (now - lastFrameTimeRef.current) / 1000; // seconds
            lastFrameTimeRef.current = now;

            // Check for GPS timeout - return to zero if no updates
            const timeSinceLastGps = now - lastGpsUpdateRef.current;
            let targetSpeedMps = rawSpeedRef.current;

            if (timeSinceLastGps > CONFIG.SPEED_ZERO_TIMEOUT_MS) {
                // No GPS updates for 3 seconds - set target to 0
                targetSpeedMps = 0;
                rawSpeedRef.current = 0;
            }

            // Get target speed in display units (km/h or mph)
            const conversionFactor = units === 'mph' ? MPH_CONVERSION : KMH_CONVERSION;
            const targetDisplaySpeed = targetSpeedMps * conversionFactor;
            targetSpeedRef.current = targetDisplaySpeed;

            // Rolling counter effect: move towards target at a controlled rate
            const currentDisplay = displaySpeedRef.current;
            const diff = targetDisplaySpeed - currentDisplay;

            // Calculate max step based on speed difference
            // Faster counting when difference is large, slower when close
            const baseSpeed = 50; // Base units per second
            const dynamicSpeed = Math.max(baseSpeed, Math.abs(diff) * 3); // Scale with difference
            const maxStep = dynamicSpeed * deltaTime;

            let newDisplaySpeed: number;
            if (Math.abs(diff) < 0.1) {
                // Close enough, snap to target
                newDisplaySpeed = targetDisplaySpeed;
            } else if (diff > 0) {
                // Counting UP
                newDisplaySpeed = currentDisplay + Math.min(maxStep, diff);
            } else {
                // Counting DOWN  
                newDisplaySpeed = currentDisplay - Math.min(maxStep, Math.abs(diff));
            }

            displaySpeedRef.current = newDisplaySpeed;
            smoothedSpeedRef.current = newDisplaySpeed / conversionFactor; // Store in m/s

            // Only update state at controlled intervals to prevent excessive re-renders
            if (now - lastDisplayUpdateRef.current >= CONFIG.UI_REFRESH_INTERVAL_MS) {
                lastDisplayUpdateRef.current = now;
                setGps(prev => ({
                    ...prev,
                    speed: smoothedSpeedRef.current
                }));
            }

            animationFrameId = requestAnimationFrame(updateDisplay);
        };

        animationFrameId = requestAnimationFrame(updateDisplay);
        return () => cancelAnimationFrame(animationFrameId);
    }, [units]);

    // Elapsed time counter
    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        if (isStarted && !isAutoPaused) {
            interval = setInterval(() => {
                setElapsedTime(prev => {
                    const next = prev + 1;
                    localStorage.setItem('speedo_elapsed', next.toString());
                    return next;
                });
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isStarted, isAutoPaused]);

    // Persist trip data
    useEffect(() => {
        localStorage.setItem('speedo_trip_v7', JSON.stringify(trip));
        localStorage.setItem('speedo_started', isStarted.toString());
    }, [trip, isStarted]);

    // Haversine distance calculation with higher precision
    const getDistance = useCallback((p1: { lat: number; lon: number }, p2: { lat: number; lon: number }): number => {
        const R = 6371e3; // Earth's radius in meters
        const φ1 = p1.lat * Math.PI / 180;
        const φ2 = p2.lat * Math.PI / 180;
        const Δφ = (p2.lat - p1.lat) * Math.PI / 180;
        const Δλ = (p2.lon - p1.lon) * Math.PI / 180;
        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }, []);

    // Process incoming GPS position with enhanced precision
    const handleUpdate = useCallback((pos: Position | null) => {
        if (!pos || !pos.coords) return;

        const { coords, timestamp } = pos;
        const now = timestamp || Date.now();

        // Reject poor accuracy readings
        if (coords.accuracy > CONFIG.MAX_ACCEPTABLE_ACCURACY) {
            setStatus('searching');
            return;
        }

        // Determine signal quality
        let signalQuality: 'excellent' | 'good' | 'fair' | 'poor' = 'poor';
        let statusValue: 'inactive' | 'searching' | 'stable' | 'excellent' = 'searching';

        if (coords.accuracy <= 5) {
            signalQuality = 'excellent';
            statusValue = 'excellent';
        } else if (coords.accuracy <= CONFIG.GOOD_ACCURACY_THRESHOLD) {
            signalQuality = 'good';
            statusValue = 'stable';
        } else if (coords.accuracy <= 20) {
            signalQuality = 'fair';
            statusValue = 'stable';
        }

        setStatus(statusValue);

        // Process speed with Kalman filter and smoothing
        const speedProcessor = speedProcessorRef.current;
        const { speed: processedSpeed, isCalculated } = speedProcessor.processSpeed(
            coords.speed,
            coords.accuracy,
            coords.latitude,
            coords.longitude,
            now
        );

        // Update raw speed ref for interpolation
        rawSpeedRef.current = processedSpeed;

        // Update last GPS update timestamp for speed-to-zero timeout
        lastGpsUpdateRef.current = now;

        // Update GPS state
        setGps(prev => ({
            ...prev,
            rawSpeed: coords.speed || 0,
            lat: coords.latitude,
            lon: coords.longitude,
            accuracy: coords.accuracy,
            signalQuality,
            isCalculatedSpeed: isCalculated,
            lastUpdate: now
        }));

        // Auto-pause logic (ONLY if enabled in settings)
        if (autoPauseEnabled && isStartedRef.current) {
            const wasPaused = isAutoPausedRef.current;
            let shouldPause: boolean;

            if (wasPaused) {
                // Currently paused - need higher speed to resume
                shouldPause = processedSpeed < CONFIG.AUTO_RESUME_THRESHOLD_MPS;
            } else {
                // Currently running - pause at lower threshold
                shouldPause = processedSpeed < CONFIG.AUTO_PAUSE_THRESHOLD_MPS;
            }

            isAutoPausedRef.current = shouldPause;
            setIsAutoPaused(shouldPause);
        } else {
            // Auto-pause disabled - always running
            isAutoPausedRef.current = false;
            setIsAutoPaused(false);
        }

        // Distance and max speed calculations
        // ALWAYS accumulate when moving, even during auto-pause transitions
        if (isStartedRef.current && lastPos.current && lastPos.current.coords) {
            const lastCoords = lastPos.current.coords;
            const dist = getDistance(
                { lat: lastCoords.latitude, lon: lastCoords.longitude },
                { lat: coords.latitude, lon: coords.longitude }
            );

            const timeDiffSec = (now - (lastPos.current.timestamp || now)) / 1000;

            // More relaxed distance validation
            const isValidDistance = dist >= CONFIG.MIN_DISTANCE_FOR_UPDATE;
            const isMoving = processedSpeed >= CONFIG.MIN_SPEED_FOR_DISTANCE || dist > 2;
            const maxPossibleDistance = Math.max(processedSpeed, 1) * Math.max(timeDiffSec, 0.1) * 2.0; // 200% tolerance
            const isReasonable = dist <= maxPossibleDistance || timeDiffSec > 3;

            setTrip((prev: { dist: number; max: number }) => {
                let newDist = prev.dist;
                let newMax = prev.max;

                // Add distance if valid
                if (isValidDistance && isMoving && isReasonable) {
                    newDist += dist;
                }

                // Update max speed
                if (processedSpeed > newMax) {
                    newMax = processedSpeed;
                }

                return { dist: newDist, max: newMax };
            });
        }

        lastPos.current = pos;
    }, [getDistance]);

    // Start GPS watch with optimized settings
    useEffect(() => {
        let watchId: string;

        const startWatch = async () => {
            try {
                const permissions = await Geolocation.checkPermissions();
                if (permissions.location !== 'granted') {
                    await Geolocation.requestPermissions();
                }

                // Configure for maximum accuracy and update frequency
                watchId = await Geolocation.watchPosition(
                    {
                        enableHighAccuracy: true,
                        timeout: 10000,
                        maximumAge: 0, // Don't use cached positions
                    },
                    (position, err) => {
                        if (err) {
                            console.error('GPS Error:', err);
                            setStatus('inactive');
                            return;
                        }
                        handleUpdate(position);
                    }
                );

                setStatus('searching');
            } catch (err) {
                console.error("Location error", err);
                setStatus('inactive');
            }
        };

        startWatch();

        return () => {
            if (watchId) {
                Geolocation.clearWatch({ id: watchId });
            }
        };
    }, [handleUpdate]);

    const requestManualPermission = async () => {
        try {
            const result = await Geolocation.requestPermissions();
            if (result.location === 'granted') {
                alert('Location Access Granted');
                window.location.reload();
            } else {
                alert('Location Access Denied');
            }
        } catch (err: any) {
            alert('Error: ' + err.message);
        }
    };

    // ===========================================
    // SCREEN LOCK FUNCTIONS
    // ===========================================

    // Request wake lock to prevent screen from turning off
    const requestWakeLock = async (): Promise<boolean> => {
        try {
            if ('wakeLock' in navigator) {
                wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
                wakeLockRef.current?.addEventListener('release', () => {
                    console.log('Wake Lock released');
                });
                console.log('Wake Lock acquired');
                return true;
            }
        } catch (err: any) {
            console.error('Wake Lock error:', err.message);
        }
        return false;
    };

    // Release wake lock
    const releaseWakeLock = async () => {
        try {
            if (wakeLockRef.current) {
                await wakeLockRef.current.release();
                wakeLockRef.current = null;
                console.log('Wake Lock released manually');
            }
        } catch (err) {
            console.error('Error releasing wake lock:', err);
        }
    };

    // Request fullscreen mode
    const enterFullscreen = async (): Promise<boolean> => {
        try {
            if (!document.fullscreenElement) {
                await document.documentElement.requestFullscreen();
                return true;
            }
            return true; // Already in fullscreen
        } catch (err) {
            console.error('Fullscreen error:', err);
            return false;
        }
    };

    // Exit fullscreen mode
    const exitFullscreen = async () => {
        try {
            if (document.fullscreenElement) {
                await document.exitFullscreen();
            }
        } catch (err) {
            console.error('Exit fullscreen error:', err);
        }
    };

    // Lock orientation to current orientation
    const lockOrientation = async (): Promise<boolean> => {
        try {
            const orientationType = (screen.orientation as any).type;
            await (screen.orientation as any).lock(orientationType);
            setIsOrientationLocked(true);
            return true;
        } catch (err: any) {
            console.error('Orientation lock error:', err.message);
            return false;
        }
    };

    // Unlock orientation
    const unlockOrientation = () => {
        try {
            (screen.orientation as any).unlock();
            setIsOrientationLocked(false);
        } catch (err) {
            console.error('Orientation unlock error:', err);
        }
    };

    // Toggle complete screen lock (fullscreen + orientation + wake lock)
    const toggleScreenLock = async () => {
        if (navigator.vibrate) navigator.vibrate(50); // Haptic feedback

        if (!isScreenLocked) {
            // LOCK: Enable fullscreen, orientation lock, and wake lock
            const fullscreenOk = await enterFullscreen();

            if (fullscreenOk) {
                // Small delay to ensure fullscreen is active before locking orientation
                await new Promise(resolve => setTimeout(resolve, 100));

                const orientationOk = await lockOrientation();
                const wakeLockOk = await requestWakeLock();

                if (orientationOk || wakeLockOk) {
                    setIsScreenLocked(true);
                    if (navigator.vibrate) navigator.vibrate([50, 50, 50]); // Triple vibration = locked
                }
            }
        } else {
            // UNLOCK: Release everything
            await releaseWakeLock();
            unlockOrientation();
            await exitFullscreen();
            setIsScreenLocked(false);
            if (navigator.vibrate) navigator.vibrate(100); // Long vibration = unlocked
        }
    };

    // Touch handlers
    const handleTouchStart = () => {
        // Start long press timer for screen lock
        longPressTimer.current = setTimeout(() => {
            toggleScreenLock();
        }, 800); // 800ms long press
    };

    const handleTouchEnd = () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
    };

    const handleTouchMove = () => {
        // Cancel long press if user moves finger
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
    };

    const confirmReset = () => {
        // Reset speed processor state
        speedProcessorRef.current.reset();
        rawSpeedRef.current = 0;
        smoothedSpeedRef.current = 0;
        displaySpeedRef.current = 0;
        targetSpeedRef.current = 0;
        isAutoPausedRef.current = false;
        lastPos.current = null;

        // Reset trip data
        setTrip({ dist: 0, max: 0 });
        setElapsedTime(0);
        setIsStarted(false);
        setIsAutoPaused(false);
        setGps(prev => ({ ...prev, speed: 0, rawSpeed: 0 }));

        localStorage.setItem('speedo_elapsed', '0');
        setShowResetConfirm(false);
    };

    const formatTime = (date: Date) => date.toLocaleTimeString('en-US', { hour12: false });
    const formatElapsed = (s: number) => {
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sec = s % 60;
        return [h, m, sec].map(v => v.toString().padStart(2, '0')).join(':');
    };

    // Display calculations
    const displaySpeed = (gps.speed * (units === 'mph' ? MPH_CONVERSION : KMH_CONVERSION)).toFixed(1);

    // Distance display with unit toggle support
    const getDisplayDistance = () => {
        const distMeters = trip.dist; // trip.dist is in meters
        if (units === 'mph') {
            // Miles
            return (distMeters * 0.000621371).toFixed(2);
        } else {
            // Kilometers or Meters based on distanceUnit
            if (distanceUnit === 'm') {
                return distMeters.toFixed(0);
            } else {
                return (distMeters / 1000).toFixed(2);
            }
        }
    };
    const displayDist = getDisplayDistance();
    const distUnitLabel = units === 'mph' ? 'MI' : (distanceUnit === 'm' ? 'M' : 'KM');

    const displayMax = (trip.max * (units === 'mph' ? MPH_CONVERSION : KMH_CONVERSION)).toFixed(1);

    // Toggle distance unit
    const toggleDistanceUnit = () => {
        const newUnit = distanceUnit === 'km' ? 'm' : 'km';
        setDistanceUnit(newUnit);
        localStorage.setItem('speedo_dist_unit', newUnit);
    };

    return (
        <div className="device-container" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} onTouchMove={handleTouchMove}>
            <div className="lcd-screen">
                <div className="hdr">
                    <div className="flex items-center gap-2" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div className={`status-dot ${status}`}></div>
                        <span style={{ fontSize: '7px', opacity: 0.5, fontFamily: 'monospace' }}>
                            ±{gps.accuracy.toFixed(0)}m
                        </span>
                        {isAutoPaused && <span style={{ fontSize: '8px', fontWeight: 'bold', color: '#eab308' }}>AUTO PAUSE</span>}
                        {gps.isCalculatedSpeed && <span style={{ fontSize: '7px', color: '#f97316' }}>CALC</span>}
                        {isScreenLocked && (
                            <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '12px', height: '12px', color: '#00ff88' }}>
                                <path d="M12 17c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm6-9h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM8.9 6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2H8.9V6z" />
                            </svg>
                        )}
                    </div>
                    <button onClick={() => setShowSettings(true)} className="btn" style={{ padding: 0, opacity: 0.2 }}>
                        <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '14px', height: '14px' }}>
                            <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
                        </svg>
                    </button>
                </div>

                <div className="speed-main">
                    <h1 className="digital-font speed-value">{displaySpeed}</h1>
                    <div className="unit-display">
                        <span style={{ opacity: units === 'mph' ? 1 : 0.1 }}>MPH</span>
                        <span style={{ opacity: units === 'km/h' ? 1 : 0.1 }}>KM/H</span>
                    </div>
                </div>

                <div className="divider"></div>

                <div className="stats-container">
                    <div className="stats-row">
                        <div className="stat-block" onClick={toggleDistanceUnit} style={{ cursor: 'pointer' }}>
                            <span className="stat-label">DST <span style={{ fontSize: '6px', opacity: 0.4 }}>(tap)</span></span>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                                <span className="stat-value digital-font">{displayDist}</span>
                                <span className="text-[9px] opacity-20 font-bold" style={{ fontSize: '9px', opacity: 0.4, fontWeight: 'bold' }}>{distUnitLabel}</span>
                            </div>
                        </div>
                        <div className="stat-block" style={{ alignItems: 'flex-end' }}>
                            <span className="stat-label">MXS</span>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                                <span className="stat-value digital-font">{displayMax}</span>
                                <span className="text-[9px] opacity-20 font-bold" style={{ fontSize: '9px', opacity: 0.2, fontWeight: 'bold' }}>{units === 'mph' ? 'MPH' : 'KM/H'}</span>
                            </div>
                        </div>
                    </div>

                    <div className="divider"></div>

                    <div className="stats-row">
                        <div className="stat-block">
                            <span className="stat-label">CLOCK</span>
                            <span className="stat-value digital-font" style={{ fontSize: '18px' }}>{formatTime(currentTime)}</span>
                        </div>
                        <div className="stat-block" style={{ alignItems: 'flex-end' }}>
                            <span className="stat-label">TIMER</span>
                            <span className="stat-value digital-font" style={{ fontSize: '18px', color: isStarted ? '#fff' : '#444' }}>{formatElapsed(elapsedTime)}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="controls">
                <button className={`btn ${isStarted ? 'active' : ''}`} onClick={() => setIsStarted(!isStarted)}>
                    <svg viewBox="0 0 24 24">
                        {isStarted ? <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /> : <path d="M8 5v14l11-7z" />}
                    </svg>
                </button>
                <button className="btn" onClick={() => setShowResetConfirm(true)}>
                    <svg viewBox="0 0 24 24"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" /></svg>
                </button>
            </div>

            {showSettings && (
                <div className="modal-overlay" style={{ display: 'flex' }} onClick={() => setShowSettings(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <h3>Speed Unit</h3>
                        <div className="unit-toggle">
                            <button className={units === 'mph' ? 'active' : ''} onClick={() => { setUnits('mph'); localStorage.setItem('speedo_units', 'mph'); }}>MPH</button>
                            <button className={units === 'km/h' ? 'active' : ''} onClick={() => { setUnits('km/h'); localStorage.setItem('speedo_units', 'km/h'); }}>KM/H</button>
                        </div>

                        {units === 'km/h' && (
                            <>
                                <h3>Distance Unit</h3>
                                <div className="unit-toggle">
                                    <button className={distanceUnit === 'm' ? 'active' : ''} onClick={() => { setDistanceUnit('m'); localStorage.setItem('speedo_dist_unit', 'm'); }}>METERS</button>
                                    <button className={distanceUnit === 'km' ? 'active' : ''} onClick={() => { setDistanceUnit('km'); localStorage.setItem('speedo_dist_unit', 'km'); }}>KM</button>
                                </div>
                            </>
                        )}

                        <h3>Auto-Pause Timer</h3>
                        <p style={{ fontSize: '10px', opacity: 0.5, marginBottom: '10px', marginTop: 0 }}>
                            Pauses the timer when you stop moving
                        </p>
                        <div className="unit-toggle">
                            <button className={!autoPauseEnabled ? 'active' : ''} onClick={() => { setAutoPauseEnabled(false); localStorage.setItem('speedo_auto_pause', 'false'); }}>OFF</button>
                            <button className={autoPauseEnabled ? 'active' : ''} onClick={() => { setAutoPauseEnabled(true); localStorage.setItem('speedo_auto_pause', 'true'); }}>ON</button>
                        </div>

                        <h3>Permissions</h3>
                        <button
                            className="w-full py-4 bg-white/5 border border-white/10 rounded-xl font-bold mb-4 active:bg-white/10"
                            style={{ width: '100%', padding: '16px 0', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontWeight: 'bold', marginBottom: '16px' }}
                            onClick={requestManualPermission}
                        >
                            Grant Location Access
                        </button>
                        <button className="close-btn" onClick={() => setShowSettings(false)}>DONE</button>
                    </div>
                </div>
            )}

            {showResetConfirm && (
                <div className="modal-overlay" style={{ display: 'flex', zIndex: 1000 }}>
                    <div className="modal" style={{ textAlign: 'center' }}>
                        <p style={{ fontWeight: 'bold', fontSize: '18px', marginBottom: '20px' }}>Reset all data?</p>
                        <div className="confirm-btns">
                            <button className="btn-yes" onClick={confirmReset}>Reset</button>
                            <button className="btn-no" style={{ marginLeft: '10px' }} onClick={() => setShowResetConfirm(false)}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default App;
