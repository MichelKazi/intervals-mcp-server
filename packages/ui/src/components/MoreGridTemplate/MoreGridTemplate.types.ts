import type { ReactNode } from 'react';

export interface MoreGridGroup {
  /** Group header text (rendered as an Eyebrow). */
  title: string;
  /** Tool cards; wrapped in a 2-col grid by the template. */
  tools: ReactNode;
}

export interface MoreGridTemplateProps {
  /** PMC card slot at the top. */
  pmcPreview?: ReactNode;
  /** Tool groups, each a header + 2-col grid of tools. */
  groups?: MoreGridGroup[];
  className?: string;
}
