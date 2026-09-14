import { useState, useEffect, useCallback } from 'react';
import { propertyService } from '../services/propertyService';

export function useProperties(initialFilters = {}) {
  const [properties, setProperties] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState(initialFilters);

  const fetchProperties = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await propertyService.getAll(filters);
      setProperties(res.data?.data || []);
      setPagination(res.data?.pagination || { page: 1, limit: 20, total: 0, pages: 1 });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load properties');
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchProperties();
  }, [fetchProperties]);

  return {
    properties,
    pagination,
    isLoading,
    error,
    filters,
    setFilters,
    refetch: fetchProperties,
  };
}
