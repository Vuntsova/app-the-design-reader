import { DEEP_LINK_SCHEME, handleDeepLink, parseDeepLink } from "../deepLinking"

describe("deepLinking", () => {
  it("parses custom scheme deep links that use the host as the screen", () => {
    const token = `${"a".repeat(20)}.${"b".repeat(20)}.${"c".repeat(20)}`
    const parsed = parseDeepLink(`${DEEP_LINK_SCHEME}://reset-password?token=${token}`)

    expect(parsed?.screen).toBe("reset-password")
    expect(parsed?.params?.token).toBe(token)
  })

  it("validates reset-password tokens", async () => {
    const validToken = `${"a".repeat(20)}.${"b".repeat(20)}.${"c".repeat(20)}`
    const invalidToken = "not-a-valid-token"

    const validResult = await handleDeepLink(
      `${DEEP_LINK_SCHEME}://reset-password?token=${validToken}`,
    )
    const invalidResult = await handleDeepLink(
      `${DEEP_LINK_SCHEME}://reset-password?token=${invalidToken}`,
    )

    expect(validResult?.screen).toBe("reset-password")
    expect(validResult?.params?.token).toBe(validToken)
    expect(invalidResult).toBeNull()
  })
})
