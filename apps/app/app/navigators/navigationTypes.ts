import { ComponentProps } from "react"
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs"
import {
  CompositeScreenProps,
  NavigationContainer,
  NavigatorScreenParams,
} from "@react-navigation/native"
import { NativeStackScreenProps } from "@react-navigation/native-stack"

// Main Tab Navigator types
export type PaywallParams = {
  fromOnboarding?: boolean
}

export type MainTabParamList = {
  Home: undefined
  Components: undefined
  Profile: undefined
  Paywall: PaywallParams | undefined
}

// App Stack Navigator types
export type AppStackParamList = {
  Onboarding: undefined
  Login: undefined
  Register: undefined
  ForgotPassword: undefined
  ResetPassword: { code?: string; token?: string; email?: string } | undefined
  EmailVerification: undefined
  MagicLink: undefined
  OTPVerification: { email: string; isConvex?: boolean }
  AuthCallback:
    | {
        code?: string
        access_token?: string
        refresh_token?: string
        state?: string
        type?: string
      }
    | undefined
  Starter: undefined
  Paywall: PaywallParams | undefined
  Profile: undefined
  Welcome: undefined
  ComponentShowcase: undefined
  DataDemo: undefined
  Main: NavigatorScreenParams<MainTabParamList>
  // 🔥 Your screens go here
  // SHIPNATIVE_GENERATOR_ANCHOR_APP_STACK_PARAM_LIST
}

export type AppStackScreenProps<T extends keyof AppStackParamList> = NativeStackScreenProps<
  AppStackParamList,
  T
>

export type MainTabScreenProps<T extends keyof MainTabParamList> = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, T>,
  AppStackScreenProps<keyof AppStackParamList>
>

export interface NavigationProps extends Partial<
  ComponentProps<typeof NavigationContainer<AppStackParamList>>
> {}
