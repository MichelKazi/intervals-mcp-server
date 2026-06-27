import { cn } from '../../lib/cn';
import { Eyebrow } from '../Eyebrow';
import type { MoreGridTemplateProps } from './MoreGridTemplate.types';

/**
 * @component MoreGridTemplate
 * @description "More" screen layout: optional PMC preview then groups of tool cards in 2-col grids.
 * @spec
 * - Root: aura-mesh-bg min-h-screen, content max-w-md mx-auto, p-4, pb-20.
 * - pmcPreview at top if provided.
 * - Each group: an Eyebrow header + its tools wrapped in `grid grid-cols-2 gap-3`.
 * @accessibility
 * - Each group is a <section> labelled by its header.
 */

export function MoreGridTemplate({ pmcPreview, groups = [], className }: MoreGridTemplateProps) {
  return (
    <div className={cn('aura-mesh-bg min-h-screen', className)}>
      <div className="mx-auto flex max-w-md flex-col gap-6 p-4 pb-20">
        {pmcPreview}
        {groups.map((group) => (
          <section key={group.title} className="flex flex-col gap-3">
            <Eyebrow>{group.title}</Eyebrow>
            <div className="grid grid-cols-2 gap-3">{group.tools}</div>
          </section>
        ))}
      </div>
    </div>
  );
}
