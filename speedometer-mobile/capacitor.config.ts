import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
    appId: 'com.jmafk.speedometerpro',
    appName: 'Speedometer Pro',
    webDir: 'dist',
    server: {
        androidScheme: 'https'
    }
};

export default config;
