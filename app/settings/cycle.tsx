import { useState } from 'react';
import { View } from 'react-native';

import { Stepper, TextField } from '@/components/ui/Controls';
import { Notice } from '@/components/ui/Feedback';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { useCycle, useData } from '@/lib/data/store';
import { useTheme } from '@/theme/theme';

export default function CycleSettings() {
  const { data, actions } = useData();
  const { analysis } = useCycle();
  const { space } = useTheme();
  const [birthYear, setBirthYear] = useState(data.profile.birthYear ? String(data.profile.birthYear) : '');
  const thisYear = new Date().getFullYear();
  const yearNumber = Number(birthYear);
  const yearError =
    birthYear && (!/^\d{4}$/.test(birthYear) || yearNumber < thisYear - 70 || yearNumber > thisYear - 8)
      ? 'Enter a four-digit year.'
      : undefined;

  return (
    <Screen
      nav="back"
      title="Cycle settings"
      subtitle="Your usual lengths. Once you've logged three cycles, Bloom uses your history instead."
      testID="cycle-settings"
    >
      <Card>
        <Text variant="headline" align="center" style={{ marginBottom: space.md }}>
          Usual cycle length
        </Text>
        <Stepper
          label="Usual cycle length"
          value={data.cycle.typicalCycleLength}
          min={15}
          max={90}
          unit="days"
          onChange={(typicalCycleLength) => actions.updateCycleSettings({ typicalCycleLength })}
        />
      </Card>
      <Card style={{ marginTop: space.md }}>
        <Text variant="headline" align="center" style={{ marginBottom: space.md }}>
          Usual period length
        </Text>
        <Stepper
          label="Usual period length"
          value={data.cycle.typicalPeriodLength}
          min={1}
          max={14}
          unit="days"
          onChange={(typicalPeriodLength) => actions.updateCycleSettings({ typicalPeriodLength })}
        />
      </Card>
      <View style={{ height: space.xxl }} />
      {analysis.stats.basis === 'history' ? (
        <Notice tone="info">
          {`Your logged history currently gives an average cycle of ${analysis.stats.averageCycleLength} days and an average period of ${analysis.stats.averagePeriodLength} days, which is what Bloom uses for estimates.`}
        </Notice>
      ) : null}
      <View style={{ height: space.xxl }} />
      <TextField
        label="Year of birth (optional)"
        value={birthYear}
        onChangeText={setBirthYear}
        onBlur={() => !yearError && actions.updateProfile({ birthYear: birthYear ? yearNumber : undefined })}
        keyboardType="number-pad"
        maxLength={4}
        placeholder="e.g. 1994"
        error={yearError}
        hint="What counts as a regular cycle depends a little on age. Used only for that, and stays on this phone."
      />
    </Screen>
  );
}
