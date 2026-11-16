import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Feedback';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { buildPrompt, findArticles, libraryAnswer, urgentAdvice, type ChatTurn } from '@/lib/assistant/local';
import { buildCycleSummary } from '@/lib/assistant/summary';
import { useCycle, useData } from '@/lib/data/store';
import { useTheme } from '@/theme/theme';
import { generateOnDevice, onDeviceAvailability, type OnDeviceAvailability } from '@/modules/bloom-on-device-ai';

const NAV_TITLE = 'Bloom Assistant';

const STARTERS = [
  'Is my cycle length normal?',
  'Why are my cramps worse some months?',
  'What helps with PMS mood swings?',
  'What should I ask my doctor about heavy periods?',
];

interface Turn extends ChatTurn {
  /** Bloom articles the reply drew on, shown as "Read more" links. */
  articles?: { slug: string; title: string }[];
}

/** Why the on-device model can't be used, in the person's terms. */
const FALLBACK_REASON: Record<Exclude<OnDeviceAvailability, 'available'>, string> = {
  appleIntelligenceNotEnabled: 'Turn on Apple Intelligence in Settings for full answers. Until then, replies come from Bloom’s articles.',
  modelNotReady: 'Apple Intelligence is still getting ready on this iPhone. Until it’s done, replies come from Bloom’s articles.',
  deviceNotEligible: 'This phone doesn’t support Apple Intelligence, so replies come from Bloom’s articles.',
  unavailable: 'Apple Intelligence isn’t available right now, so replies come from Bloom’s articles.',
  unsupportedOS: 'Full answers need Apple Intelligence (iOS 26 or later). On this phone, replies come from Bloom’s articles.',
};

const ERRORS: Record<string, string> = {
  ERR_DECLINED:
    'Bloom Assistant can’t answer that one. If it’s about your health and feels urgent, please contact a doctor or your local emergency number.',
  ERR_LANGUAGE: 'Bloom Assistant can’t answer in this language yet. Try asking in English.',
  ERR_BUSY: 'Bloom Assistant is busy. Please try again in a moment.',
  ERR_NOT_READY: 'Apple Intelligence is still getting ready on this iPhone. Please try again later.',
  ERR_TOO_LONG: 'That was too long to answer. Try a shorter question, or start a new chat.',
};

/**
 * Bloom Assistant: a chat about periods, cycles and symptoms that runs
 * entirely on the phone. With Apple Intelligence it uses Apple's on-device
 * model, grounded in Bloom's articles; without it, it answers from those
 * articles directly. Nothing is sent anywhere and the chat isn't saved.
 */
export default function Assistant() {
  const { data } = useData();
  if (!data.consents.aiAssistant) return <Intro />;
  return <Chat />;
}

