export interface DeviceControlsPlugin {
    setBrightness(options: { value: number }): Promise<void>;
    getBrightness(): Promise<{ value: number }>;
    setVolume(options: { value: number }): Promise<void>;
    getVolume(): Promise<{ value: number }>;
}
