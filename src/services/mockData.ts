import { Shop, VendorItem, FAQ, ShopAIConfig } from '../types';

export const mockShops: Shop[] = [
  { 
    id: '1', 
    name: 'Shop One', 
    slug: 'shop-one', 
    status: 'active', 
    chatwootAccountId: '123', 
    databaseName: 'db1', 
    createdAt: '2025-01-01T00:00:00Z', 
    size: 1024,
    aiConfig: {
      botName: 'OneBot',
      personality: 'Helpful and energetic assistant for Shop One.',
      tone: 'friendly',
      responseLanguage: 'English',
      systemPrompt: 'You are OneBot, the official digital assistant for Shop One. Your goal is to provide accurate product information and assist with customer inquiries while maintaining a positive brand image.',
      constraints: [
        'Never mention competitor pricing.',
        'Always verify stock before confirming availability.',
        'Redirect to human support for complex technical issues.'
      ],
      policies: {
        shipping: 'Free standard shipping on all orders over $50. Express shipping available for $15.',
        returns: '30-day no-questions-asked return policy for all products in original packaging.',
        guarantees: 'Lifetime warranty on manufacturing defects for all premium items.',
        general: 'Shop One has been serving the community since 2010 with high-quality products.'
      },
      welcomeMessage: 'Hello! How can I help you with Shop One today?',
      fallbackMessage: "I'm not sure about that. Let me find someone who can help!"
    }
  },
  { id: '2', name: 'Shop Two', slug: 'shop-two', status: 'suspended', chatwootAccountId: undefined, databaseName: 'db2', createdAt: '2025-02-01T00:00:00Z', size: 2048 },
];

export const mockFAQs: FAQ[] = [
  { id: '1', question: 'What are your store hours?', answer: 'We are open from 9 AM to 6 PM, Monday to Friday.', category: 'General' },
  { id: '2', question: 'Do you offer international shipping?', answer: 'Yes, we ship to over 50 countries worldwide.', category: 'Shipping' },
];

export const mockVendorItems: VendorItem[] = [
  { 
    id: '1', 
    item_type: 'product', 
    name: 'Product One', 
    price: 10, 
    description: 'A high-quality product for daily use.', 
    category: 'General',
    stock_type: 'count',
    stock_quantity: 5, 
    is_available: true,
    duration: undefined, 
    status: 'active', 
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    image_url: 'https://picsum.photos/seed/product1/400/300',
    ai_keywords: 'quality, daily, durable',
    selling_points: ['Eco-friendly material', '2-year warranty', 'Lightweight design'],
    ai_faqs: [
      { question: 'Is it waterproof?', answer: 'Yes, it has an IP67 rating.' }
    ]
  },
  { 
    id: '2', 
    item_type: 'service', 
    name: 'Service One', 
    price: 20, 
    description: 'Professional consultation service.', 
    category: 'General',
    stock_type: 'status',
    stock_quantity: 0, 
    is_available: false,
    duration: '1h', 
    status: 'inactive', 
    created_at: '2025-02-01T00:00:00Z',
    updated_at: '2025-02-01T00:00:00Z',
    image_url: 'https://picsum.photos/seed/service1/400/300',
    ai_keywords: 'consultation, professional, expert',
    selling_points: ['Expert advice', 'Personalized plan', 'Follow-up included']
  },
];

export const mockCategories = [
  { id: '1', name: 'General' },
  { id: '2', name: 'Accessories' },
];

export const getShops = async (): Promise<Shop[]> => {
  return new Promise((resolve) => setTimeout(() => resolve(mockShops), 500));
};

export const getShop = async (id: string): Promise<Shop | undefined> => {
  return new Promise((resolve) => setTimeout(() => resolve(mockShops.find(s => s.id === id)), 500));
};

export const getVendorItems = async (shopId: string): Promise<VendorItem[]> => {
  return new Promise((resolve) => setTimeout(() => resolve(mockVendorItems), 500));
};

export const getCategories = async (shopId: string): Promise<{id: string, name: string}[]> => {
  return new Promise((resolve) => setTimeout(() => resolve(mockCategories), 500));
};

export const getFAQs = async (shopId: string): Promise<FAQ[]> => {
  return new Promise((resolve) => setTimeout(() => resolve(mockFAQs), 500));
};

export const addFAQ = async (shopId: string, faq: Omit<FAQ, 'id'>): Promise<FAQ> => {
  return new Promise((resolve) => setTimeout(() => resolve({ ...faq, id: Math.random().toString() }), 500));
};

export const updateFAQ = async (shopId: string, id: string, faq: Partial<FAQ>): Promise<any> => {
  return new Promise((resolve) => setTimeout(() => resolve({ ok: true }), 500));
};

export const deleteFAQ = async (shopId: string, id: string): Promise<any> => {
  return new Promise((resolve) => setTimeout(() => resolve({ ok: true }), 500));
};

export const updateAIConfig = async (shopId: string, config: ShopAIConfig): Promise<any> => {
  return new Promise((resolve) => setTimeout(() => resolve({ ok: true }), 500));
};

export const getAnalytics = async (shopId: string): Promise<any> => {
  return new Promise((resolve) => setTimeout(() => resolve({
    mostPopularCategory: 'General',
    outOfStockCount: 1,
    totalItems: mockVendorItems.length,
    faqCount: mockFAQs.length
  }), 500));
};

export const addCategory = async (shopId: string, name: string): Promise<any> => {
  return new Promise((resolve) => setTimeout(() => resolve({ id: Math.random().toString(), name }), 500));
};

export const deleteCategory = async (shopId: string, id: string): Promise<any> => {
  return new Promise((resolve) => setTimeout(() => resolve({ ok: true }), 500));
};

export const addItem = async (shopId: string, item: any): Promise<any> => {
  return new Promise((resolve) => setTimeout(() => resolve({ ...item, id: Math.random().toString() }), 500));
};

export const updateItem = async (shopId: string, id: string, item: any): Promise<any> => {
  return new Promise((resolve) => setTimeout(() => resolve({ ...item, id }), 500));
};

export const deleteItem = async (shopId: string, id: string): Promise<any> => {
  return new Promise((resolve) => setTimeout(() => resolve({ ok: true }), 500));
};

export const toggleItemStatus = async (shopId: string, id: string, status: string): Promise<any> => {
  return new Promise((resolve) => setTimeout(() => resolve({ ok: true }), 500));
};

export const updateShop = async (id: string, data: any): Promise<any> => {
  return new Promise((resolve) => setTimeout(() => resolve({ ok: true }), 500));
};

export const pingShop = async (id: string): Promise<any> => {
  return new Promise((resolve) => setTimeout(() => resolve({ ok: true }), 500));
};
