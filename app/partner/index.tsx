import { router } from 'expo-router';
import { useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { TextField } from '@/components/ui/Controls';
import { EmptyState, Notice, SectionHeader } from '@/components/ui/Feedback';
import { ListGroup, ListRow } from '@/components/ui/ListRow';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { useData } from '@/lib/data/store';
import { confirm, notify } from '@/lib/platform';
import type { SharingChoices } from '@/lib/partner/summary';
import { useSession } from '@/lib/supabase/auth';
import { cloudConfigured } from '@/lib/supabase/client';
import { acceptInvite, createInvite, endLink, sharingOf, updateSharing, usePartnerLinks } from '@/lib/supabase/partner';
import { useTheme } from '@/theme/theme';

const CHOICES: { key: keyof SharingChoices; icon: 'droplet' | 'sun' | 'smile' | 'circle'; title: string; subtitle: string }[] = [
  { key: 'period', icon: 'droplet', title: 'Period', subtitle: 'Whether you’re on your period, and when the next one is expected' },
  { key: 'phase', icon: 'sun', title: 'Phase and support tips', subtitle: 'Your current phase, with ideas for how they can help' },
  { key: 'today', icon: 'smile', title: 'Mood and symptoms today', subtitle: 'What you logged today — never notes or your journal' },
  { key: 'fertile', icon: 'circle', title: 'Fertile window (estimate)', subtitle: 'Not a method of contraception' },
];

/** Partner mode: share a chosen summary with one partner, or see someone who shares with you. */
export default function Partner() {
  const { session, loading: sessionLoading } = useSession();
  const { data } = useData();
  const { colors, space } = useTheme();
  const { sharing, seeing, loading, error, refresh } = usePartnerLinks();
  const [code, setCode] = useState<string | null>(null);
  const [entered, setEntered] = useState('');
  const [busy, setBusy] = useState(false);
  const name = data.profile.name?.trim() || '';

  if (!cloudConfigured) {
    return (
      <Screen nav="back" title="Partner">
        <Notice tone="info">Partner mode needs cloud backup, which isn’t available in this build.</Notice>
      </Screen>
    );
  }

  if (!sessionLoading && !session) {
    return (
      <Screen nav="back" title="Partner" testID="partner">
        <EmptyState
          icon="users"
          title="Share with your partner"
          body="Let someone you trust see when your period is coming and how to support you. You both need a Bloom account so the link stays private."
          action={
            <Button
              label="Sign in or create an account"
              onPress={() => router.push({ pathname: '/account', params: { for: 'partner' } })}
            />
          }
        />
      </Screen>
    );
  }

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
      await refresh();
    } catch (e) {
      notify('Something went wrong', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const invite = () =>
    run(async () => {
      const c = await createInvite(name);
      setCode(c);
    });

  const shareCode = (c: string) =>
    Share.share({
      message: `I’d like to share my cycle with you on Bloom. Install Bloom, sign in, then go to Profile → Partner and enter this code: ${c}\n(It works once, for 24 hours.)`,
    });

  const accept = () =>
    run(async () => {
      const label = await acceptInvite(entered, name);
      if (label === null) {
        notify('That code didn’t work', 'Check it, or ask for a new one — codes work once, for 24 hours.');
        return;
      }
      setEntered('');
      notify('Connected', label ? `You can now see what ${label} shares with you.` : 'You can now see what your partner shares with you.');
    });

  const toggle = (key: keyof SharingChoices, value: boolean) => {
    if (!sharing) return;
    return run(() => updateSharing({ ...sharingOf(sharing), [key]: value }));
  };

  const stop = async (linkId: string, who: string, mine: boolean) => {
    const ok = await confirm(
      mine ? 'Stop sharing?' : 'Stop seeing their cycle?',
      mine
        ? `${who || 'Your partner'} will no longer see anything, and the summary on the server is deleted.`
        : `You’ll no longer see what ${who || 'they'} share. They can invite you again.`,
      'Stop',
      true,
    );
    if (ok) run(() => endLink(linkId).then(() => setCode(null)));
  };

  const active = sharing?.accepted_at ? sharing : null;
  const pending = sharing && !sharing.accepted_at ? sharing : null;

  return (
    <Screen
      nav="back"
      eyebrow="Partner mode"
      title="Share with your partner"
      subtitle="You choose exactly what they see, and you can stop at any time."
      testID="partner"
    >
      {error ? (
        <Notice tone="care" title="Couldn’t load partner mode">
          {error}
        </Notice>
      ) : null}

      {active ? (
        <>
          <Card testID="partner-active">
            <Text variant="eyebrow" tone="muted">
              Sharing with
            </Text>
            <Text variant="title2" style={{ marginTop: 2 }}>
              {active.partner_label || 'Your partner'}
            </Text>
            <Text variant="footnote" tone="muted" style={{ marginTop: space.xs }}>
              They see a summary your phone updates — never your notes, journal, medications or other check-in details.
            </Text>
          </Card>
          <SectionHeader title="What they can see" />
          <ListGroup flush>
            {CHOICES.map((c, i) => (
              <ListRow
                key={c.key}
                icon={c.icon}
                title={c.title}
                subtitle={c.subtitle}
                toggle={{ value: sharingOf(active)[c.key], disabled: busy, onChange: (v) => toggle(c.key, v) }}
                last={i === CHOICES.length - 1}
                testID={`share-${c.key}`}
              />
            ))}
          </ListGroup>
          {sharingOf(active).fertile && !data.preferences.showFertility ? (
            <View style={{ marginTop: space.md }}>
              <Notice tone="info">Fertility estimates are off in Profile, so the fertile window isn’t shared.</Notice>
            </View>
          ) : null}
          <View style={{ marginTop: space.xl, alignItems: 'flex-start' }}>
            <Button label="Stop sharing" icon="x" variant="danger" onPress={() => stop(active.id, active.partner_label, true)} />
          </View>
        </>
      ) : code || pending ? (
        <Card testID="partner-code">
          <Text variant="headline">Your invite code</Text>
          {code ? (
            <>
              <Text
                variant="hero"
                align="center"
                style={{ marginVertical: space.lg, letterSpacing: 2 }}
                selectable
                accessibilityLabel={`Invite code ${code.split('').join(' ')}`}
              >
                {code}
              </Text>
              <Text variant="footnote" tone="muted" align="center">
                Works once, for 24 hours. Your partner enters it in Bloom under Profile → Partner.
              </Text>
              <View style={{ marginTop: space.lg, gap: space.sm }}>
                <Button label="Send the code" icon="share" fullWidth onPress={() => shareCode(code)} />
                <Button label="Cancel invite" variant="ghost" fullWidth onPress={() => pending && stop(pending.id, '', true)} />
              </View>
            </>
          ) : (
            <>
              <Text variant="callout" tone="muted" style={{ marginTop: space.xs }}>
                An invite is waiting. For your privacy the code is only shown once — make a new one to send it again.
              </Text>
              <View style={{ marginTop: space.lg, gap: space.sm }}>
                <Button label="Make a new code" fullWidth loading={busy} onPress={invite} />
                <Button label="Cancel invite" variant="ghost" fullWidth onPress={() => pending && stop(pending.id, '', true)} />
              </View>
            </>
          )}
        </Card>
      ) : (
        <Card testID="partner-invite">
          <Text variant="title3">Invite your partner</Text>
          <View style={{ gap: space.xs, marginTop: space.sm }}>
            {[
              'They see when your period is coming and how to support you.',
              'You choose what they see, and can stop any time.',
              'Your notes, journal and medications are never shared.',
            ].map((t) => (
              <View key={t} style={styles.bullet}>
                <Text variant="callout" color={colors.primary}>
                  •
                </Text>
                <Text variant="callout" tone="muted" style={{ flex: 1 }}>
                  {t}
                </Text>
              </View>
            ))}
          </View>
          {!name ? (
            <Text variant="footnote" tone="muted" style={{ marginTop: space.md }}>
              Tip: add your first name in Profile so your partner sees who’s sharing.
            </Text>
          ) : null}
          <View style={{ marginTop: space.lg }}>
            <Button label="Create an invite code" fullWidth loading={busy || loading} onPress={invite} testID="create-invite" />
          </View>
        </Card>
      )}

      <SectionHeader title="Someone sharing with you?" />
      {seeing.length ? (
        <ListGroup flush>
          {seeing.map((l, i) => (
            <ListRow
              key={l.id}
              icon="heart"
              title={l.owner_label || 'Your partner'}
              subtitle="See their cycle and how to support them"
              onPress={() => router.push('/partner/view')}
              last={i === seeing.length - 1}
            />
          ))}
        </ListGroup>
      ) : null}
      <Card style={{ marginTop: seeing.length ? space.md : 0 }}>
        <TextField
          label="Enter their code"
          value={entered}
          onChangeText={(t) => setEntered(t.toUpperCase())}
          placeholder="e.g. K7QM-2XPA"
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={9}
          testID="partner-code-input"
        />
        <View style={{ marginTop: space.md }}>
          <Button
            label="Connect"
            variant="secondary"
            fullWidth
            disabled={entered.replace(/[^A-Z0-9]/g, '').length !== 8 || busy}
            onPress={accept}
          />
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  bullet: { flexDirection: 'row', gap: 8 },
});
