import { useState, useCallback, useEffect } from 'react';
import * as faqService from '../../../services/faqService';
import { FAQ } from '../../../types';

export const useFAQs = (shopId?: string) => {
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFaqs = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      const data = await faqService.getFAQs(shopId);
      setFaqs(data);
    } catch(err: any) {
      setError(err?.message || 'Failed to fetch faqs');
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  useEffect(() => {
    fetchFaqs();
  }, [fetchFaqs]);

  const saveFAQ = async (faq: Partial<FAQ>) => {
    if (!shopId) return;
    await faqService.saveFAQ(shopId, faq);
    fetchFaqs(); // reload list
  };

  const deleteFAQ = async (faqId: string) => {
    if (!shopId) return;
    await faqService.deleteFAQ(shopId, faqId);
    fetchFaqs();
  };

  return {
    faqs,
    loading,
    error,
    refresh: fetchFaqs,
    saveFAQ,
    deleteFAQ
  };
};
