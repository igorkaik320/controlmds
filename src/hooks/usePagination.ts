import { useEffect, useMemo, useState } from 'react';

export function usePagination<T>(items: T[], initialPageSize = 30) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, items.length);

  const paginatedItems = useMemo(
    () => items.slice(startIndex, endIndex),
    [items, startIndex, endIndex]
  );

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  return {
    currentPage: safeCurrentPage,
    pageSize,
    totalPages,
    startIndex,
    endIndex,
    paginatedItems,
    setCurrentPage,
    setPageSize,
    resetPage: () => setCurrentPage(1),
  };
}