function Intro() {
  const { actions } = useData();
  const { space, colors } = useTheme();
  const [busy, setBusy] = useState(false);

  const start = () => {
    setBusy(true);
    actions.updateConsents({ aiAssistant: true });
  };

  const points: { icon: React.ComponentProps<typeof Feather>['name']; title: string; body: string }[] = [
    {
      icon: 'info',
      title: 'Information, not a diagnosis',
      body: 'Bloom Assistant is an AI, not a doctor. For urgent symptoms, contact a doctor or your local emergency number.',
    },
    {
      icon: 'smartphone',
      title: 'Runs on your phone',
      body: 'Bloom Assistant uses Apple’s on-device AI, so your questions never leave this iPhone. Nothing is sent to Bloom, Apple or anyone else.',
    },
    {
      icon: 'lock',
      title: 'Your log, your call',
      body: 'It only uses your cycle numbers if you switch on “Use my cycle summary”, and you can read exactly what it sees.',
    },
    { icon: 'trash-2', title: 'Chats aren’t saved', body: 'Closing Bloom Assistant clears the conversation.' },
  ];

  return (
    <Screen
      nav="close"
      navTitle={NAV_TITLE}
      title="Ask about your cycle"
      subtitle="Private answers about periods, symptoms and what to ask your doctor."
      footer={<Button label="Start chatting" size="lg" fullWidth loading={busy} onPress={start} testID="assistant-start" />}
    >
      <View style={{ gap: space.xl }}>
        {points.map((p) => (
          <View key={p.title} style={{ flexDirection: 'row', gap: space.lg }}>
            <Feather name={p.icon} size={20} color={colors.primary} style={{ marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text variant="headline">{p.title}</Text>
              <Text variant="callout" tone="muted" style={{ marginTop: 2 }}>
                {p.body}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </Screen>
  );
}

function Chat() {
  const { data } = useData();
  const { analysis, today } = useCycle();
  const { colors, radii, space, type } = useTheme();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [share, setShare] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const input = useRef<TextInput>(null);
  const abort = useRef<AbortController | null>(null);

  const availability = useMemo(onDeviceAvailability, []);
  const onDevice = availability === 'available';
  const summary = buildCycleSummary(data, analysis, today);

  useEffect(() => () => abort.current?.abort(), []);

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || busy) return;
    const history: Turn[] = [...turns, { role: 'user', content: question }];
    setDraft('');
    // iOS can keep a pending autocorrect suggestion in a multiline field after
    // its value is reset; clearing the native field as well empties it reliably.
    input.current?.clear();
    setError(null);

    if (!onDevice) {
      const answer = libraryAnswer(question);
      setTurns([...history, { role: 'assistant', content: answer.text, articles: answer.articles }]);
      return;
    }

    // Red-flag guidance is fixed text, shown first whatever the model says.
    const urgent = urgentAdvice(question);
    const lead = urgent ? `${urgent}\n\n` : '';
    const articles = findArticles(question, 1).map((a) => ({ slug: a.slug, title: a.title }));
    const show = (reply: string) => setTurns((all) => [...all.slice(0, -1), { role: 'assistant', content: lead + reply, articles }]);

    setTurns([...history, { role: 'assistant', content: lead, articles }]);
    setBusy(true);
    const controller = new AbortController();
    abort.current = controller;
    try {
      const { instructions, prompt } = buildPrompt(history, share ? summary : null);
      const reply = await generateOnDevice({ instructions, prompt, onText: show, signal: controller.signal });
      show(reply.trim());
    } catch (e) {
      if (controller.signal.aborted) return;
      const code = (e as { code?: string })?.code ?? '';
      if (urgent) {
        show('');
      } else {
        // Drop the unanswered question so it can be sent again.
        setTurns(history.slice(0, -1));
        setDraft(question);
      }
      setError(ERRORS[code] ?? 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const newChat = () => {
    abort.current?.abort();
    setTurns([]);
    setError(null);
    setBusy(false);
  };

  return (
    <Screen
      nav="close"
      navTitle={NAV_TITLE}
      scroll={false}
      navRight={
        turns.length ? (
          <Pressable accessibilityRole="button" accessibilityLabel="New chat" onPress={newChat} hitSlop={8}>
            <Feather name="edit" size={20} color={colors.ink} />
          </Pressable>
        ) : null
      }
      footer={
        <View>
          <View style={[styles.shareRow, { marginBottom: space.sm }]}>
            <Pressable onPress={() => setShowSummary((v) => !v)} accessibilityRole="button" style={{ flex: 1 }} hitSlop={6}>
              <Text variant="bodyStrong">Use my cycle summary</Text>
              <Text variant="footnote" tone="muted">
                {showSummary ? 'Hide what it sees' : 'See what it sees (stays on this phone)'}
              </Text>
            </Pressable>
            <Switch
              value={share}
              onValueChange={setShare}
              accessibilityLabel="Use my cycle summary"
              trackColor={{ true: colors.primary, false: colors.borderStrong }}
            />
          </View>
          {showSummary ? (
            <View
              style={[
                styles.summaryBox,
                { backgroundColor: colors.surfaceMuted, borderRadius: radii.sm, padding: space.md, marginBottom: space.md },
              ]}
            >
              <Text variant="footnote" tone="muted">
                {summary}
              </Text>
            </View>
          ) : null}
          <View style={[styles.inputRow, { borderRadius: radii.lg, borderColor: colors.borderStrong, backgroundColor: colors.surface }]}>
            <TextInput
              ref={input}
              value={draft}
              onChangeText={setDraft}
              placeholder="Ask about your cycle or symptoms"
              placeholderTextColor={colors.inkSubtle}
              multiline
              maxLength={4000}
              accessibilityLabel="Message"
              style={[styles.input, { color: colors.ink, fontFamily: type.body.fontFamily, fontSize: type.body.fontSize }]}
              testID="assistant-input"
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Send"
              accessibilityState={{ disabled: busy || !draft.trim() }}
              disabled={busy || !draft.trim()}
              onPress={() => send(draft)}
              style={[styles.send, { backgroundColor: colors.primary, opacity: busy || !draft.trim() ? 0.4 : 1 }]}
              testID="assistant-send"
            >
              {busy ? <ActivityIndicator color={colors.onPrimary} /> : <Feather name="arrow-up" size={20} color={colors.onPrimary} />}
            </Pressable>
          </View>
        </View>
      }
    >
      <ScrollView
        ref={scroll}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: space.lg, gap: space.md }}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
      >
        <Notice tone="care">
          Bloom Assistant is an AI, not a doctor. For urgent symptoms, contact a doctor or your local emergency number.
        </Notice>
        {availability !== 'available' ? <Notice tone="info">{FALLBACK_REASON[availability]}</Notice> : null}

        {turns.length === 0 ? (
          <View style={{ marginTop: space.md }}>
            <Text variant="title2" heading style={{ marginBottom: space.md }}>
              What would you like to know?
            </Text>
            <View style={{ gap: space.sm, alignItems: 'flex-start' }}>
              {STARTERS.map((s) => (
                <Button key={s} label={s} variant="soft" onPress={() => send(s)} />
              ))}
            </View>
          </View>
        ) : null}

        {turns.map((t, i) => {
          const mine = t.role === 'user';
          return (
            <View
              key={i}
              style={[
                styles.bubble,
                {
                  alignSelf: mine ? 'flex-end' : 'flex-start',
                  backgroundColor: mine ? colors.primarySoft : colors.surface,
                  borderColor: mine ? colors.primarySoft : colors.border,
                  borderRadius: radii.md,
                  padding: space.md,
                },
              ]}
              accessibilityLabel={`${mine ? 'You' : 'Bloom Assistant'}: ${t.content}`}
            >
              {t.content ? (
                <Text variant="body" color={mine ? colors.onPrimarySoft : undefined} selectable>
                  {t.content}
                </Text>
              ) : (
                <ActivityIndicator color={colors.primary} />
              )}
              {!mine && t.articles?.length && !(busy && i === turns.length - 1) ? (
                <View style={{ marginTop: space.sm, gap: space.xs, alignItems: 'flex-start' }}>
                  {t.articles.map((a) => (
                    <Button key={a.slug} label={`Read: ${a.title}`} variant="ghost" onPress={() => router.push(`/learn/${a.slug}`)} />
                  ))}
                </View>
              ) : null}
            </View>
          );
        })}

        {error ? <Notice tone="care">{error}</Notice> : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  shareRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  summaryBox: { maxHeight: 180 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', borderWidth: 1, paddingLeft: 16, paddingRight: 6, paddingVertical: 6 },
  input: { flex: 1, maxHeight: 120, paddingTop: 10, paddingBottom: 10 },
  send: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  bubble: { maxWidth: '88%', borderWidth: 1 },
});
