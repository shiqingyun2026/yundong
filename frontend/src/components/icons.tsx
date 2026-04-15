import type { CSSProperties, ComponentPropsWithoutRef, ForwardRefExoticComponent } from 'react'
import {
  IconBolt,
  IconCalendar,
  IconCart,
  IconChevronLeft,
  IconChevronRight,
  IconCustomerSupport,
  IconHome,
  IconHistory,
  IconInfoCircle,
  IconLikeHeart,
  IconMapPin,
  IconPlus,
  IconSafe,
  IconSearch,
  IconShare,
  IconStar,
  IconTickCircle,
  IconUser,
  IconUserCircle,
  IconUserGroup,
  IconVerify
} from '@douyinfe/semi-icons'
import { cn } from '@/src/lib/utils'

type SemiIconComponent = ForwardRefExoticComponent<any>
type AppIconProps = Omit<ComponentPropsWithoutRef<'span'>, 'color'> & {
  size?: number | string
}

const iconShellClassName =
  'inline-flex shrink-0 align-middle leading-none [&>span]:inline-flex [&>span]:h-full [&>span]:w-full [&_svg]:h-full [&_svg]:w-full'

const sizeToCss = (size: number | string | undefined, style: CSSProperties | undefined) => {
  if (size == null) {
    return style
  }

  const resolvedSize = typeof size === 'number' ? `${size}px` : size
  return {
    ...style,
    width: resolvedSize,
    height: resolvedSize
  }
}

const adaptIcon = (Icon: SemiIconComponent) => {
  function AdaptedIcon({ size, className, style, ...props }: AppIconProps) {
    return (
      <span {...props} className={cn(iconShellClassName, className)} style={sizeToCss(size, style)}>
        <Icon aria-hidden size="inherit" />
      </span>
    )
  }

  return AdaptedIcon
}

export const Home = adaptIcon(IconHome)
export const User = adaptIcon(IconUserCircle)
export const MapPin = adaptIcon(IconMapPin)
export const Calendar = adaptIcon(IconCalendar)
export const Flame = adaptIcon(IconBolt)
export const Star = adaptIcon(IconStar)
export const CheckCircle2 = adaptIcon(IconTickCircle)
export const ChevronLeft = adaptIcon(IconChevronLeft)
export const Share2 = adaptIcon(IconShare)
export const Heart = adaptIcon(IconLikeHeart)
export const ChevronRight = adaptIcon(IconChevronRight)
export const ShieldCheck = adaptIcon(IconSafe)
export const Verified = adaptIcon(IconVerify)
export const Headset = adaptIcon(IconCustomerSupport)
export const Users = adaptIcon(IconUserGroup)
export const History = adaptIcon(IconHistory)
export const ShoppingCart = adaptIcon(IconCart)
export const Group = adaptIcon(IconUserGroup)
export const Plus = adaptIcon(IconPlus)
export const Info = adaptIcon(IconInfoCircle)
export const Baby = adaptIcon(IconUser)
export const Search = adaptIcon(IconSearch)
