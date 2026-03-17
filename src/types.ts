export interface Shop {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  createdAt: string;
  status: 'active' | 'inactive' | 'provisioning' | 'suspended';
  size: number;
  aiConfig?: ShopAIConfig;
  databaseName?: string;
  chatwootAccountId?: string;
  chatwootToken?: string;
  agentId?: string;
  vendorCredentials?: {
    email: string;
    password?: string;
  };
  currency?: string;
  paymentInfo?: any[];
  deliveryInfo?: any[];
}

export interface SubItem {
  id: string;
  name: string;
  price: number;
  stock_quantity?: number;
  is_available?: boolean;
  item_type?: 'product' | 'service';
  stock_type?: 'status' | 'quantity' | 'count';
  image_url?: string;
}

export interface VendorItem {
  id: string;
  name: string;
  category: string;
  price: number;
  description?: string;
  specifications?: string;
  ai_custom_description?: string;
  ai_keywords?: string;
  embedding?: number[];
  status: 'active' | 'inactive' | 'draft';
  created_at: string;
  updated_at: string;
  stock_quantity?: number;
  stock_type?: 'status' | 'quantity' | 'count';
  is_available?: boolean;
  item_type?: 'product' | 'service';
  usage_instructions?: string;
  image_url?: string;
  sub_items?: SubItem[];
  duration?: string;
  brand?: string;
  target_audience?: string;
  shipping_info?: string;
  return_policy?: string;
  warranty_info?: string;
  ai_metadata?: string;
  booking_availability?: string | boolean;
  subcategory?: string;
  selling_points?: string[];
  ai_faqs?: { question: string; answer: string }[];
}

export interface FAQ {
  id: string;
  question: string;
  answer: string;
  category?: string;
}

export interface ShopAIConfig {
  botName?: string;
  identity?: string;
  personality?: string;
  tone?: string;
  responseLanguage?: string;
  systemPrompt?: string;
  constraints?: string[];
  knowledgeBase?: { id: string; title: string; content: string; url?: string; type?: string }[];
  policies?: {
    shipping?: string;
    returns?: string;
    guarantees?: string;
    general?: string;
  };
  welcomeMessage?: string;
  fallbackMessage?: string;
  handoffRules?: any;
  learningCenter?: any;
}

export interface Category {
  id: string;
  name: string;
}

export type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'completed' | 'cancelled';
export type PaymentStatus = 'unpaid' | 'paid' | 'verified' | 'rejected' | 'failed';

export interface OrderItem {
  id: string;
  itemId: string;
  name: string;
  price: number;
  quantity: number;
  subItemName?: string;
  imageUrl?: string;
}

export interface Order {
  id: string;
  shopId: string;
  userId?: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  shippingAddress: string;
  items: OrderItem[];
  totalAmount: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod?: string;
  paymentScreenshotUrl?: string;
  createdAt: string;
  updatedAt: string;
  notes?: string;
}

export type SortField = keyof Shop;
export type SortOrder = 'asc' | 'desc';
