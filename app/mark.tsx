import { strainMark } from './strain';

export function Mark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 256 256" aria-hidden="true">
      <path d={strainMark} fill="currentColor" fillRule="evenodd" />
    </svg>
  );
}
