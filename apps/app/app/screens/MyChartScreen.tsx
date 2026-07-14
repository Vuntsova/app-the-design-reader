import { useState, type FC } from "react"
import { View } from "react-native"
import { StyleSheet } from "react-native-unistyles"

import { useChart } from "@/hooks"

import { BodyGraph } from "@/components/BodyGraph"
import { Container } from "@/components/Container"
import { ProfileSwitcher } from "@/components/ProfileSwitcher"
import { Tabs, type Tab } from "@/components/Tabs"
import { Text } from "@/components/Text"

import { translate, type TxKeyPath } from "@/i18n"
import type { AppStackScreenProps } from "@/navigators/navigationTypes"
import type { Center, Chart, ChartRequest } from "@/services/chart"
import { useActiveProfile } from "@/stores/profiles"

// The 9 HD centers, in canonical top-to-bottom order for the list.
const CENTERS: Center[] = [
  "Head",
  "Ajna",
  "Throat",
  "G",
  "Heart",
  "Spleen",
  "Solar Plexus",
  "Sacral",
  "Root",
]

const TABS: Tab[] = [
  { key: "bodygraph", tx: "myChartScreen:tabs.bodyGraph" },
  { key: "about", tx: "myChartScreen:tabs.about" },
  { key: "centers", tx: "myChartScreen:tabs.centers" },
  { key: "gates", tx: "myChartScreen:tabs.gates" },
  { key: "channels", tx: "myChartScreen:tabs.channels" },
]

export const MyChartScreen: FC<AppStackScreenProps<"MyChart">> = () => {
  const [activeTab, setActiveTab] = useState<string>("bodygraph")
  const activeProfile = useActiveProfile()
  const request: ChartRequest | undefined = activeProfile
    ? {
        name: activeProfile.name,
        date: activeProfile.date,
        time: activeProfile.time,
        location: activeProfile.location,
      }
    : undefined
  const { data, isFetching, error } = useChart(request, activeProfile?.id)
  const chart = data?.chart

  return (
    <Container preset="scroll" safeAreaEdges={["top", "bottom"]}>
      <View style={styles.container}>
        <ProfileSwitcher />

        <Text preset="heading" tx="myChartScreen:title" />

        {!activeProfile ? (
          <Text tx="myChartScreen:noActiveProfile" color="secondary" />
        ) : isFetching && !chart ? (
          <Text tx="myChartScreen:loading" color="secondary" />
        ) : error ? (
          <Text color="error">
            {error instanceof Error ? error.message : String(error)}
          </Text>
        ) : !chart ? (
          <Text tx="myChartScreen:noData" color="secondary" />
        ) : (
          <>
            <Tabs
              tabs={TABS}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              style={styles.tabs}
            />
            {activeTab === "bodygraph" && (
              <BodyGraph chart={chart} style={styles.bodyGraph} />
            )}
            {activeTab === "about" && <AboutTab chart={chart} />}
            {activeTab === "centers" && <CentersTab chart={chart} />}
            {activeTab === "gates" && <GatesTab chart={chart} />}
            {activeTab === "channels" && <ChannelsTab chart={chart} />}
          </>
        )}
      </View>
    </Container>
  )
}

const AboutTab: FC<{ chart: Chart }> = ({ chart }) => (
  <View style={styles.section}>
    <Row labelTx="myChartScreen:about.type" value={chart.type} />
    <Row labelTx="myChartScreen:about.strategy" value={chart.strategy} />
    <Row labelTx="myChartScreen:about.authority" value={chart.authority} />
    <Row labelTx="myChartScreen:about.profile" value={chart.profile} />
    <Row labelTx="myChartScreen:about.signature" value={chart.signature} />
    <Row
      labelTx="myChartScreen:about.notSelfTheme"
      value={chart.not_self_theme}
    />
  </View>
)

const CentersTab: FC<{ chart: Chart }> = ({ chart }) => {
  const defined = new Set(chart.defined_centers)
  return (
    <View style={styles.section}>
      {CENTERS.map((center) => (
        <Row
          key={center}
          label={center}
          value={
            defined.has(center)
              ? translate("myChartScreen:status.defined")
              : translate("myChartScreen:status.undefined")
          }
        />
      ))}
    </View>
  )
}

const GatesTab: FC<{ chart: Chart }> = ({ chart }) => {
  const sorted = [...chart.active_gates].sort((a, b) => a - b)
  return (
    <View style={styles.section}>
      <Text
        size="sm"
        color="secondary"
        tx="myChartScreen:gatesCount"
        txOptions={{ count: sorted.length }}
      />
      <View style={styles.gateList}>
        {sorted.map((gate) => (
          <Text key={gate} style={styles.gateItem}>
            {gate}
          </Text>
        ))}
      </View>
    </View>
  )
}

const ChannelsTab: FC<{ chart: Chart }> = ({ chart }) => {
  const sorted = [...chart.active_channels].sort(([a], [b]) => a - b)
  return (
    <View style={styles.section}>
      <Text
        size="sm"
        color="secondary"
        tx="myChartScreen:channelsCount"
        txOptions={{ count: sorted.length }}
      />
      {sorted.map(([a, b]) => (
        <Text key={`${a}-${b}`}>{`${a}-${b}`}</Text>
      ))}
    </View>
  )
}

interface RowProps {
  labelTx?: TxKeyPath
  label?: string
  value?: string
}

const Row: FC<RowProps> = ({ labelTx, label, value }) => (
  <View style={styles.row}>
    <Text
      tx={labelTx}
      text={label}
      weight="semiBold"
      size="sm"
      color="secondary"
    />
    <Text>{value ?? "—"}</Text>
  </View>
)

const styles = StyleSheet.create((theme) => ({
  container: {
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  tabs: {
    marginBottom: theme.spacing.md,
  },
  bodyGraph: {
    width: "100%",
    aspectRatio: 980 / 850,
  },
  section: {
    gap: theme.spacing.sm,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.separator,
    gap: theme.spacing.md,
  },
  gateList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.md,
  },
  gateItem: {
    minWidth: 24,
  },
}))
