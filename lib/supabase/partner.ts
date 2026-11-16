/**
 * Partner mode against the backend. Every call goes through the partner_*
 * database functions; the partner never reads the sharer's tables.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import type { ISODate } from '@/lib/cycle/dates';
import type { CycleAnalysis } from '@/lib/cycle/engine';
import { buildPartnerSummary, type PartnerView, type SharingChoices } from '@/lib/partner/summary';

import { useSession } from './auth';
import { supabase } from './client';

export interface PartnerLink {
  id: string;
  owner_id: string;
  partner_id: string | null;
  owner_label: string;
  partner_label: string;
  code_expires_at: string | null;
  share_period: boolean;
  share_phase: boolean;
  share_today: boolean;
  share_fertile: boolean;
  accepted_at: string | null;
}

function db() {
  if (!supabase) throw new Error('Cloud backup is not configured in this build.');
  return supabase;
}

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await db().rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export const createInvite = (label: string) => rpc<string>('create_partner_invite', { label });
export const acceptInvite = (code: string, label: string) => rpc<string | null>('accept_partner_invite', { code, label });
export const updateSharing = (s: SharingChoices) =>
  rpc<void>('update_partner_sharing', { period: s.period, phase: s.phase, today: s.today, fertile: s.fertile });
export const endLink = (linkId: string) => rpc<void>('end_partner_link', { link_id: linkId });
export const getPartnerViews = () => rpc<PartnerView[]>('get_partner_view');

export async function getMyLinks(): Promise<PartnerLink[]> {
  const { data, error } = await db()
    .from('partner_links')
    .select(
      'id,owner_id,partner_id,owner_label,partner_label,code_expires_at,share_period,share_phase,share_today,share_fertile,accepted_at',
    )
    .is('revoked_at', null);
  if (error) throw new Error(error.message);
  return (data ?? []) as PartnerLink[];
}

export const sharingOf = (l: PartnerLink): SharingChoices => ({
  period: l.share_period,
  phase: l.share_phase,
  today: l.share_today,
  fertile: l.share_fertile,
});

/** The signed-in person's links, refreshed when the app comes back to the front. */
export function usePartnerLinks() {
  const { session } = useSession();
  const me = session?.user.id ?? null;
  const [links, setLinks] = useState<PartnerLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  const refresh = useCallback(async () => {
    if (!me || !supabase) return setLinks([]);
    setLoading(true);
    try {
      setLinks(await getMyLinks());
      setError(undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [me]);

  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refresh());
    return () => sub.remove();
  }, [refresh]);

  const sharing = useMemo(() => links.find((l) => l.owner_id === me) ?? null, [links, me]);
  const seeing = useMemo(() => links.filter((l) => l.partner_id === me && l.accepted_at), [links, me]);
  return { me, links, sharing, seeing, loading, error, refresh };
}

/**
 * While this person shares with an accepted partner, keeps their summary up
 * to date: published when it changes, never more than the chosen parts.
 */
export function usePartnerPublish(
  analysis: CycleAnalysis,
  todayLog: { moods: string[]; symptoms: string[] } | undefined,
  today: ISODate,
  showFertility: boolean,
) {
  const { sharing, me } = usePartnerLinks();
  const active = sharing?.accepted_at ? sharing : null;
  const summary = active ? JSON.stringify(buildPartnerSummary(analysis, todayLog, today, sharingOf(active), showFertility)) : null;
  const last = useRef<string | null>(null);

  useEffect(() => {
    if (!summary || !me || summary === last.current || !supabase) return;
    last.current = summary;
    supabase
      .from('partner_snapshots')
      .upsert({ owner_id: me, data: JSON.parse(summary), updated_at: new Date().toISOString() }, { onConflict: 'owner_id' })
      .then(({ error }) => {
        if (error) {
          last.current = null;
          console.warn('Bloom: partner summary not updated', error.message);
        }
      });
  }, [summary, me]);
}
