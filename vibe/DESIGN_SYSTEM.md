# Design System Guide

## Overview

This boilerplate uses **Unistyles 3.0** as the primary styling system, providing powerful theme support, breakpoints, and cross-platform styling. The legacy `designTokens` approach is kept for backward compatibility but should not be used in new code.

## Quick Start (Unistyles - Recommended)

```tsx
import { StyleSheet, useUnistyles } from 'react-native-unistyles'
import { View, Text } from 'react-native'

const MyComponent = () => {
  const { theme } = useUnistyles()

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Hello</Text>
    </View>
  )
}

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: theme.spacing.md,
  },
  title: {
    fontSize: theme.typography.sizes['2xl'],
    lineHeight: theme.typography.lineHeights['2xl'],
    color: theme.colors.foreground,
  },
}))
```

## Unistyles Theme System

### Theme Colors

Unistyles provides semantic color tokens that automatically adapt between light and dark themes:

```tsx
const { theme } = useUnistyles()

// Semantic colors (adapt to theme)
theme.colors.foreground          // Primary text color
theme.colors.foregroundSecondary // Secondary text
theme.colors.foregroundTertiary  // Tertiary/muted text

theme.colors.background          // Main background
theme.colors.backgroundSecondary // Secondary background
theme.colors.backgroundTertiary  // Tertiary background

theme.colors.primary             // Primary brand color
theme.colors.secondary           // Secondary brand color
theme.colors.accent              // Accent color

theme.colors.card                // Card background
theme.colors.border              // Border color
theme.colors.input               // Input background

// State colors
theme.colors.success             // Success states
theme.colors.error               // Error states
theme.colors.warning             // Warning states
theme.colors.info                // Info states

// Access raw palette
theme.colors.palette.primary500  // Direct palette access
```

### Typography

```tsx
const { theme } = useUnistyles()

// Font sizes
theme.typography.sizes.xs        // 12
theme.typography.sizes.sm        // 14
theme.typography.sizes.base      // 16
theme.typography.sizes.lg        // 18
theme.typography.sizes.xl        // 20
theme.typography.sizes['2xl']    // 24
theme.typography.sizes['3xl']    // 30
theme.typography.sizes['4xl']    // 36
theme.typography.sizes['5xl']    // 48

// Line heights (always use with font sizes!)
theme.typography.lineHeights.base  // 24
theme.typography.lineHeights['2xl'] // 32

// Font families (Platform-aware)
theme.typography.fonts.regular
theme.typography.fonts.medium
theme.typography.fonts.semiBold
theme.typography.fonts.bold
```

### Spacing

```tsx
const { theme } = useUnistyles()

theme.spacing.xxxs   // 2
theme.spacing.xxs    // 4
theme.spacing.xs     // 8
theme.spacing.sm     // 12
theme.spacing.md     // 16
theme.spacing.lg     // 24
theme.spacing.xl     // 32
theme.spacing['2xl'] // 40
theme.spacing['3xl'] // 48
theme.spacing['4xl'] // 64
theme.spacing['5xl'] // 80

// Helper function
theme.gap(2)  // 16 (2 * 8)
```

### Border Radius

```tsx
theme.radius.none    // 0
theme.radius.xs      // 4
theme.radius.sm      // 8
theme.radius.md      // 12
theme.radius.lg      // 16
theme.radius.xl      // 20
theme.radius['2xl']  // 24
theme.radius['3xl']  // 32
theme.radius.full    // 9999
```

### Shadows

```tsx
// Platform-aware shadows
theme.shadows.none
theme.shadows.xs
theme.shadows.sm
theme.shadows.md
theme.shadows.lg
theme.shadows.xl
```

### Theme Switching

```tsx
import { UnistylesRuntime } from 'react-native-unistyles'

// Get current theme
const isDark = UnistylesRuntime.themeName === 'dark'

// Switch theme
UnistylesRuntime.setTheme('dark')
UnistylesRuntime.setTheme('light')

// Enable adaptive themes (follows system)
UnistylesRuntime.setAdaptiveThemes(true)
```

## Legacy Design Tokens (Deprecated)

> **⚠️ DEPRECATED:** The `designTokens` approach is legacy code kept for backward compatibility. New components should use Unistyles.

<details>
<summary>Legacy designTokens Quick Start (for reference only)</summary>

```tsx
import { designTokens, gradients, commonStyles } from '@/theme/designTokens'
import { StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'

const MyComponent = () => (
  <LinearGradient {...gradients.primary} style={styles.gradient}>
    <View style={commonStyles.card}>
      <Text style={styles.title}>Hello</Text>
    </View>
  </LinearGradient>
)

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  title: {
    ...designTokens.typography.headingLG,
    color: designTokens.colors.textPrimary,
  },
})
```
</details>

### Colors (Legacy)

