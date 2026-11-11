import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { CycleRing } from '@/components/cycle/CycleRing';
import { CalendarLegend } from '@/components/cycle/MonthCalendar';
import { PhaseBadge } from '@/components/cycle/PhaseBadge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip, ChipGroup } from '@/components/ui/Chip';
import { Segmented, Stepper, TextField } from '@/components/ui/Controls';
import { Notice, SectionHeader, StatTile } from '@/components/ui/Feedback';
import { ListGroup, ListRow } from '@/components/ui/ListRow';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/theme';
import { typeScale, type Colors, type Phase, type TypeVariant } from '@/theme/tokens';

const SURFACE_KEYS: (keyof Colors)[] = [
  'background',
  'surface',
  'surfaceMuted',
  'border',
  'borderStrong',
  'ink',
  'inkMuted',
  'inkSubtle',
  'primary',
  'primarySoft',
];
const PHASES: Phase[] = ['menstrual', 'follicular', 'ovulatory', 'luteal'];

/** A living reference of the design system, reachable from Profile in dev builds. */
export default function DesignSystem() {
  const { colors, space, radii } = useTheme();
  const [chip, setChip] = useState(true);
  const [seg, setSeg] = useState<'a' | 'b' | 'c'>('a');
  const [step, setStep] = useState(28);
  const [toggle, setToggle] = useState(true);

  const swatch = (label: string, color: string) => (
    <View key={label} style={styles.swatchItem}>
      <View style={[styles.swatch, { backgroundColor: color, borderColor: colors.border, borderRadius: radii.sm }]} />
      <Text variant="caption">{label}</Text>
      <Text variant="caption" tone="muted">
        {color}
      </Text>
    </View>
  );

  return (
    <Screen
      nav="back"
      eyebrow="Bloom"
      title="Design system"
      subtitle="Tokens and components. Every colour pairing here passes WCAG AA."
      testID="design"
    >
      <SectionHeader title="Colour" />
      <View style={[styles.grid, { gap: space.md }]}>{SURFACE_KEYS.map((k) => swatch(k, colors[k] as string))}</View>

      <SectionHeader title="Cycle phases" />
      <View style={{ gap: space.md }}>
        {PHASES.map((p) => (
          <View key={p} style={[styles.grid, { gap: space.md, alignItems: 'center' }]}>
            {swatch(`${p}`, colors.phase[p].solid)}
            {swatch('soft', colors.phase[p].soft)}
            <PhaseBadge phase={p} />
          </View>
        ))}
      </View>

      <SectionHeader title="Type" />
      <View style={{ gap: space.sm }}>
        {(Object.keys(typeScale) as TypeVariant[]).map((v) => (
          <Text key={v} variant={v}>
            {v} · {typeScale[v].fontSize}/{typeScale[v].lineHeight}
          </Text>
        ))}
      </View>

      <SectionHeader title="Buttons" />
      <View style={{ gap: space.sm }}>
        <Button label="Primary action" icon="droplet" />
        <Button label="Secondary" variant="secondary" />
        <Button label="Soft" variant="soft" icon="edit-3" />
        <Button label="Ghost" variant="ghost" />
        <Button label="Delete" variant="danger" icon="trash-2" />
        <Button label="Loading" loading />
        <Button label="Disabled" disabled />
      </View>

      <SectionHeader title="Selection" />
      <ChipGroup>
        <Chip label="Cramps" icon="activity" selected={chip} onPress={() => setChip(!chip)} />
        <Chip label="Headache" icon="cloud-lightning" />
        <Chip label="Heavy" role="radio" selected tint={{ bg: colors.phase.menstrual.solid, fg: colors.phase.menstrual.onSolid }} />
        <Chip label="Calm" selected tint={{ bg: colors.phase.luteal.solid, fg: colors.phase.luteal.onSolid }} />
      </ChipGroup>
      <View style={{ height: space.lg }} />
      <Segmented
        label="Example"
        options={[
          { value: 'a', label: 'One' },
          { value: 'b', label: 'Two' },
          { value: 'c', label: 'Three' },
        ]}
        value={seg}
        onChange={setSeg}
      />
      <View style={{ height: space.xl }} />
      <Stepper label="Cycle length" value={step} min={15} max={90} unit="days" onChange={setStep} />
      <View style={{ height: space.xl }} />
      <TextField label="Text field" placeholder="Placeholder" hint="Helper text sits here." />
      <TextField label="With an error" value="12" error="Enter a four-digit year." />

      <SectionHeader title="Lists" />
      <ListGroup title="Group title">
        <ListRow icon="bell" title="Row with value" value="2 on" onPress={() => {}} />
        <ListRow
          icon="lock"
          title="Row with switch"
          subtitle="Subtitle explains the setting"
          toggle={{ value: toggle, onChange: setToggle }}
        />
        <ListRow icon="trash-2" title="Destructive row" destructive onPress={() => {}} last />
      </ListGroup>

      <SectionHeader title="Cards & feedback" />
      <View style={{ gap: space.md }}>
        <View style={[styles.grid, { gap: space.md }]}>
          <StatTile label="Avg. cycle" value="29 days" caption="Last 6 cycles" />
          <StatTile label="Variation" value="3 days" caption="Shortest to longest" />
        </View>
        <Card>
          <Text variant="title3">Card</Text>
          <Text variant="callout" tone="muted">
            Surfaces group related content.
          </Text>
        </Card>
        <Notice tone="info" title="Info">
          Neutral information.
        </Notice>
        <Notice tone="care" title="Worth discussing">
          Warm, never alarming, never a diagnosis.
        </Notice>
        <Notice tone="privacy" title="Privacy">
          Explains how data is handled.
        </Notice>
      </View>

      <SectionHeader title="Cycle ring" />
      <View style={{ alignItems: 'center' }}>
        <CycleRing cycleLength={28} periodLength={5} ovulationDay={14} cycleDay={20} accessibilityLabel="Example: day 20 of 28">
          <Text variant="title1">Day 20</Text>
          <Text variant="caption" tone="muted">
            of your cycle
          </Text>
        </CycleRing>
      </View>
      <View style={{ height: space.lg }} />
      <CalendarLegend showFertility />
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  swatchItem: { width: 96 },
  swatch: { height: 48, borderWidth: 1, marginBottom: 4 },
});
