/**
 * Text Component Tests
 *
 * Tests text rendering, presets, sizes, weights, colors, and i18n translation.
 */

import { NavigationContainer } from "@react-navigation/native"
import { render } from "@testing-library/react-native"

import { ThemeProvider } from "../../theme/context"
import { Text } from "../Text"

// Mock @/i18n translate function (react-i18next is mocked in test/setup.ts)
jest.mock("@/i18n", () => ({
  translate: (key: string, options?: Record<string, unknown>) => {
    return `translated:${key}${options ? ` ${JSON.stringify(options)}` : ""}`
  },
  TxKeyPath: {} as unknown,
}))

describe("Text", () => {
  it("renders text content", () => {
    const { getByText } = render(
      <ThemeProvider>
        <NavigationContainer>
          <Text text="Test string" />
        </NavigationContainer>
      </ThemeProvider>,
    )
    expect(getByText("Test string")).toBeDefined()
  })

  it("renders children content", () => {
    const { getByText } = render(
      <ThemeProvider>
        <NavigationContainer>
          <Text>Child content</Text>
        </NavigationContainer>
      </ThemeProvider>,
    )
    expect(getByText("Child content")).toBeDefined()
  })

  it("renders with different presets", () => {
    const { getByText, rerender } = render(
      <ThemeProvider>
        <NavigationContainer>
          <Text text="Default" preset="default" />
        </NavigationContainer>
      </ThemeProvider>,
    )
    expect(getByText("Default")).toBeDefined()

    rerender(
      <ThemeProvider>
        <NavigationContainer>
          <Text text="Heading" preset="heading" />
        </NavigationContainer>
      </ThemeProvider>,
    )
    expect(getByText("Heading")).toBeDefined()

    rerender(
      <ThemeProvider>
        <NavigationContainer>
          <Text text="Subheading" preset="subheading" />
        </NavigationContainer>
      </ThemeProvider>,
    )
    expect(getByText("Subheading")).toBeDefined()

    rerender(
      <ThemeProvider>
        <NavigationContainer>
          <Text text="Caption" preset="caption" />
        </NavigationContainer>
      </ThemeProvider>,
    )
    expect(getByText("Caption")).toBeDefined()
  })

  it("renders with different sizes", () => {
    const { getByText, rerender } = render(
      <ThemeProvider>
        <NavigationContainer>
          <Text text="Small" size="sm" />
        </NavigationContainer>
      </ThemeProvider>,
    )
    expect(getByText("Small")).toBeDefined()

    rerender(
      <ThemeProvider>
        <NavigationContainer>
          <Text text="Large" size="lg" />
        </NavigationContainer>
      </ThemeProvider>,
    )
    expect(getByText("Large")).toBeDefined()

    rerender(
      <ThemeProvider>
        <NavigationContainer>
          <Text text="Extra Large" size="xl" />
        </NavigationContainer>
      </ThemeProvider>,
    )
    expect(getByText("Extra Large")).toBeDefined()
  })

  it("renders with different weights", () => {
    const { getByText, rerender } = render(
      <ThemeProvider>
        <NavigationContainer>
          <Text text="Regular" weight="regular" />
        </NavigationContainer>
      </ThemeProvider>,
    )
    expect(getByText("Regular")).toBeDefined()

    rerender(
      <ThemeProvider>
        <NavigationContainer>
          <Text text="Bold" weight="bold" />
        </NavigationContainer>
      </ThemeProvider>,
    )
    expect(getByText("Bold")).toBeDefined()

    rerender(
      <ThemeProvider>
        <NavigationContainer>
          <Text text="SemiBold" weight="semiBold" />
        </NavigationContainer>
      </ThemeProvider>,
    )
    expect(getByText("SemiBold")).toBeDefined()
  })

  it("renders with different colors", () => {
    const { getByText, rerender } = render(
      <ThemeProvider>
        <NavigationContainer>
          <Text text="Primary" color="primary" />
        </NavigationContainer>
      </ThemeProvider>,
    )
    expect(getByText("Primary")).toBeDefined()

    rerender(
      <ThemeProvider>
        <NavigationContainer>
          <Text text="Error" color="error" />
        </NavigationContainer>
      </ThemeProvider>,
    )
    expect(getByText("Error")).toBeDefined()

    rerender(
      <ThemeProvider>
        <NavigationContainer>
          <Text text="Success" color="success" />
        </NavigationContainer>
      </ThemeProvider>,
    )
    expect(getByText("Success")).toBeDefined()
  })

  it("prioritizes text prop over children", () => {
    const { getByText, queryByText } = render(
      <ThemeProvider>
        <NavigationContainer>
          <Text text="Text prop">Children content</Text>
        </NavigationContainer>
      </ThemeProvider>,
    )
    expect(getByText("Text prop")).toBeDefined()
    expect(queryByText("Children content")).toBeNull()
  })

  it("renders with i18n translation key", () => {
    const { getByText } = render(
      <ThemeProvider>
        <NavigationContainer>
          <Text tx="common:ok" />
        </NavigationContainer>
      </ThemeProvider>,
    )
    // The mock returns "translated:common:ok"
    expect(getByText(/translated:common:ok/)).toBeDefined()
  })

  it("applies custom style override", () => {
    const customStyle = { opacity: 0.5 }
    const { getByText } = render(
      <ThemeProvider>
        <NavigationContainer>
          <Text text="Styled" style={customStyle} />
        </NavigationContainer>
      </ThemeProvider>,
    )
    expect(getByText("Styled")).toBeDefined()
  })
})
