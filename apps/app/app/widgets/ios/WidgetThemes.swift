//
//  WidgetThemes.swift
//  Shipnative Widget Themes
//
//  Shared theme definitions for all widgets.
//  Users can customize these colors or add new themes.
//

import SwiftUI

// MARK: - Widget Themes

/// Pre-designed theme options for widgets
/// Users can customize these or create their own by modifying the color values
public enum WidgetTheme: String, CaseIterable {
    case aurora      // Deep purple to teal gradient - modern & elegant
    case sunset      // Warm orange to pink gradient - energetic & vibrant
    case ocean       // Deep blue to cyan gradient - calm & professional
    case forest      // Dark green to mint gradient - natural & refreshing
    case midnight    // Dark mode with subtle blue accents - sleek & minimal
    case minimal     // Clean white with sharp typography - classic & clean

    // MARK: - Background Gradients

    public var gradient: LinearGradient {
        switch self {
        case .aurora:
            return LinearGradient(
                colors: [
                    Color(red: 0.15, green: 0.08, blue: 0.35),
                    Color(red: 0.12, green: 0.25, blue: 0.45),
                    Color(red: 0.08, green: 0.35, blue: 0.42)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        case .sunset:
            return LinearGradient(
                colors: [
                    Color(red: 0.95, green: 0.35, blue: 0.25),
                    Color(red: 0.92, green: 0.50, blue: 0.35),
                    Color(red: 0.85, green: 0.28, blue: 0.45)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        case .ocean:
            return LinearGradient(
                colors: [
                    Color(red: 0.05, green: 0.15, blue: 0.35),
                    Color(red: 0.08, green: 0.30, blue: 0.55),
                    Color(red: 0.15, green: 0.50, blue: 0.65)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        case .forest:
            return LinearGradient(
                colors: [
                    Color(red: 0.08, green: 0.22, blue: 0.18),
                    Color(red: 0.12, green: 0.35, blue: 0.28),
                    Color(red: 0.25, green: 0.55, blue: 0.45)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        case .midnight:
            return LinearGradient(
                colors: [
                    Color(red: 0.08, green: 0.08, blue: 0.12),
                    Color(red: 0.10, green: 0.12, blue: 0.18),
                    Color(red: 0.12, green: 0.14, blue: 0.22)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        case .minimal:
            return LinearGradient(
                colors: [
                    Color(red: 0.98, green: 0.98, blue: 0.99),
                    Color(red: 0.95, green: 0.96, blue: 0.98)
                ],
                startPoint: .top,
                endPoint: .bottom
            )
        }
    }

    // MARK: - Text Colors

    public var primaryTextColor: Color {
        switch self {
        case .minimal:
            return Color(red: 0.12, green: 0.12, blue: 0.15)
        default:
            return .white
        }
    }

    public var secondaryTextColor: Color {
        switch self {
        case .minimal:
            return Color(red: 0.45, green: 0.45, blue: 0.50)
        default:
            return Color.white.opacity(0.7)
        }
    }

    // MARK: - Accent Colors

    public var accentColor: Color {
        switch self {
        case .aurora:
            return Color(red: 0.45, green: 0.85, blue: 0.95)  // Cyan glow
        case .sunset:
            return Color(red: 1.0, green: 0.85, blue: 0.40)   // Golden yellow
        case .ocean:
            return Color(red: 0.35, green: 0.85, blue: 0.95)  // Bright cyan
        case .forest:
            return Color(red: 0.55, green: 0.95, blue: 0.65)  // Mint green
        case .midnight:
            return Color(red: 0.45, green: 0.65, blue: 1.0)   // Electric blue
        case .minimal:
            return Color(red: 0.20, green: 0.40, blue: 0.95)  // Royal blue
        }
    }

    // MARK: - Card Backgrounds

    public var cardBackgroundColor: Color {
        switch self {
        case .minimal:
            return Color.white.opacity(0.8)
        default:
            return Color.white.opacity(0.08)
        }
    }

    // MARK: - Glass Effect Background

    @ViewBuilder
    public var glassBackground: some View {
        switch self {
        case .minimal:
            RoundedRectangle(cornerRadius: 16)
                .fill(Color.white.opacity(0.95))
                .shadow(color: Color.black.opacity(0.05), radius: 8, x: 0, y: 4)
        default:
            RoundedRectangle(cornerRadius: 16)
                .fill(.ultraThinMaterial)
                .opacity(0.6)
        }
    }

    // MARK: - Display Names

    public var displayName: String {
        switch self {
        case .aurora: return "Aurora"
        case .sunset: return "Sunset"
        case .ocean: return "Ocean"
        case .forest: return "Forest"
        case .midnight: return "Midnight"
        case .minimal: return "Minimal"
        }
    }

    public var description: String {
        switch self {
        case .aurora: return "Deep purple to teal with cyan accents"
        case .sunset: return "Warm orange and pink with golden highlights"
        case .ocean: return "Calm blue tones with bright cyan accents"
        case .forest: return "Natural greens with mint highlights"
        case .midnight: return "Dark mode with electric blue accents"
        case .minimal: return "Clean white with royal blue accents"
        }
    }
}

// MARK: - Theme Helper Extensions

extension WidgetTheme {
    /// Returns a contrasting error color that works with the theme
    public var errorColor: Color {
        switch self {
        case .minimal:
            return Color(red: 0.85, green: 0.25, blue: 0.25)
        case .sunset:
            return Color(red: 0.95, green: 0.90, blue: 0.30)  // Yellow for contrast on orange
        default:
            return Color(red: 1.0, green: 0.40, blue: 0.40)
        }
    }

    /// Returns whether this is a dark theme (for conditional styling)
    public var isDark: Bool {
        switch self {
        case .minimal:
            return false
        default:
            return true
        }
    }
}
