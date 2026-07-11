import { render } from 'preact';
import { ParentPage } from './features/parent/ParentPage';
import { MOCK_PUBLIC_STATS } from './features/parent/mockPublicStats';

// Public, unauthenticated, read-only. The token is the only input; ?preview
// renders mock data for local inspection without a real token.
const params = new URLSearchParams(location.search);
const token = params.get('t') ?? undefined;
const preview = params.has('preview');

render(
  <ParentPage token={token} previewStats={preview ? MOCK_PUBLIC_STATS : undefined} />,
  document.getElementById('app')!,
);
