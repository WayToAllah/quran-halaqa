/** Filled nav icons ported from the approved design (Halaqa_Mobile).
 * Kept as small inline SVG components (not dangerouslySetInnerHTML) so they
 * type-check and stay lint-clean like the rest of the app. */
import type { JSX } from 'preact';

type IconProps = { class?: string };

export function RecordIcon(props: IconProps): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" width="21" height="21" fill="currentColor" class={props.class}>
      <path d="M14.1 4.3l5.6 5.6L10 19.6H4.4v-5.6zM20.8 3.5l-1.6-1.6a2.3 2.3 0 0 0-3.3 0L14.5 3.3l4.9 4.9 1.4-1.4a2.3 2.3 0 0 0 0-3.3z" />
    </svg>
  );
}

export function StudentsIcon(props: IconProps): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" width="21" height="21" fill="currentColor" class={props.class}>
      <circle cx="9" cy="7.3" r="3.6" />
      <path d="M2.2 19.6c0-4 3-6.7 6.8-6.7s6.8 2.7 6.8 6.7z" />
      <circle cx="18" cy="8.6" r="2.6" opacity="0.55" />
      <path
        d="M15.6 13.2c2.9.4 4.7 2.5 4.9 5.9h-4.4c0-2-.5-3.7-1.6-4.9.4-.4.7-.7 1.1-1z"
        opacity="0.55"
      />
    </svg>
  );
}

export function LogIcon(props: IconProps): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" width="21" height="21" fill="currentColor" class={props.class}>
      <circle cx="11.5" cy="12.5" r="8.5" />
      <path
        d="M11.5 7a1 1 0 0 1 1 1v4.2l3 1.8a1 1 0 1 1-1 1.7l-3.5-2.1a1 1 0 0 1-.5-.9V8a1 1 0 0 1 1-1z"
        fill="#FAF7F0"
      />
    </svg>
  );
}

export function StatsIcon(props: IconProps): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" width="21" height="21" fill="currentColor" class={props.class}>
      <rect x="3.5" y="12" width="4.4" height="7.5" rx="1" />
      <rect x="9.8" y="5" width="4.4" height="14.5" rx="1" />
      <rect x="16.1" y="9" width="4.4" height="10.5" rx="1" />
    </svg>
  );
}
