
import { useMemo } from 'react';
import { getCategoriesForTheme } from '@/config/categoryConfigs';

export const useDraftCategories = (theme: string | null) => {
  return useMemo(() => {
    if (!theme) return [];
    
    const categoryConfigs = getCategoriesForTheme(theme);
    return categoryConfigs.map(config => config.name);
  }, [theme]);
};
