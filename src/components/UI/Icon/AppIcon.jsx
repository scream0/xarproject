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
  clock: Clock3,
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
  creditcard: CreditCard,
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
