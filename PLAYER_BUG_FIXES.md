# Player UI Bug Fixes

## Summary
Fixed three critical bugs in the Android video player:

### 1. ✅ Volume/Brightness Gesture Controls
**Problem**: 
- Sliding gestures had very low sensitivity (only ~0.5% changes)
- Only controlled video volume, not device volume
- No brightness control
- No differentiation between left and right sides

**Solution**:
- **Increased sensitivity** from 0.1 multiplier to 1.0 multiplier for smoother adjustments
- **Right side swipes** now control **device volume** using Android's AudioManager
- **Left side swipes** now control **screen brightness** using Android's WindowManager
- Created custom Capacitor plugin `DeviceControlsPlugin` with native Android integration
- Added visual feedback showing "Volume" or "Brightness" during gestures
- Fallback to video volume on web platform

**Files Changed**:
- `components/Player.tsx` - Updated gesture handlers
- `android/app/src/main/java/com/jmafk/movienight/plugins/DeviceControlsPlugin.java` - New native plugin
- `android/app/src/main/java/com/jmafk/movienight/MainActivity.java` - Registered plugin
- `plugins/DeviceControlsPlugin.ts` - TypeScript interface

### 2. ✅ Subtitle Font Size Fix
**Problem**:
- Large font size when playing subtitled series (e.g., One Piece)
- Font could go up to 22px in landscape mode

**Solution**:
- Reduced maximum subtitle font size from 22px to 16px in landscape mode
- Desktop/portrait mode remains at 14px
- Settings panel still allows adjustment within safe range (10-32px slider, but capped at 16px max)

**Files Changed**:
- `components/Player.tsx` line 1081 - Changed `Math.min(subSettings.fontSize, 22)` to `Math.min(subSettings.fontSize, 16)`

### 3. ✅ Subtitle "Off" Button Fix
**Problem**:
- Off button sometimes didn't work properly
- Active subtitle cue text would remain visible even after turning subtitles off

**Solution**:
- Updated subtitle "Off" button to clear both `selectedSubtitle` state and `activeCue` text
- Now properly clears all subtitle-related state when disabled

**Files Changed**:
- `components/Player.tsx` line 861 - Added `setActiveCue('')` to the Off button click handler

### 4. ✅ Back Button Navigation Fix
**Problem**:
- When pressing back from video player, app would show splash screen instead of returning to home
- Android back button wasn't properly handled
- ESC key also had issues

**Solution**:
- Enhanced Android back button handler to call `onBack()` when not in episode selector
- Updated ESC key handler to navigate back when not in modals
- Removed problematic app exit logic that was interfering with navigation
- Now properly returns to home screen on both ESC and Android back button

**Files Changed**:
- `components/Player.tsx` lines 208-249 - Rewrote back button and ESC key handlers

## Technical Details

### Native Plugin Architecture
The `DeviceControlsPlugin` provides 4 methods:
```typescript
interface DeviceControlsPlugin {
  setBrightness(options: { value: number }): Promise<void>;
  getBrightness(): Promise<{ value: number }>;
  setVolume(options: { value: number }): Promise<void>;
  getVolume(): Promise<{ value: number }>;
}
```

### Gesture Flow
1. **Touch Start**: Determines left/right side, fetches initial brightness/volume
2. **Touch Move**: Calculates delta, applies to appropriate control (brightness or volume)
3. **Touch End**: Cleans up state and shows feedback briefly

### Build Status
✅ Successfully built and synced with Capacitor 8.0.0
✅ All native plugins registered
✅ TypeScript compilation successful

## Testing Checklist
- [ ] Test volume gesture on right side of screen
- [ ] Test brightness gesture on left side of screen
- [ ] Verify subtitle font size is reasonable
- [ ] Test subtitle "Off" button completely removes subtitles
- [ ] Test Android back button returns to home from player
- [ ] Test ESC key returns to home from player
- [ ] Test episode selector close with back button/ESC
- [ ] Verify no splash screen appears when navigating back

## Notes
- The brightness control uses per-window brightness, not system brightness
- Volume control directly modifies media volume stream
- All changes are backwards compatible with web platform
- Native features gracefully degrade to fallbacks on non-Android platforms