```tsx
// Primary
designTokens.colors.primary         // #000000 - Buttons
designTokens.colors.secondary       // #F3F4F6 - Secondary buttons

// Text
designTokens.colors.textPrimary     // #000000 - Main text
designTokens.colors.textSecondary   // #6B7280 - Subtitles
designTokens.colors.textTertiary    // #9CA3AF - Placeholders
designTokens.colors.textLabel       // #374151 - Labels

// Backgrounds
designTokens.colors.backgroundLight   // #F9FAFB - Inputs
designTokens.colors.backgroundMedium  // #F3F4F6 - Secondary
designTokens.colors.backgroundWhite   // #FFFFFF - Cards

// Gradients
designTokens.colors.gradientStart    // #E0F2FE
designTokens.colors.gradientMiddle   // #FAF5FF
designTokens.colors.gradientEnd      // #FEF2F2
```

### Typography

**CRITICAL: Always include lineHeight to prevent text clipping!**

```tsx
// Headings
designTokens.typography.headingXL    // 32px, line 40
designTokens.typography.headingLG    // 28px, line 36
designTokens.typography.headingMD    // 24px, line 32

// Body
designTokens.typography.bodyLG       // 17px, line 26
designTokens.typography.bodyMD       // 16px, line 24
designTokens.typography.bodySM       // 15px, line 22

// Others
designTokens.typography.label        // 14px, line 20
designTokens.typography.button       // 17px, line 24

// Usage
const styles = StyleSheet.create({
  title: {
    ...designTokens.typography.headingLG,  // Includes fontSize, lineHeight, fontWeight
    color: designTokens.colors.textPrimary,
  }
})
```

### Custom Fonts

The boilerplate uses **Space Grotesk** from Google Fonts as the default custom font. You can easily add your own custom fonts.

#### Current Font Configuration

See `apps/app/app/theme/typography.ts` for the full font configuration:

```tsx
import {
  SpaceGrotesk_400Regular as spaceGroteskRegular,
  SpaceGrotesk_700Bold as spaceGroteskBold,
} from "@expo-google-fonts/space-grotesk"

export const customFontsToLoad = {
  spaceGroteskRegular,
  spaceGroteskBold,
}
```

#### Adding a Google Font

1. **Install the font package**:
   ```bash
   yarn expo install @expo-google-fonts/your-font-name
   ```

2. **Import and register in `typography.ts`**:
   ```tsx
   import {
     YourFont_400Regular,
     YourFont_700Bold,
   } from "@expo-google-fonts/your-font-name"

   export const customFontsToLoad = {
     ...customFontsToLoad,
     yourFontRegular: YourFont_400Regular,
     yourFontBold: YourFont_700Bold,
   }
   ```

3. **Add to font families**:
   ```tsx
   const fonts = {
     yourFont: {
       normal: "yourFontRegular",
       bold: "yourFontBold",
     },
   }
   ```

4. **Use in Unistyles theme** (`apps/app/app/theme/unistyles.ts`):
   ```tsx
   typography: {
     fonts: {
       primary: fonts.yourFont.normal,
       bold: fonts.yourFont.bold,
     }
   }
   ```

#### Adding a Custom Font File

1. **Add font files** to `apps/app/assets/fonts/`:
   ```
   apps/app/assets/fonts/
   ├── CustomFont-Regular.ttf
   └── CustomFont-Bold.ttf
   ```

2. **Register in `typography.ts`**:
   ```tsx
   export const customFontsToLoad = {
     ...customFontsToLoad,
     customFontRegular: require("@/assets/fonts/CustomFont-Regular.ttf"),
     customFontBold: require("@/assets/fonts/CustomFont-Bold.ttf"),
   }
   ```

3. **Add to font families and use** (same as step 3-4 above)

#### Font Loading

Fonts are automatically loaded in `apps/app/app/app.tsx` using `useFonts()`:

```tsx
const [fontsLoaded] = useFonts(customFontsToLoad)
if (!fontsLoaded) return null
```

The app waits for fonts to load before rendering to prevent FOUT (Flash of Unstyled Text).

### Spacing

```tsx
designTokens.spacing.xs     // 8
designTokens.spacing.sm     // 12
designTokens.spacing.md     // 16
designTokens.spacing.lg     // 24
designTokens.spacing.xl     // 32
designTokens.spacing.xxl    // 48
```

### Border Radius

```tsx
designTokens.borderRadius.md      // 12
designTokens.borderRadius.lg      // 16
designTokens.borderRadius.xl      // 20
designTokens.borderRadius.card    // 32 - For cards/modals
designTokens.borderRadius.full    // 9999 - Circles
```

### Shadows

```tsx
designTokens.shadows.sm     // Subtle
designTokens.shadows.md     // Buttons
designTokens.shadows.lg     // Cards
designTokens.shadows.xl     // Modals
designTokens.shadows.bottom // Bottom sheets
```

### Emojis

**Always use emoji helpers to prevent clipping:**

```tsx
<Text style={designTokens.emoji.medium}>✨</Text>

// Includes fontSize AND lineHeight
designTokens.emoji.small    // 24px, line 32
designTokens.emoji.medium   // 32px, line 40
designTokens.emoji.large    // 48px, line 56
designTokens.emoji.xlarge   // 120px, line 128
```

## Common Styles

Pre-built style objects for common patterns:

