import { Redirect } from 'expo-router';

import { useData } from '@/lib/data/store';

export default function Entry() {
  const { data } = useData();
  return <Redirect href={data.profile.onboardedAt ? '/(tabs)' : '/onboarding'} />;
}
