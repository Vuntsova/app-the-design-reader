import { useCallback, useState, useEffect } from "react"
import type { ViewStyle } from "react-native"
import { View, Pressable, Image, Alert, Platform, Linking } from "react-native"
import * as DocumentPicker from "expo-document-picker"
import * as ImagePicker from "expo-image-picker"
import { Ionicons } from "@expo/vector-icons"
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  FadeIn,
  FadeOut,
  Layout,
} from "react-native-reanimated"
import { StyleSheet, useUnistyles } from "react-native-unistyles"

import { SPRING_CONFIG } from "@/utils/animations"
import { logger } from "@/utils/Logger"

import { Text, TextProps } from "./Text"

// =============================================================================
// PERMISSION STATUS
// =============================================================================

type PermissionStatus = "granted" | "denied" | "undetermined" | "not_configured"

// =============================================================================
// TYPES
// =============================================================================

type FileType = "image" | "document" | "any"

export interface PickedFile {
  uri: string
  name: string
  type: string
  size?: number
}

export interface FilePickerProps {
  /**
   * Currently selected files
   */
  value?: PickedFile[]
  /**
   * Callback when files change
   */
  onChange?: (files: PickedFile[]) => void
  /**
   * Callback when a file is removed
   */
  onRemove?: (file: PickedFile) => void
  /**
   * Type of files to pick
   */
  fileType?: FileType
  /**
   * Allow multiple file selection
   */
  multiple?: boolean
  /**
   * Maximum number of files (only for multiple)
   */
  maxFiles?: number
  /**
   * Maximum file size in bytes
   */
  maxFileSize?: number
  /**
   * Allowed file extensions (for documents)
   */
  allowedExtensions?: string[]
  /**
   * Label text
   */
  label?: string
  /**
   * Label translation key
   */
  labelTx?: TextProps["tx"]
  /**
   * Placeholder text
   */
  placeholder?: string
  /**
   * Placeholder translation key
   */
  placeholderTx?: TextProps["tx"]
  /**
   * Error message
   */
  error?: string
  /**
   * Error translation key
   */
  errorTx?: TextProps["tx"]
  /**
   * Helper text
   */
  helper?: string
  /**
   * Helper translation key
   */
  helperTx?: TextProps["tx"]
  /**
   * Disabled state
   */
  disabled?: boolean
  /**
   * Show image preview for image files
   */
  showPreview?: boolean
  /**
   * Compact mode - inline file display
   */
  compact?: boolean
  /**
   * Additional style
   */
  style?: ViewStyle
  /**
   * Test ID
   */
  testID?: string
}

// =============================================================================
// HELPERS
// =============================================================================

const formatFileSize = (bytes?: number): string => {
  if (!bytes) return "Unknown size"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const getFileIcon = (type: string): keyof typeof Ionicons.glyphMap => {
  if (type.startsWith("image/")) return "image-outline"
  if (type.startsWith("video/")) return "videocam-outline"
  if (type.startsWith("audio/")) return "musical-notes-outline"
  if (type.includes("pdf")) return "document-text-outline"
  if (type.includes("word") || type.includes("document")) return "document-outline"
  if (type.includes("sheet") || type.includes("excel")) return "grid-outline"
  if (type.includes("zip") || type.includes("rar")) return "archive-outline"
  return "document-outline"
}

const EXTENSION_MIME_MAP: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
  csv: "text/csv",
  json: "application/json",
  zip: "application/zip",
  rar: "application/vnd.rar",
}

const normalizeExtension = (ext: string) => ext.replace(/^\./, "").toLowerCase()

const getDocumentPickerTypes = (allowedExtensions?: string[]) => {
  if (!allowedExtensions?.length) return "*/*"

  const mimeTypes = allowedExtensions
    .map(normalizeExtension)
    .map((ext) => EXTENSION_MIME_MAP[ext])
    .filter(Boolean)

  return mimeTypes.length > 0 ? mimeTypes : "*/*"
}