```tsx
import { commonStyles } from '@/theme/designTokens'

// Card
<View style={commonStyles.card}>

// Primary Button
<TouchableOpacity style={commonStyles.buttonPrimary}>

// Secondary Button
<TouchableOpacity style={commonStyles.buttonSecondary}>

// Input
<TextInput style={commonStyles.input}>

// Back Button (frosted glass)
<TouchableOpacity style={commonStyles.backButton}>

// Bottom Sheet Modal
<View style={commonStyles.modalCard}>
```

## Gradients

```tsx
import { LinearGradient } from 'expo-linear-gradient'
import { gradients } from '@/theme/designTokens'

<LinearGradient {...gradients.primary} style={styles.gradient}>
  {/* Content */}
</LinearGradient>

// Available gradients:
gradients.primary  // Blue → Purple → Pink
gradients.subtle   // Light gray gradient
```

## Screen Template

> **Web scroll caveat**: don't wrap a `ScrollView` inside a `LinearGradient` that uses `flex:1 + minHeight:100vh`. Stacking two `100vh`-floor layers between the navigator viewport and the `ScrollView` breaks ScrollView's height constraint on web — content past the fold becomes unreachable. Render the gradient as an absolutely-positioned background instead (`StyleSheet.absoluteFill`, `pointerEvents="none"`) so the `ScrollView` is a direct child of the screen container.

```tsx
import { View, StyleSheet, ScrollView, TouchableOpacity, TextInput, Platform } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { LinearGradient } from "expo-linear-gradient"
import { designTokens, gradients, commonStyles } from "@/theme/designTokens"
import { Text } from "@/components"

export const MyScreen = () => {
  return (
    <View style={styles.container}>
      <LinearGradient
        {...gradients.primary}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={commonStyles.card}>
            <Text style={styles.title}>Title</Text>
            <TextInput style={commonStyles.input} />
            <TouchableOpacity style={commonStyles.buttonPrimary}>
              <Text style={styles.buttonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // On web, give the screen a fixed height so the inner ScrollView can overflow.
    ...(Platform.OS === "web" && { height: "100%" as unknown as number }),
  },
  safeArea: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: designTokens.spacing.lg,
    paddingVertical: designTokens.spacing.xl,
  },
  title: {
    ...designTokens.typography.headingLG,
    color: designTokens.colors.textPrimary,
    marginBottom: designTokens.spacing.md,
  },
  buttonText: {
    ...designTokens.typography.button,
    color: designTokens.colors.backgroundWhite,
  },
})
```

## Best Practices

### ✅ DO

- Import design tokens at the top of every file
- Use StyleSheet.create() for styles
- Always set lineHeight for text
- Use ...spread for typography tokens
- Use gradients for screen backgrounds
- Use commonStyles for standard patterns

### ❌ DON'T

- Hardcode color values (#000000)
- Hardcode spacing numbers (24)
- Forget lineHeight (causes clipping!)
- Use inline styles except for dynamic values
- Create inconsistent button/input styles

## Common Patterns

### Input with Label

```tsx
<View style={styles.inputContainer}>
  <Text style={styles.label}>Email</Text>
  <TextInput
    style={commonStyles.input}
    placeholder="Enter email"
    placeholderTextColor={designTokens.colors.textTertiary}
  />
</View>

const styles = StyleSheet.create({
  inputContainer: {
    marginBottom: designTokens.spacing.lg,
  },
  label: {
    ...designTokens.typography.label,
    color: designTokens.colors.textLabel,
    marginBottom: designTokens.spacing.xs,
  },
})
```

### Card with Shadow

```tsx
<View style={[commonStyles.card, styles.customPadding]}>
  {/* Content */}
</View>

const styles = StyleSheet.create({
  customPadding: {
    padding: designTokens.spacing.lg,
  },
})
```

### Bottom Modal

```tsx
<SafeAreaView style={styles.safeArea} edges={["bottom"]}>
  <View style={commonStyles.modalCard}>
    {/* Modal content */}
  </View>
</SafeAreaView>
```

## Migration from Old Code

If you see old code with hardcoded values:

```tsx
// OLD
const styles = StyleSheet.create({
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#000000",
    marginBottom: 16,
  }
})

// NEW
const styles = StyleSheet.create({
  title: {
    ...designTokens.typography.headingLG,
    color: designTokens.colors.textPrimary,
    marginBottom: designTokens.spacing.md,
  }
})
```

## Troubleshooting

**Text is clipped at the top?**
→ Add lineHeight (use typography tokens)

**Emoji is cut off?**
→ Use `designTokens.emoji.medium` which includes lineHeight

**Colors look wrong?**
→ Check you're using `designTokens.colors.*` not hardcoded hex

**Spacing inconsistent?**
→ Use `designTokens.spacing.*` instead of numbers

## For Customers/Developers

When building on this boilerplate:

1. **Always import designTokens first**
2. **Use the screen template above**
3. **Never hardcode colors or spacing**
4. **Always set lineHeight for text**
5. **Use commonStyles for standard components**
6. **Check existing screens for patterns**

This keeps the codebase consistent and makes it easy for anyone (including AI) to add new features quickly.
