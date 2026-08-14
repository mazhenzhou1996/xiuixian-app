// 九宫格服务图标映射：后台配置 icon 字段时填这里的键名
// 例如 icon: "Coins" → <Coins />
import {
  Coins, BedDouble, AlertTriangle, FileText, NotebookPen, BookOpenCheck,
  Compass, LifeBuoy, Ticket, Sparkles, Star, Heart, GraduationCap, School,
  MapPin, Award, MessageSquare, Users, Search, Settings, Shield, ShieldCheck,
  BookOpen, Laptop, Wallet, CreditCard, Bus, Utensils, Wifi, Dumbbell,
  Music, Gamepad2, Camera, Plane, Car, Bike, PenTool, Calculator,
  FlaskConical, Microscope, Stethoscope, Scale, Landmark, Building2, Home,
  Zap, Sun, Moon, CloudRain, Leaf, TreePine, Bird, Cat, Dog, Rocket, Ship,
  ShoppingBag, Gift, Crown, Sword, Phone, Mail, Video, Image, FileQuestion,
  HelpCircle, Info, Bell, Clock, Calendar, CheckCircle2, XCircle, Lock,
  KeyRound, Map, Navigation, Download, Upload, RefreshCw, Plus, Minus,
  Pencil, Trash2, Eye, EyeOff, ArrowUp, ArrowDown, MoreHorizontal, ExternalLink,
  Lightbulb, Trophy, Medal, Target, Flag, TrendingUp,
} from 'lucide-react';

const ICONS: Record<string, any> = {
  Coins, BedDouble, AlertTriangle, FileText, NotebookPen, BookOpenCheck,
  Compass, LifeBuoy, Ticket, Sparkles, Star, Heart, GraduationCap, School,
  MapPin, Award, MessageSquare, Users, Search, Settings, Shield, ShieldCheck,
  BookOpen, Laptop, Wallet, CreditCard, Bus, Utensils, Wifi, Dumbbell,
  Music, Gamepad2, Camera, Plane, Car, Bike, PenTool, Calculator,
  FlaskConical, Microscope, Stethoscope, Scale, Landmark, Building2, Home,
  Zap, Sun, Moon, CloudRain, Leaf, TreePine, Bird, Cat, Dog, Rocket, Ship,
  ShoppingBag, Gift, Crown, Sword, Phone, Mail, Video, Image, FileQuestion,
  HelpCircle, Info, Bell, Clock, Calendar, CheckCircle2, XCircle, Lock,
  KeyRound, Map, Navigation, Download, Upload, RefreshCw, Plus, Minus,
  Pencil, Trash2, Eye, EyeOff, ArrowUp, ArrowDown, MoreHorizontal, ExternalLink,
  Lightbulb, Trophy, Medal, Target, Flag, TrendingUp,
};

export function ServiceIcon({ name, className }: { name: string; className?: string }) {
  const C = ICONS[name] || Sparkles;
  return <C className={className} />;
}

export function iconExists(name: string): boolean {
  return !!ICONS[name];
}

export const ICON_KEYS = Object.keys(ICONS).sort();
