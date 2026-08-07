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
  Ticket, // <-- Tambahan Ikon Voucher (Tiket Kupon)
  Tag,
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
  ticket: Ticket,         // <-- Bisa dipanggil dengan name="ticket"
  voucher: Ticket,        // <-- Bisa dipanggil dengan name="voucher"
  tag: Tag,               // <-- Bisa dipanggil dengan name="tag"
  coupon: Ticket,
};

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