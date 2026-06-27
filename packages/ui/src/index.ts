// Barrel export for @coaching/ui — the Aura design system.

// Tokens
export { default as tokens } from './tokens/generated/tokens';
export type { Tokens } from './tokens/generated/tokens';

// Lib
export { cn } from './lib/cn';
export { ZONE_COLORS, ZONE_LABELS, STATUS_COLORS } from './lib/zones';
export type { Zone } from './lib/zones';

// Theme
export { AuraProvider } from './AuraProvider';
export type { AuraTheme, AuraProviderProps } from './AuraProvider';

// Atoms
export { ZoneDot } from './components/ZoneDot';
export { ZoneBadge } from './components/ZoneBadge';
export { AdaptiveBadge } from './components/AdaptiveBadge';
export { SparkLine } from './components/SparkLine';
export { Eyebrow } from './components/Eyebrow';
export { MetricValue } from './components/MetricValue';
export { StatusPill } from './components/StatusPill';
export { ConfoundPill } from './components/ConfoundPill';

// Molecules
export { ContributorRow } from './components/ContributorRow';
export { MetricRing } from './components/MetricRing';
export { PowerChart } from './components/PowerChart';
export { ComplianceDot } from './components/ComplianceDot';
export { WorkoutCard } from './components/WorkoutCard';
export { ActivityRow } from './components/ActivityRow';
export { PMCChart } from './components/PMCChart';

// Inputs
export { MotivationSlider } from './components/MotivationSlider';
export { MoodPicker, MOOD_OPTIONS } from './components/MoodPicker';
export { FreeTimeGrid } from './components/FreeTimeGrid';
export { NotesField } from './components/NotesField';
export { CoachReadCard } from './components/CoachReadCard';

// Organisms
export { ReadinessCard } from './components/ReadinessCard';
export { ContextStrip } from './components/ContextStrip';
export { CalendarWeekStrip } from './components/CalendarWeekStrip';
export { LibraryItem } from './components/LibraryItem';

// Templates
export { HomeTemplate } from './components/HomeTemplate';
export { CalendarTemplate } from './components/CalendarTemplate';
export { LibraryTemplate } from './components/LibraryTemplate';
export { MoreGridTemplate } from './components/MoreGridTemplate';

// Types
export type { ZoneDotProps } from './components/ZoneDot/ZoneDot.types';
export type { ZoneBadgeProps } from './components/ZoneBadge/ZoneBadge.types';
export type { AdaptiveBadgeProps } from './components/AdaptiveBadge/AdaptiveBadge.types';
export type { SparkLineProps } from './components/SparkLine/SparkLine.types';
export type { EyebrowProps } from './components/Eyebrow/Eyebrow.types';
export type { MetricValueProps } from './components/MetricValue/MetricValue.types';
export type { StatusPillProps } from './components/StatusPill/StatusPill.types';
export type { ConfoundPillProps } from './components/ConfoundPill/ConfoundPill.types';
export type { ContributorRowProps } from './components/ContributorRow/ContributorRow.types';
export type { MetricRingProps } from './components/MetricRing/MetricRing.types';
export type { PowerChartProps, PowerInterval } from './components/PowerChart/PowerChart.types';
export type { ComplianceDotProps } from './components/ComplianceDot/ComplianceDot.types';
export type { WorkoutCardProps } from './components/WorkoutCard/WorkoutCard.types';
export type { ActivityRowProps } from './components/ActivityRow/ActivityRow.types';
export type { PMCChartProps, PMCDataPoint } from './components/PMCChart/PMCChart.types';
export type { ReadinessCardProps } from './components/ReadinessCard/ReadinessCard.types';
export type { ContextStripProps } from './components/ContextStrip/ContextStrip.types';
export type {
  CalendarWeekStripProps,
  CalendarDay,
} from './components/CalendarWeekStrip/CalendarWeekStrip.types';
export type { LibraryItemProps } from './components/LibraryItem/LibraryItem.types';
export type { HomeTemplateProps } from './components/HomeTemplate/HomeTemplate.types';
export type { CalendarTemplateProps } from './components/CalendarTemplate/CalendarTemplate.types';
export type { LibraryTemplateProps } from './components/LibraryTemplate/LibraryTemplate.types';
export type { MoreGridTemplateProps } from './components/MoreGridTemplate/MoreGridTemplate.types';
export type { MotivationSliderProps } from './components/MotivationSlider/MotivationSlider.types';
export type { MoodPickerProps, MoodKey } from './components/MoodPicker/MoodPicker.types';
export type {
  FreeTimeGridProps,
  FreeTimeMap,
  Weekday,
} from './components/FreeTimeGrid/FreeTimeGrid.types';
export type { NotesFieldProps } from './components/NotesField/NotesField.types';
export type { CoachReadCardProps } from './components/CoachReadCard/CoachReadCard.types';
