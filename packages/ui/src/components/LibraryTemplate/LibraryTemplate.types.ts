import type { ReactNode } from 'react';
import type { Zone } from '../../lib/zones';

export interface LibraryTemplateProps {
  /** Search input slot. */
  search?: ReactNode;
  /** Which zone filter chips to render. Default [1,2,3,4,5]. */
  filterZones?: Zone[];
  /** Currently active zone filters. */
  activeZones?: Zone[];
  /** Fires with the toggled zone on chip click. */
  onToggleZone?: (zone: Zone) => void;
  /** LibraryItem list slot. */
  items?: ReactNode;
  className?: string;
}
