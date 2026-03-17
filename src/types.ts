export interface ShopAIConfig {
  botName: string;
  personality: string;
  tone: 'professional' | 'friendly' | 'humorous' | 'concise';
  responseLanguage: string;
  systemPrompt?: string;
  constraints?: string[];
  policies?: {
    shipping?: string;
    returns?: string;
    guarantees?: string;
    general?: string;
  };
  welcomeMessage?: string;
  fallbackMessage?: string;
  // Lead Capture & Handoff
  handoffRules?: {
    captureEmail: boolean;
    capturePhone: boolean;
    triggerKeywords: string[];
    minPriceThreshold?: number;
    urgencyKeywords: string[];
  };
  // Learning Center / Feedback
  learningCenter?: {
    unansweredQuestions: { id: string; question: string; timestamp: string }[];
    corrections: { id: string; originalQuery: string; aiResponse: string; correction: string; timestamp: string }[];
  };
  // Knowledge Base
  knowledgeBase?: {
    id: string;
    title: string;
    content: string;
    type: 'text' | 'url' | 'file';
    url?: string;
    updatedAt: string;
  }[];
}

export interface FAQ {
  id: string;
  question: string;
  answer: string;
  category?: string;
  tags?: string[];
}

export interface PaymentInfo {
  id: string;
  type: string; // e.g., KPay, WaveMoney, KBZ Bank
  accountName: string;
  accountNumber: string;
  instructions?: string;
}

export interface DeliveryCharge {
  id: string;
  region: string;
  amount: number;
  estimatedDays?: string;
}

export interface Shop {
  id: string;
  name: string;
  slug: string;
  status: 'active' | 'suspended' | 'provisioning' | 'inactive';
  chatwootAccountId: string | null;
  chatwootToken?: string | null;
  databaseName: string;
  createdAt: string;
  size?: number;
  agentId?: string;
  aiConfig?: ShopAIConfig;
  usedTokens?: number;
  vendorCredentials?: {
    email: string;
    password?: string;
  };
  // New Fields
  currency?: 'MMK' | 'THB' | 'USD';
  paymentInfo?: PaymentInfo[];
  deliveryInfo?: DeliveryCharge[];
}

export type SortField = 'name' | 'status' | 'createdAt' | 'size';
export type SortOrder = 'asc' | 'desc';

export interface SubItem {
  id: string;
  name: string;
  item_type: 'product' | 'service';
  price: number; // Absolute price for this sub-item
  stock_type: 'count' | 'status';
  stock_quantity?: number;
  is_available?: boolean;
  sku?: string;
  image_url?: string;
}

export interface VendorItem {
  id: string;
  item_type: 'product' | 'service';
  name: string;
  price: number;
  description: string;
  category: string;
  subcategory?: string | null;
  ai_keywords?: string | null;
  ai_metadata?: string;
  ai_faqs?: { question: string; answer: string }[];
  selling_points?: string[];
  stock_type: 'count' | 'status';
  stock_quantity: number;
  is_available: boolean;
  duration?: string | null;
  booking_availability?: boolean;
  image_url?: string | null;
  status: 'active' | 'inactive' | 'draft';
  created_at: string;
  // AI Enhanced Fields
  brand?: string;
  specifications?: string; // JSON string or plain text
  target_audience?: string;
  usage_instructions?: string;
  shipping_info?: string;
  return_policy?: string;
  warranty_info?: string;
  ai_custom_description?: string; // Detailed description specifically for AI
  embedding?: number[]; // Added for RAG support
  // Sub Items / Variations
  sub_items?: SubItem[];
}

export interface Category {
  id: string;
  name: string;
}

export type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
export type PaymentStatus = 'pending' | 'verified' | 'rejected';

export interface OrderItem {
  id: string;
  itemId: string;
  name: string;
  price: number;
  quantity: number;
  subItemId?: string;
  subItemName?: string;
  imageUrl?: string;
}

export interface Order {
  id: string;
  shopId: string;
  customerName: string;
  customerEmail?: string;
  customerPhone: string;
  shippingAddress: string;
  items: (OrderItem | string)[];
  totalAmount: number;
  status: OrderStatus;
  paymentStatus?: PaymentStatus;
  paymentScreenshotUrl?: string;
  payment_slip_url?: string;
  createdAt: string;
  updatedAt: string;
  notes?: string;
  userId?: string;
  paymentMethod?: string;
  trackingNumber?: string;
  deli_charge?: number;
  total_price?: number;
  customer_address?: string;
}
