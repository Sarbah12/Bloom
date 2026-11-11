import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Segmented } from '@/components/ui/Controls';
import { Notice, SectionHeader, StatTile } from '@/components/ui/Feedback';
import { ListGroup, ListRow } from '@/components/ui/ListRow';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { findChanges, findDeviations } from '@/lib/cycle/changes';
import { toLocalISO } from '@/lib/cycle/dates';
import { symptomLabel } from '@/lib/data/catalog';
import { useCycle, useData } from '@/lib/data/store';
import { formatDate } from '@/lib/format';
import { notify } from '@/lib/platform';
import { buildReport, reportHtml, REPORT_DISCLAIMER, type ReportOptions } from '@/lib/report/report';
import { shareReportPdf } from '@/lib/report/share';
import { useTheme } from '@/theme/theme';

/** A PDF summary of recent cycles to take to a GP, gynaecologist or nurse. */
export default function DoctorReport() {
  const { data } = useData();
  const { analysis, today } = useCycle();
  const { space } = useTheme();
  const [options, setOptions] = useState<ReportOptions>({ cycles: 6, includeName: false, includeNotes: false });
  const [busy, setBusy] = useState(false);

  const model = useMemo(() => {
    const entries = Object.values(data.days);
    const findings = [
      ...analysis.notices.map((n) => ({ title: n.title })),
      ...findDeviations(analysis, entries, today, (d) => formatDate(d)).map((f) => ({ title: f.title, detail: f.detail })),
      ...findChanges(analysis, entries, today, symptomLabel).map((f) => ({ title: f.title, detail: f.detail })),
    ];
    return buildReport(
      {
        name: data.profile.name,
        analysis,
        days: data.days,
        medications: data.medications,
        findings,
        today,
        units: data.preferences.units,
        toLocalDay: (instant) => toLocalISO(new Date(instant)),
        formatDay: (d) => formatDate(d, 'long'),
      },
      options,
    );
  }, [data, analysis, today, options]);

  const create = async () => {
    setBusy(true);
    try {
      const ok = await shareReportPdf(reportHtml(model));
      if (!ok) notify('Sharing isn’t available', 'This device can’t open the share sheet.');
    } catch (e) {
      console.warn('Bloom: report failed', e);
      notify('Couldn’t create the PDF', 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const hasData = model.cycles.length > 0 || model.checkIns > 0;

  return (
    <Screen
      nav="back"
      eyebrow="For your appointment"
      title="Doctor visit report"
      subtitle="A clear summary of your cycles, symptoms and medications, made on this phone."
      testID="report"
      footer={
        <Button
          label="Create PDF"
          icon="file-text"
          size="lg"
          fullWidth
          loading={busy}
          disabled={!hasData}
          onPress={create}
          testID="create-report"
        />
      }
    >
      <Text variant="headline" style={{ marginBottom: space.sm }}>
        Cover the last
      </Text>
      <Segmented<ReportOptions['cycles']>
        label="How many cycles to include"
        options={[
          { value: 3, label: '3 cycles' },
          { value: 6, label: '6 cycles' },
          { value: 12, label: '12 cycles' },
        ]}
        value={options.cycles}
        onChange={(cycles) => setOptions((o) => ({ ...o, cycles }))}
      />

      <View style={{ marginTop: space.xl }}>
        <ListGroup flush>
          <ListRow
            icon="user"
            title="Include my name"
            subtitle={data.profile.name ? `Shows “${data.profile.name}” at the top` : 'Add your name in Profile first'}
            toggle={{
              value: options.includeName,
              disabled: !data.profile.name,
              onChange: (includeName) => setOptions((o) => ({ ...o, includeName })),
            }}
          />
          <ListRow
            icon="edit-3"
            title="Include check-in notes"
            subtitle="Off by default. Your private journal is never included."
            toggle={{ value: options.includeNotes, onChange: (includeNotes) => setOptions((o) => ({ ...o, includeNotes })) }}
            last
          />
        </ListGroup>
      </View>

      <SectionHeader title="What’s in it" />
      {hasData ? (
        <>
          <View style={{ flexDirection: 'row', gap: space.md }}>
            {model.stats.slice(1, 3).map((s) => (
              <View key={s.label} style={{ flex: 1 }}>
                <StatTile label={s.label} value={s.value} />
              </View>
            ))}
          </View>
          <Card style={{ marginTop: space.md }}>
            <View style={{ gap: space.xs }}>
              <Text variant="callout">• {model.range}</Text>
              <Text variant="callout">
                • {model.cycles.length} {model.cycles.length === 1 ? 'period' : 'periods'} with flow, cramps and pain
              </Text>
              <Text variant="callout">
                • Top symptoms:{' '}
                {model.symptoms
                  .slice(0, 3)
                  .map((s) => s.label)
                  .join(', ') || 'none logged'}
              </Text>
              {model.relief.length ? <Text variant="callout">• What helped: {model.relief.map((r) => r.label).join(', ')}</Text> : null}
              {model.medications.length ? (
                <Text variant="callout">• {model.medications.length} medications and how often you took them</Text>
              ) : null}
              {model.lifestyle.length ? <Text variant="callout">• Sleep and lifestyle averages</Text> : null}
              {model.findings.length ? <Text variant="callout">• {model.findings.length} things worth discussing</Text> : null}
              {model.notes.length ? <Text variant="callout">• {model.notes.length} check-in notes</Text> : null}
            </View>
          </Card>
        </>
      ) : (
        <Text variant="callout" tone="muted">
          Log a period or a few check-ins first — the report is built from them.
        </Text>
      )}

      <View style={{ marginTop: space.xl }}>
        <Notice tone="privacy" title="You choose who sees it">
          The PDF is made on this phone and opens your share sheet. Bloom doesn’t upload or keep a copy.
        </Notice>
      </View>
      <Text variant="footnote" tone="muted" style={{ marginTop: space.lg }}>
        {REPORT_DISCLAIMER}
      </Text>
    </Screen>
  );
}
