package com.jmafk.movienight.plugins;

import android.content.Context;
import android.media.AudioManager;
import android.provider.Settings;
import android.view.WindowManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "DeviceControls")
public class DeviceControlsPlugin extends Plugin {

    @PluginMethod
    public void setBrightness(PluginCall call) {
        float brightness = call.getFloat("value", 0.5f);
        
        // Clamp between 0 and 1
        final float finalBrightness = Math.max(0.0f, Math.min(1.0f, brightness));
        
        getActivity().runOnUiThread(new Runnable() {
            @Override
            public void run() {
                WindowManager.LayoutParams layout = getActivity().getWindow().getAttributes();
                layout.screenBrightness = finalBrightness;
                getActivity().getWindow().setAttributes(layout);
                call.resolve();
            }
        });
    }

    @PluginMethod
    public void getBrightness(PluginCall call) {
        getActivity().runOnUiThread(new Runnable() {
            @Override
            public void run() {
                WindowManager.LayoutParams layout = getActivity().getWindow().getAttributes();
                float brightness = layout.screenBrightness;
                
                // If brightness is -1, it means it's using system brightness
                if (brightness < 0) {
                    try {
                        brightness = Settings.System.getInt(
                            getContext().getContentResolver(),
                            Settings.System.SCREEN_BRIGHTNESS
                        ) / 255.0f;
                    } catch (Settings.SettingNotFoundException e) {
                        brightness = 0.5f;
                    }
                }
                
                call.resolve(new JSObject().put("value", brightness));
            }
        });
    }

    @PluginMethod
    public void setVolume(PluginCall call) {
        float volume = call.getFloat("value", 0.5f);
        final float finalVolume = volume;
        
        getActivity().runOnUiThread(new Runnable() {
            @Override
            public void run() {
                AudioManager audioManager = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
                int maxVolume = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC);
                int volumeLevel = Math.round(finalVolume * maxVolume);
                audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, volumeLevel, 0);
                call.resolve();
            }
        });
    }

    @PluginMethod
    public void getVolume(PluginCall call) {
        getActivity().runOnUiThread(new Runnable() {
            @Override
            public void run() {
                AudioManager audioManager = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
                int currentVolume = audioManager.getStreamVolume(AudioManager.STREAM_MUSIC);
                int maxVolume = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC);
                float volume = (float) currentVolume / maxVolume;
                call.resolve(new JSObject().put("value", volume));
            }
        });
    }
}
