import { cn } from '../../lib/cn';
import type { HomeTemplateProps } from './HomeTemplate.types';

/**
 * @component HomeTemplate
 * @description Home screen layout. Scrolling column of slots; fetches nothing.
 * @spec
 * - Root: aura-mesh-bg min-h-screen, content max-w-md mx-auto, p-4, pb-20, gap-4.
 * - Header: greeting (text-3xl bold display) + subtitle (text-sm secondary).
 * - Slots in order: readiness, contextStrip, workout, activities. Each renders only if provided.
 * @accessibility
 * - Header is a real <header>; activities live in a <section>. No interactive logic owned here.
 */

export function HomeTemplate({
  greeting,
  subtitle,
  readiness,
  contextStrip,
  workout,
  activities,
  className,
}: HomeTemplateProps) {
  return (
    <div className={cn('aura-mesh-bg min-h-screen', className)}>
      <div className="mx-auto flex max-w-md flex-col gap-4 p-4 pb-20">
        {(greeting || subtitle) && (
          <header className="flex flex-col gap-1">
            {greeting && (
              <h1 className="font-display text-3xl font-bold text-text-primary">{greeting}</h1>
            )}
            {subtitle && <p className="text-sm text-text-secondary">{subtitle}</p>}
          </header>
        )}
        {readiness}
        {contextStrip}
        {workout}
        {activities && <section className="flex flex-col gap-4">{activities}</section>}
      </div>
    </div>
  );
}