/**
 * Check if photo library permissions are configured
 * Returns the current permission status
 * iOS: Checks for NSPhotoLibraryUsageDescription in Info.plist
 * Android: Checks for READ_MEDIA_IMAGES/READ_EXTERNAL_STORAGE in AndroidManifest.xml
 */
const checkPhotoPermissions = async (): Promise<PermissionStatus> => {
  // Web doesn't need permissions
  if (Platform.OS === "web") return "granted"

  try {
    const { status } = await ImagePicker.getMediaLibraryPermissionsAsync()

    // Map expo status to our status type
    if (status === "granted") return "granted"
    if (status === "denied") return "denied"
    return "undetermined"
  } catch (error) {
    // If there's an error checking permissions, it likely means
    // the permission keys are not configured (iOS: Info.plist, Android: AndroidManifest.xml)
    logger.warn("Photo library permission check failed - may not be configured", { error })
    return "not_configured"
  }
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * A file picker component for selecting images and documents.
 *
 * @example
 * // Basic image picker
 * <FilePicker
 *   value={selectedFiles}
 *   onChange={setSelectedFiles}
 *   fileType="image"
 *   label="Profile Picture"
 * />
 *
 * // Document picker
 * <FilePicker
 *   value={selectedDocs}
 *   onChange={setSelectedDocs}
 *   fileType="document"
 *   label="Upload Documents"
 *   multiple
 * />
 *
 * // Any file type with preview
 * <FilePicker
 *   value={files}
 *   onChange={setFiles}
 *   fileType="any"
 *   showPreview
 *   multiple
 *   maxFiles={5}
 * />
 */
export function FilePicker(props: FilePickerProps) {
  const {
    value = [],
    onChange,
    onRemove,
    fileType = "any",
    multiple = false,
    maxFiles = 10,
    maxFileSize,
    allowedExtensions,
    label,
    labelTx,
    placeholder = "Tap to select files",
    placeholderTx,
    error,
    errorTx,
    helper,
    helperTx,
    disabled = false,
    showPreview = true,
    compact = false,
    style,
    testID,
  } = props

  const { theme } = useUnistyles()
  const [isLoading, setIsLoading] = useState(false)
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>("undetermined")
  const [showPermissionWarning, setShowPermissionWarning] = useState(false)
  const normalizedAllowedExtensions = allowedExtensions?.map(normalizeExtension)

  const scale = useSharedValue(1)

  // Check permissions on mount for image file types
  useEffect(() => {
    if (fileType === "image" || fileType === "any") {
      checkPhotoPermissions().then((status) => {
        setPermissionStatus(status)
        // Show warning if not configured/denied to explain next steps.
        setShowPermissionWarning(status === "not_configured" || status === "denied")
      })
    }
  }, [fileType])

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  const handlePressIn = useCallback(() => {
    if (!disabled) {
      scale.value = withSpring(0.98, SPRING_CONFIG)
    }
  }, [disabled, scale])

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, SPRING_CONFIG)
  }, [scale])

  const validateFile = useCallback(
    (file: PickedFile): boolean => {
      // Check file size
      if (maxFileSize && file.size && file.size > maxFileSize) {
        Alert.alert(
          "File Too Large",
          `${file.name} exceeds the maximum file size of ${formatFileSize(maxFileSize)}`,
        )
        return false
      }

      // Check allowed extensions
      if (normalizedAllowedExtensions && normalizedAllowedExtensions.length > 0) {
        const ext = file.name.split(".").pop()?.toLowerCase()
        if (!ext || !normalizedAllowedExtensions.includes(ext)) {
          Alert.alert(
            "Invalid File Type",
            `${file.name} is not an allowed file type. Allowed: ${normalizedAllowedExtensions.join(", ")}`,
          )
          return false
        }
      }

      return true
    },
    [maxFileSize, normalizedAllowedExtensions],
  )

  const showPermissionSetupAlert = useCallback(() => {
    const setupMessage = Platform.select({
      ios: "To use the image picker, add NSPhotoLibraryUsageDescription to your Info.plist and rebuild the app.\n\nSee the expo-image-picker docs for setup instructions.",
      android:
        "To use the image picker, ensure READ_MEDIA_IMAGES permission is in your AndroidManifest.xml (added automatically by expo-image-picker plugin).\n\nRun 'npx expo prebuild --clean' to regenerate the native project.",
      default:
        "To use the image picker, ensure your app has the required permissions configured.\n\nSee the expo-image-picker docs for setup instructions.",
    })

    Alert.alert("Setup Required", setupMessage, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Open Settings",
        onPress: () => Linking.openSettings(),
      },
    ])
  }, [])

  const pickImage = useCallback(async () => {
    // If permissions aren't configured, show setup instructions
    if (permissionStatus === "not_configured") {
      showPermissionSetupAlert()
      return
    }

    try {
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (status !== "granted") {
        setPermissionStatus("denied")
        setShowPermissionWarning(true)
        Alert.alert(
          "Permission Required",
          "Please allow access to your photo library to select images.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Open Settings", onPress: () => Linking.openSettings() },
          ],
        )
        return
      }

      setPermissionStatus("granted")
      setShowPermissionWarning(false)

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: multiple,
        quality: 0.8,
        selectionLimit: multiple ? maxFiles - value.length : 1,
      })

      if (!result.canceled && result.assets) {
        const newFiles: PickedFile[] = result.assets.map((asset) => ({
          uri: asset.uri,
          name: asset.fileName || asset.uri.split("/").pop() || "image",
          type: asset.mimeType || "image/jpeg",
          size: asset.fileSize,
        }))

        // Validate files
        const validFiles = newFiles.filter(validateFile)

        if (validFiles.length > 0) {
          if (multiple) {
            const totalFiles = [...value, ...validFiles].slice(0, maxFiles)
            onChange?.(totalFiles)
          } else {
            onChange?.(validFiles.slice(0, 1))
          }
        }
      }
    } catch (err) {
      // Check if this is a permission configuration error
      const errorMessage = err instanceof Error ? err.message : String(err)
      if (
        errorMessage.includes("NSPhotoLibraryUsageDescription") ||
        errorMessage.includes("Info.plist")
      ) {
        setPermissionStatus("not_configured")
        setShowPermissionWarning(true)
        showPermissionSetupAlert()
      } else {
        logger.error("Error picking image", { error: err })
        Alert.alert("Error", "Failed to pick image. Please try again.")
      }
    }
  }, [
    multiple,
    maxFiles,
    value,
    onChange,
    validateFile,
    permissionStatus,
    showPermissionSetupAlert,
  ])

  const pickDocument = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        multiple,
        copyToCacheDirectory: true,
        type: getDocumentPickerTypes(allowedExtensions),
      })

      if (!result.canceled && result.assets) {
        const newFiles: PickedFile[] = result.assets.map((asset) => ({
          uri: asset.uri,
          name: asset.name,
          type: asset.mimeType || "application/octet-stream",
          size: asset.size,
        }))

        // Validate files
        const validFiles = newFiles.filter(validateFile)

        if (validFiles.length > 0) {
          if (multiple) {
            const totalFiles = [...value, ...validFiles].slice(0, maxFiles)
            onChange?.(totalFiles)
          } else {
            onChange?.(validFiles.slice(0, 1))
          }
        }
      }
    } catch (err) {
      logger.error("Error picking document", { error: err })
      Alert.alert("Error", "Failed to pick document. Please try again.")
    }
  }, [multiple, maxFiles, value, onChange, validateFile, allowedExtensions])

  const handlePick = useCallback(async () => {
    if (disabled || isLoading) return

    setIsLoading(true)

    try {
      if (fileType === "image") {
        await pickImage()
      } else if (fileType === "document") {
        await pickDocument()
      } else {
        // Show action sheet for "any" type
        Alert.alert("Select File Type", "What type of file would you like to select?", [
          { text: "Image", onPress: pickImage },
          { text: "Document", onPress: pickDocument },
          { text: "Cancel", style: "cancel" },
        ])
      }
    } finally {
      setIsLoading(false)
    }
  }, [disabled, isLoading, fileType, pickImage, pickDocument])

  const handleRemove = useCallback(
    (file: PickedFile) => {
      onRemove?.(file)
      const newFiles = value.filter((f) => f.uri !== file.uri)
      onChange?.(newFiles)
    },
    [value, onChange, onRemove],
  )

  const hasError = !!error || !!errorTx
  const canAddMore = multiple ? value.length < maxFiles : value.length === 0

  // Determine if the picker should be effectively disabled due to permission issues
  const isPermissionBlocked = permissionStatus === "not_configured" || permissionStatus === "denied"
  const effectivelyDisabled = disabled || (fileType === "image" && isPermissionBlocked)

  return (
    <View style={[styles.wrapper, style]} testID={testID}>
      {/* Label */}
      {(label || labelTx) && (
        <Text text={label} tx={labelTx} weight="medium" size="sm" style={styles.label} />
      )}

      {/* Permission Warning Banner */}
      {showPermissionWarning && (fileType === "image" || fileType === "any") && (
        <Pressable style={styles.warningBanner} onPress={showPermissionSetupAlert}>
          <Ionicons name="warning-outline" size={18} color={theme.colors.warning} />
          <Text size="xs" style={styles.warningText}>
            {permissionStatus === "not_configured"
              ? "Photo permissions not configured. Tap for setup instructions."
              : "Photo access denied. Tap to open settings."}
          </Text>
          <Ionicons name="chevron-forward" size={14} color={theme.colors.foregroundTertiary} />
        </Pressable>
      )}

      {/* Pick Button */}
      {canAddMore && (
        <Pressable
          onPress={handlePick}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={effectivelyDisabled || isLoading}
          accessibilityRole="button"
          accessibilityLabel={label || "File picker"}
          accessibilityState={{ disabled: effectivelyDisabled || isLoading }}
        >
          <Animated.View
            style={[
              compact ? styles.inputCompact : styles.input,
              hasError && styles.inputError,
              effectivelyDisabled && styles.inputDisabled,
              animatedStyle,
            ]}
          >
            <View style={[styles.inputContent, compact && styles.inputContentCompact]}>
              <View
                style={[
                  styles.iconContainer,
                  compact && styles.iconContainerCompact,
                  {
                    backgroundColor:
                      fileType === "image"
                        ? theme.colors.palette.primary100
                        : theme.colors.palette.secondary100,
                  },
                ]}
              >
                <Ionicons
                  name={fileType === "image" ? "image-outline" : "document-attach-outline"}
                  size={compact ? 18 : 28}
                  color={
                    fileType === "image"
                      ? theme.colors.palette.primary500
                      : theme.colors.palette.secondary500
                  }
                />
              </View>
              <View style={compact ? styles.textContainerCompact : styles.textContainer}>
                <Text
                  text={placeholder}
                  tx={placeholderTx}
                  size={compact ? "sm" : "base"}
                  weight="medium"
                  style={styles.placeholder}
                />
                {!compact && (
                  <Text
                    text={
                      fileType === "image"
                        ? "PNG, JPG, GIF up to 10MB"
                        : fileType === "document"
                          ? "PDF, DOC, XLS up to 10MB"
                          : "Any file type up to 10MB"
                    }
                    size="xs"
                    style={styles.hint}
                  />
                )}
              </View>
              {!compact && (
                <View style={styles.browseButton}>
                  <Text text="Browse" size="sm" weight="semiBold" style={styles.browseText} />
                </View>
              )}
            </View>
          </Animated.View>
        </Pressable>
      )}

      {/* Selected Files */}
      {value.length > 0 && (
        <Animated.View
          style={styles.filesContainer}
          entering={FadeIn.duration(200)}
          layout={Layout.springify()}
        >
          {value.map((file, index) => (
            <Animated.View
              key={file.uri}
              style={styles.fileItem}
              entering={FadeIn.duration(200).delay(index * 50)}
              exiting={FadeOut.duration(150)}
              layout={Layout.springify()}
            >
              {/* Preview or Icon */}
              {showPreview && file.type.startsWith("image/") ? (
                <Image source={{ uri: file.uri }} style={styles.preview} />
              ) : (
                <View style={styles.fileIconContainer}>
                  <Ionicons
                    name={getFileIcon(file.type)}
                    size={24}
                    color={theme.colors.foregroundSecondary}
                  />
                </View>
              )}

              {/* File Info */}
              <View style={styles.fileInfo}>
                <Text text={file.name} numberOfLines={1} weight="medium" size="sm" />
                <Text text={formatFileSize(file.size)} size="xs" style={styles.fileSize} />
              </View>

              {/* Remove Button */}
              {!disabled && (
                <Pressable
                  onPress={() => handleRemove(file)}
                  style={styles.removeButton}
                  hitSlop={8}
                >
                  <Ionicons name="close" size={16} color={theme.colors.foregroundSecondary} />
                </Pressable>
              )}
            </Animated.View>
          ))}
        </Animated.View>
      )}

      {/* File Count */}
      {multiple && value.length > 0 && (
        <Text
          text={`${value.length} / ${maxFiles} files selected`}
          size="xs"
          style={styles.fileCount}
        />
      )}

      {/* Helper/Error Text */}
      {(helper || helperTx || error || errorTx) && (
        <Text
          text={error || helper}
          tx={errorTx || helperTx}
          size="xs"
          style={[styles.helper, hasError && styles.helperError]}
        />
      )}
    </View>
  )
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create((theme) => ({
  wrapper: {
    width: "100%",
  },
  label: {
    marginBottom: theme.spacing.xs,
    color: theme.colors.foreground,
  },
  warningBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.palette.accent100,
    borderRadius: theme.radius.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.palette.accent200,
  },
  warningText: {
    flex: 1,
    color: theme.colors.palette.accent500,
  },
  input: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: theme.colors.border,
    borderRadius: theme.radius.xl,
    ...theme.shadows.sm,
  },
  inputCompact: {
    flexDirection: "row",
    alignItems: "center",
    height: theme.sizes.input.md,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    gap: theme.spacing.sm,
  },
  inputError: {
    borderColor: theme.colors.error,
  },
  inputDisabled: {
    opacity: 0.5,
  },
  inputContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
  },
  inputContentCompact: {
    gap: theme.spacing.sm,
  },
  iconContainer: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radius.lg,
  },
  iconContainerCompact: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.md,
  },
  textContainer: {
    flex: 1,
    gap: theme.spacing.xxs,
  },
  textContainerCompact: {
    flex: 1,
  },
  placeholder: {
    color: theme.colors.foreground,
  },
  hint: {
    color: theme.colors.foregroundTertiary,
  },
  browseButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.foreground,
    borderRadius: theme.radius.md,
  },
  browseText: {
    color: theme.colors.card,
  },
  filesContainer: {
    marginTop: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  fileItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: theme.spacing.md,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: theme.spacing.md,
    ...theme.shadows.sm,
  },
  preview: {
    width: 52,
    height: 52,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.backgroundSecondary,
  },
  fileIconContainer: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.palette.secondary100,
    borderRadius: theme.radius.lg,
  },
  fileInfo: {
    flex: 1,
    gap: theme.spacing.xxs,
  },
  fileSize: {
    color: theme.colors.foregroundTertiary,
  },
  removeButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.backgroundSecondary,
  },
  fileCount: {
    marginTop: theme.spacing.xs,
    color: theme.colors.foregroundSecondary,
    textAlign: "right",
  },
  helper: {
    marginTop: theme.spacing.xs,
    color: theme.colors.foregroundSecondary,
  },
  helperError: {
    color: theme.colors.error,
  },
}))
