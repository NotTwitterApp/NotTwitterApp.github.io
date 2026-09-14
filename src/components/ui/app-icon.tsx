import {
  CustomIcon,
  isCustomIconName,
  type CustomIconName
} from '@components/ui/custom-icon';
import {
  HeroIcon,
  type IconName as HeroIconName
} from '@components/ui/hero-icon';

import type { JSX } from 'react';

export type AppIconName = CustomIconName | HeroIconName;

type AppIconProps = {
  className?: string;
  iconName: AppIconName;
  solid?: boolean;
};

export function AppIcon({
  className,
  iconName,
  solid
}: AppIconProps): JSX.Element {
  return isCustomIconName(iconName) ? (
    <CustomIcon className={className} iconName={iconName} />
  ) : (
    <HeroIcon className={className} iconName={iconName} solid={solid} />
  );
}
