import type { CSSProperties, ComponentPropsWithoutRef, ForwardRefExoticComponent } from 'react'
import {
  IconActivity,
  IconAlertCircle,
  IconAlertTriangle,
  IconAppCenter,
  IconArrowLeft,
  IconBold,
  IconBook,
  IconCalendar,
  IconCheckList,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconClose,
  IconDelete,
  IconDownCircle,
  IconDownload,
  IconEdit,
  IconExit,
  IconEyeClosed,
  IconEyeOpened,
  IconImage,
  IconInfoCircle,
  IconItalic,
  IconList,
  IconLock,
  IconMapPin,
  IconMore,
  IconPlus,
  IconRefresh,
  IconSafe,
  IconSearch,
  IconTickCircle,
  IconUpload,
  IconUser,
  IconUserGroup
} from '@douyinfe/semi-icons'
import { cn } from '../lib/utils'

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

export const Activity = adaptIcon(IconActivity)
export const LayoutDashboard = adaptIcon(IconAppCenter)
export const BookOpen = adaptIcon(IconBook)
export const ClipboardList = adaptIcon(IconCheckList)
export const Users = adaptIcon(IconUserGroup)
export const LogOut = adaptIcon(IconExit)
export const ChevronDown = adaptIcon(IconChevronDown)
export const Search = adaptIcon(IconSearch)
export const Plus = adaptIcon(IconPlus)
export const Calendar = adaptIcon(IconCalendar)
export const MapPin = adaptIcon(IconMapPin)
export const Edit3 = adaptIcon(IconEdit)
export const ArrowDownCircle = adaptIcon(IconDownCircle)
export const ChevronLeft = adaptIcon(IconChevronLeft)
export const ChevronRight = adaptIcon(IconChevronRight)
export const MoreHorizontal = adaptIcon(IconMore)
export const Download = adaptIcon(IconDownload)
export const Eye = adaptIcon(IconEyeOpened)
export const RotateCcw = adaptIcon(IconRefresh)
export const X = adaptIcon(IconClose)
export const CheckCircle2 = adaptIcon(IconTickCircle)
export const AlertCircle = adaptIcon(IconAlertCircle)
export const Info = adaptIcon(IconInfoCircle)
export const ArrowLeft = adaptIcon(IconArrowLeft)
export const Upload = adaptIcon(IconUpload)
export const User = adaptIcon(IconUser)
export const Lock = adaptIcon(IconLock)
export const ImageIcon = adaptIcon(IconImage)
export const Bold = adaptIcon(IconBold)
export const Italic = adaptIcon(IconItalic)
export const List = adaptIcon(IconList)
export const ShieldCheck = adaptIcon(IconSafe)
export const Trash2 = adaptIcon(IconDelete)
export const AlertTriangle = adaptIcon(IconAlertTriangle)
export const EyeOff = adaptIcon(IconEyeClosed)
