import {
  Search,
  ShoppingCart,
  Sun,
  Moon,
  User,
  Menu,
  X,
  Trash2,
  Package,
  Mail,
  Clock3,
  MapPin,
  AtSign,
  ShoppingBag,
  Bell,
  Heart,
  Star,
  Users,
  TrendingUp,
  Gift,
  AlertTriangle,
  CreditCard,
  RotateCcw,
  HelpCircle,
  LayoutDashboard,
  Settings,
  MessageSquare,
  MessageCircle,
  Grid,
  Wallet,
  Truck,
  Clock,
  LogOut,
  ArrowLeft,
  Ticket, 
  Tag,
  Percent,      
  DollarSign,
  Copy,        
  Check,
  Download,
  ExternalLink,
  FileText,
  Calendar,
  ShieldCheck,
  Receipt,
  Send,
  CheckCheck,
  ChevronDown,
  Banknote,
  CheckCircle,
  CornerDownLeft,
  ArrowUpRight,
  Image,
  Loader,
} from "lucide-react";

const iconMap = {
  search: Search,
  "shopping-cart": ShoppingCart,
  cart: ShoppingCart,
  sun: Sun,
  moon: Moon,
  user: User,
  menu: Menu,
  x: X,
  close: X,
  "trash-2": Trash2,
  trash: Trash2,
  package: Package,
  mail: Mail,
  clock: Clock,
  "clock-3": Clock3,
  "map-pin": MapPin,
  instagram: AtSign,
  "shopping-bag": ShoppingBag,
  bell: Bell,
  notification: Bell,
  heart: Heart,
  wishlist: Heart,
  star: Star,
  users: Users,
  trending: TrendingUp,
  gift: Gift,
  alert: AlertTriangle,
  "alert-triangle": AlertTriangle,
  creditcard: CreditCard,
  "rotate-ccw": RotateCcw,
  returns: RotateCcw,
  "help-circle": HelpCircle,
  support: HelpCircle,
  "layout-dashboard": LayoutDashboard,
  dashboard: LayoutDashboard,
  settings: Settings,
  gear: Settings,
  chat: MessageSquare,          
  message: MessageSquare,      
  "message-square": MessageSquare,
  "message-circle": MessageCircle,
  grid: Grid,
  wallet: Wallet,
  truck: Truck,
  "log-out": LogOut,
  logout: LogOut,
  exit: LogOut,
  "arrow-left": ArrowLeft,
  back: ArrowLeft,
  ticket: Ticket,         
  voucher: Ticket,        
  tag: Tag,               
  coupon: Ticket,
    percent: Percent,
  "dollar-sign": DollarSign,
  "copy": Copy,
  "check": Check,
  "check-check": CheckCheck,
  "download": Download,
  "external-link": ExternalLink,
  "file-text": FileText,
  "calendar": Calendar,
  "shield-check": ShieldCheck,
  "receipt": Receipt,
  "send": Send,
  "chevron-down": ChevronDown,
  "banknote": Banknote,
  "copy": Copy,
  "check-circle": CheckCircle,
  "corner-down-left": CornerDownLeft,
  "arrow-up-right": ArrowUpRight,
  "image": Image,
  "loader": Loader,
};

const InstagramLogo = ({ className, size = 24, ...props }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    width={size} 
    height={size} 
    className={className}
    stroke="none"
    {...props}
  >
    <defs>
      <linearGradient id="ig-gradient" x1="20%" y1="100%" x2="80%" y2="0%">
        <stop offset="0%" stopColor="#fdf497" />
        <stop offset="5%" stopColor="#fdf497" />
        <stop offset="45%" stopColor="#fd5949" />
        <stop offset="60%" stopColor="#d6249f" />
        <stop offset="90%" stopColor="#285AEB" />
      </linearGradient>
    </defs>
    <path 
      fill="url(#ig-gradient)" 
      stroke="none"
      d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" 
    />
  </svg>
);

const ShopeeLogo = ({ className, size = 24, ...props }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    width={size} 
    height={size} 
    className={className}
    stroke="none"
    {...props}
  >
    <path fill="#ee4d2d" stroke="none" d="M15.348 9.176a3.864 3.864 0 00-3.08-1.554c-1.705 0-2.87.893-2.87 2.08 0 1.155 1.092 1.584 2.114 1.838 1.144.29 1.488.496 1.488 1.077 0 .522-.505.908-1.306.908-1.143 0-2.274-.61-2.906-1.196L7.546 14.12c1.022.955 2.502 1.56 4.108 1.56 2.062 0 3.32-.962 3.32-2.32 0-1.267-.936-1.748-2.324-2.079-1.021-.247-1.278-.453-1.278-.962 0-.44.456-.784 1.144-.784.825 0 1.705.413 2.131.854l1.192-1.213zM6.914 5.922L4.04 9.155a1.278 1.278 0 00-.289 1.018l1.39 9.387c.123.824.838 1.44 1.677 1.44h10.364c.839 0 1.554-.616 1.677-1.44l1.39-9.387a1.278 1.278 0 00-.289-1.018l-2.874-3.233h-1.677l2.257 2.536H6.335L8.592 5.922H6.914zM12 2.378c-2.324 0-4.084 1.72-4.084 3.544h1.72c0-.978 1.05-1.824 2.364-1.824 1.314 0 2.364.846 2.364 1.824h1.72c0-1.824-1.76-3.544-4.084-3.544z"/>
  </svg>
);

// Map custom logos inside iconMap by mutating or recreating it
iconMap["instagram"] = InstagramLogo;
iconMap["shopee"] = ShopeeLogo;
iconMap["shopee-logo"] = ShopeeLogo;

export function AppIcon({ name, className, size, strokeWidth = 2, ...props }) {
  const IconComponent = iconMap[name] || Search;

  return (
    <IconComponent
      className={className}
      size={size}
      strokeWidth={strokeWidth}
      {...props}
    />
  );
}